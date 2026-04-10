const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => ({
  connection: {
    client: null
  }
}));

jest.mock('../../python', () => ({
  runModel: jest.fn()
}));

const mongoose = require('mongoose');
const { runModel } = require('../../python');
const summariesRouter = require('../summaries');

/**
 * Integration Tests for /api/summaries routes.
 *
 * These tests execute the summaries router over HTTP and mock both MongoDB client
 * traversal and Python model execution.
 */

describe('Summaries API - Integration Tests', () => {
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
        listCollections: () => ({
          toArray: async () => Object.keys(dbData.collections).map((name) => ({ name }))
        }),
        collection: (collectionName) => ({
          find: (query = {}) => ({
            toArray: async () => {
              const docs = clone(dbData.collections[collectionName] || []);

              if (!query.summary_day_utc) {
                return docs;
              }

              const { $gte, $lt } = query.summary_day_utc;
              return docs.filter((doc) => doc.summary_day_utc >= $gte && doc.summary_day_utc < $lt);
            }
          })
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
          summaries: [
            { user: 'alice', summary_day_utc: '2026-04-05T00:00:00Z', summary_text: 'Kickoff updates' },
            { user: 'bob', summary_day_utc: '2026-04-11T00:00:00Z', summary_text: 'Shipped parser changes' },
            { user: 'carol', summary_day_utc: '2026-04-12T00:00:00Z', summary_text: 'Started next sprint' }
          ]
        }
      },
      team_alpha_C123_cw: {
        collections: {
          summaries: [
            { user: 'alice', summary_day_utc: '2026-04-11T00:00:00Z', summary_text: 'Current week summary' }
          ]
        }
      },
      team_alpha_C123_pw: {
        collections: {
          summaries: [
            { user: 'bob', summary_day_utc: '2026-04-04T00:00:00Z', summary_text: 'Past week summary' }
          ]
        }
      },
      misc_data: {
        collections: {
          notes: [{ text: 'ignore for /all endpoint suffix filtering test' }]
        }
      }
    };

    mongoose.connection.client = createMongoClientMock(dbFixtures);
    runModel.mockReset();
  });

  describe('GET /api/summaries/:databaseKey', () => {
    test('should return summaries for an existing database key', async () => {
      const res = await request(app).get('/api/summaries/team_alpha_C123');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dbName', 'team_alpha_C123');
      expect(res.body).toHaveProperty('weekStart', null);
      expect(res.body.summaries).toHaveLength(3);
      expect(res.body.summaries[0]).toHaveProperty('user', 'alice');
    });

    test('should return 404 when requested database key does not exist', async () => {
      const res = await request(app).get('/api/summaries/unknown_channel');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    test('should normalize weekStart and return one-week summary window', async () => {
      const res = await request(app)
        .get('/api/summaries/team_alpha_C123')
        .query({ weekStart: '2026-04-08' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('weekStart', '2026-04-05T00:00:00Z');
      expect(res.body.summaries).toHaveLength(2);
      expect(res.body.summaries[0]).toHaveProperty('summary_day_utc', '2026-04-05T00:00:00Z');
      expect(res.body.summaries[1]).toHaveProperty('summary_day_utc', '2026-04-11T00:00:00Z');
    });

    test('should return 400 for invalid weekStart query value', async () => {
      const res = await request(app)
        .get('/api/summaries/team_alpha_C123')
        .query({ weekStart: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'weekStart must be a valid date or ISO timestamp.'
      });
    });
  });

  describe('POST /api/summaries/:databaseKey', () => {
    test('should run model for explicit week and return processing metadata', async () => {
      runModel.mockResolvedValue({
        success: true,
        savedCount: 2,
        modelResult: { saved_count: 2 },
        results: ['summary generated']
      });

      const res = await request(app)
        .post('/api/summaries/team_alpha_C123')
        .query({ week: 14 });

      expect(res.status).toBe(200);
      expect(runModel).toHaveBeenCalledWith('team_alpha_C123', {
        week: 14,
        weekStart: undefined
      });
      expect(res.body).toMatchObject({
        message: 'Summary processing completed successfully',
        requestedWeek: 14,
        savedCount: 2
      });
      expect(res.body).not.toHaveProperty('requestedWeekStart');
    });

    test('should run model for weekStart and pass canonicalized UTC week start', async () => {
      runModel.mockResolvedValue({
        success: true,
        savedCount: 1,
        modelResult: { saved_count: 1 },
        results: ['summary generated']
      });

      const res = await request(app)
        .post('/api/summaries/team_alpha_C123')
        .query({ weekStart: '2026-04-08' });

      expect(res.status).toBe(200);
      expect(runModel).toHaveBeenCalledWith('team_alpha_C123', {
        week: undefined,
        weekStart: '2026-04-05T00:00:00Z'
      });
      expect(res.body).toMatchObject({
        requestedWeekStart: '2026-04-05T00:00:00Z'
      });
      expect(res.body).not.toHaveProperty('requestedWeek');
    });

    test('should return 400 when both week and weekStart are provided', async () => {
      const res = await request(app)
        .post('/api/summaries/team_alpha_C123')
        .query({ week: 14, weekStart: '2026-04-05' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Use either week or weekStart, not both.'
      });
      expect(runModel).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid week query', async () => {
      const res = await request(app)
        .post('/api/summaries/team_alpha_C123')
        .query({ week: 99 });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'week query must be an integer between 0 and 53.'
      });
      expect(runModel).not.toHaveBeenCalled();
    });

    test('should return 500 when model execution fails', async () => {
      runModel.mockResolvedValue({
        success: false,
        message: 'Model execution failed for team_alpha_C123',
        error: 'python crashed'
      });

      const res = await request(app)
        .post('/api/summaries/team_alpha_C123');

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({
        error: 'Model execution failed for team_alpha_C123',
        details: 'python crashed'
      });
    });
  });

});
