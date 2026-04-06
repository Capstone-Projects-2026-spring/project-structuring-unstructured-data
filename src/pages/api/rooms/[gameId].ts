import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
/**
 * Room details API endpoint.
 *
 * Purpose:
 * Returns complete game information for the results page including:
 * - Problem details
 * - Game type (TWOPLAYER or FOURPLAYER)
 * - Team submission codes
 */
interface RoomDetailsResponse {
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
  };
  gameType: string;
  team1Code: string | null;
  team2Code: string | null;
}

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RoomDetailsResponse | ErrorResponse>
) {
  // This endpoint is read-only and only supports GET.
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Only authenticated users should be able to retrieve active room problem details.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Validate the dynamic route parameter before querying the database.
  const { gameId } = req.query;
  if (!gameId || typeof gameId !== "string") {
    return res.status(400).json({ message: "Invalid room ID" });
  }

  try {
    // Fetch the room, problem, and result data in a single query
    const room = await prisma.gameRoom.findUnique({
      where: { id: gameId },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            topics: true,
          },
        },
      },
    });

    // Either the room does not exist or it has no linked problem.
    if (!room || !room.problem) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Fetch the game result codes
    const gameResult = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
      select: {
        team1Code: true,
        team2Code: true,
      },
    });

    // Return complete game data
    return res.status(200).json({
      problem: {
        id: room.problem.id,
        title: room.problem.title,
        description: room.problem.description,
        difficulty: room.problem.difficulty,
        topics: room.problem.topics,
      },
      gameType: room.gameType,
      team1Code: gameResult?.team1Code ?? null,
      team2Code: gameResult?.team2Code ?? null,
    });
  } catch (error: unknown) {
    // Surface a useful message while preserving a fallback for unknown errors.
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message || "Failed to fetch room details" });
    }

    return res.status(500).json({ message: "Failed to fetch room details" });
  }
}
