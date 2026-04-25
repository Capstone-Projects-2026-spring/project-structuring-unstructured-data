const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => ({
  connection: {
    client: null
  }
}));

jest.mock('../../python', () => ({
  runUserModel: jest.fn()
}));

const mongoose = require('mongoose');
const { runUserModel } = require('../../python');
const summariesRouter = require('../summaries');

/**
 * Integration Tests for /api/user_summaries routes.
 *
 * These tests exercise the full summaries router over HTTP while mocking MongoDB
 * database traversal and Python user-model execution.
 */

describe('User Summaries API - Integration Tests', () => {
  let app;
  let dbFixtures;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const createMongoClientMock = (fixtures) => ({
    db: (dbName) => {
      if (!dbName) {
        return {
          admin: () => ({
            listDatabases: async () => ({
              databases: Object.keys(fixtures).map((name) => ({ name }))
            })
          })
        };
      }

      const dbData = fixtures[dbName] || { collections: {} };

      return {
        collection: (collectionName) => ({
          find: (query = {}) => ({
            toArray: async () => clone(dbData.collections[collectionName] || [])
          }),
          findOne: async (query = {}) => {
            const docs = clone(dbData.collections[collectionName] || []);

            if (query && Array.isArray(query.$or)) {
              return docs.find((doc) => query.$or.some((candidate) => (
                Object.entries(candidate).every(([key, expectedValue]) => doc[key] === expectedValue)
              ))) || null;
            }

            return docs.find((doc) => (
              Object.entries(query).every(([key, expectedValue]) => doc[key] === expectedValue)
            )) || null;
          }
        })
      };
    }
  });

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(summariesRouter);
  });

  beforeEach(() => {
    dbFixtures = {
      team_alpha_C123: {
        collections: {
          user_summaries: [
            {
              user_id: 'U001',
              real_name: 'Alice Smith',
              generated_at_utc: '2026-04-25T13:41:22.221Z',
              message_count: 32,
              summary_text: 'Alice summary text',
              status: 'ok'
            },
            {
              user_id: 'U002',
              real_name: 'Bob Jones',
              generated_at_utc: '2026-04-25T13:41:22.221Z',
              message_count: 18,
              summary_text: 'Bob summary text',
              status: 'ok'
            }
          ]
        }
      },
      team_alpha_empty: {
        collections: {
          user_summaries: []
        }
      },
      misc_data: {
        collections: {
          notes: [{ text: 'ignore for summary endpoint tests' }]
        }
      }
    };

    mongoose.connection.client = createMongoClientMock(dbFixtures);
    runUserModel.mockReset();
  });

  describe('GET /api/user_summaries/:databaseKey/:userId?', () => {
    test('should return all user summaries for an existing database key', async () => {
      const res = await request(app).get('/api/user_summaries/team_alpha_C123');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dbName', 'team_alpha_C123');
      expect(res.body.userSummaries).toHaveLength(2);
      expect(res.body.userSummaries[0]).toHaveProperty('user_id', 'U001');
      expect(res.body.userSummaries[1]).toHaveProperty('user_id', 'U002');
    });

    test('should return a specific user summary when userId is provided as a route param', async () => {
      const res = await request(app).get('/api/user_summaries/team_alpha_C123/U001');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dbName', 'team_alpha_C123');
      expect(res.body.userSummary).toMatchObject({
        user_id: 'U001',
        real_name: 'Alice Smith',
        message_count: 32
      });
    });

    test('should return a specific user summary when userId is provided as a query parameter', async () => {
      const res = await request(app)
        .get('/api/user_summaries/team_alpha_C123')
        .query({ userId: 'U002' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dbName', 'team_alpha_C123');
      expect(res.body.userSummary).toMatchObject({
        user_id: 'U002',
        real_name: 'Bob Jones',
        message_count: 18
      });
    });

    test('should return null for a user with no summary yet', async () => {
      const res = await request(app).get('/api/user_summaries/team_alpha_empty/U999');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        dbName: 'team_alpha_empty',
        userSummary: null
      });
    });

    test('should return 404 when requested database key does not exist', async () => {
      const res = await request(app).get('/api/user_summaries/unknown_channel/U001');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/user_summaries/:databaseKey', () => {
    test('should run the user model for all users when no userId is provided', async () => {
      runUserModel.mockResolvedValue({
        success: true,
        modelResult: { saved_count: 2 },
        results: ['generated all user summaries']
      });

      const res = await request(app)
        .post('/api/user_summaries/team_alpha_C123');

      expect(res.status).toBe(200);
      expect(runUserModel).toHaveBeenCalledWith('team_alpha_C123', undefined);
      expect(res.body).toMatchObject({
        message: 'User summaries processed successfully',
        databaseKey: 'team_alpha_C123',
        userId: null,
        modelMetadata: { saved_count: 2 }
      });
    });

    test('should run the user model for one specific user when userId is provided in query params', async () => {
      runUserModel.mockResolvedValue({
        success: true,
        modelResult: { saved_count: 1 },
        results: ['generated one user summary']
      });

      const res = await request(app)
        .post('/api/user_summaries/team_alpha_C123')
        .query({ userId: 'U001' });

      expect(res.status).toBe(200);
      expect(runUserModel).toHaveBeenCalledWith('team_alpha_C123', 'U001');
      expect(res.body).toMatchObject({
        message: 'User summary processed successfully for userId U001',
        databaseKey: 'team_alpha_C123',
        userId: 'U001',
        modelMetadata: { saved_count: 1 }
      });
    });

    test('should run the user model for one specific user when userId is provided in the request body', async () => {
      runUserModel.mockResolvedValue({
        success: true,
        modelResult: { saved_count: 1 },
        results: ['generated one user summary from body']
      });

      const res = await request(app)
        .post('/api/user_summaries/team_alpha_C123')
        .send({ userId: 'U002' });

      expect(res.status).toBe(200);
      expect(runUserModel).toHaveBeenCalledWith('team_alpha_C123', 'U002');
      expect(res.body).toMatchObject({
        message: 'User summary processed successfully for userId U002',
        databaseKey: 'team_alpha_C123',
        userId: 'U002',
        modelMetadata: { saved_count: 1 }
      });
    });

    test('should return 404 when requested database key does not exist', async () => {
      const res = await request(app)
        .post('/api/user_summaries/unknown_channel')
        .query({ userId: 'U001' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(runUserModel).not.toHaveBeenCalled();
    });

    test('should return 500 when model execution fails', async () => {
      runUserModel.mockResolvedValue({
        success: false,
        message: 'User model execution failed for team_alpha_C123',
        error: 'python crashed'
      });

      const res = await request(app)
        .post('/api/user_summaries/team_alpha_C123')
        .query({ userId: 'U001' });

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({
        error: 'User model execution failed for team_alpha_C123',
        details: 'python crashed'
      });
    });
  });
});