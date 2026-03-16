// Unit tests for the create-room API handler.
// These tests call the handler directly, so no running Next server is required.
import { beforeEach, describe, test, expect, jest } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import { ProblemDifficulty } from "@prisma/client";
import handler from "../../src/pages/api/rooms/create";
import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";
import { nanoid } from "nanoid";

// Replace auth dependency with a mock so tests can control authenticated/unauthenticated flows.
jest.mock("../../src/lib/auth", () => ({
  auth: {
    api: { getSession: jest.fn() } },
}));

// Replace Prisma dependency with mocks to avoid real DB calls.
jest.mock("../../src/lib/prisma", () => ({
  prisma: {
    problem: { findFirst: jest.fn() },
    gameRoom: { create: jest.fn() },
  },
}));
// Fix room ID generation to a deterministic value so assertions stay stable.
jest.mock("nanoid", () => ({ 
    nanoid: jest.fn(() => "abcd1234"),
 }));

// Typed aliases for mocked functions. Casting through unknown avoids TS incompatibility noise.
const mockGetSession = auth.api.getSession as unknown as jest.MockedFunction<(...args: any[]) => any>;
const mockFindFirst = prisma.problem.findFirst as unknown as jest.MockedFunction<(...args: any[]) => any>;
const mockCreateGameRoom = prisma.gameRoom.create as unknown as jest.MockedFunction<(...args: any[]) => any>;

// Minimal response object used by the handler in these tests.
// We extend with `body` so assertions can read what was sent to `res.json(...)`.
 type MockRes = NextApiResponse & {
    statusCode: number;
    body: unknown;
 };
 
 // makeRes mimics the parts of NextApiResponse the handler uses:
 // 1) `status(code)` stores statusCode and returns `res` for chaining.
 // 2) `json(payload)` stores payload in `body` and returns `res`.
 // 3) both are jest.fn so we can assert call arguments.
 function makeRes(): MockRes {
    const res: Partial<MockRes> = {};
    res.statusCode = 200;
    res.body = undefined;
    res.status = jest.fn((code: number) => {
        res.statusCode = code;
        return res as NextApiResponse;
        }) as MockRes["status"];
    res.json = jest.fn((payload: unknown) => {
        res.body = payload;
        return res as NextApiResponse;
    }) as MockRes["json"];
    return res as MockRes;
 }

 // Branch-based tests: each test targets one behavior path in the handler.
 describe("POST /api/rooms/create unit", () => {
     // Reset mock call history and return values between tests to prevent test leakage.
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test("returns 405 for non-POST", async () => {
        const req = { method: "GET", body: {}, headers: {} } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.body).toEqual({ message: "Method not allowed"});
    });
    test("returns 400 for missing difficulty", async () => {
        const req = { method: "POST", body: {}, headers: {} } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body).toEqual({ message: "Invalid difficulty" });
    });
    test("returns 401 when unauthenticated", async () => {
        mockGetSession.mockResolvedValue(null);

        const req = {
            method: "POST",
            body: { difficulty: ProblemDifficulty.EASY },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ ok: false, error: "Unauthorized"});
        });
        
        test("returns 500 when no problem exists for difficulty", async () => {
            mockGetSession.mockResolvedValue({ user: { id: "user1" } });
            mockFindFirst.mockResolvedValue(null);

            const req = {
                method: "POST",
                body: { difficulty: ProblemDifficulty.EASY },
                headers: {},
            } as NextApiRequest;
            const res = makeRes();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.body).toEqual({ message: "No problems found in the database" });
        });

        test("returns 201 and gameId on success", async () => {
            mockGetSession.mockResolvedValue({ user: { id: "user1" } });
            mockFindFirst.mockResolvedValue({ id: "problem1" });
            mockCreateGameRoom.mockResolvedValue({ id: "abcd1234", problemId: "problem1" });

            const req = {
                method: "POST",
                body: { difficulty: ProblemDifficulty.EASY },
                headers: {},
            } as NextApiRequest;
            const res = makeRes();

            await handler(req, res);

            expect(prisma.problem.findFirst).toHaveBeenCalledWith({
                 where: { difficulty: ProblemDifficulty.EASY },
                 });
            expect(prisma.gameRoom.create).toHaveBeenCalledWith({
                data: { id: "abcd1234", problemId: "problem1" },
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.body).toEqual({ gameId: "abcd1234" });
        });

    });