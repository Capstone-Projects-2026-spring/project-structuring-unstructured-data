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

const buildMongoClientMock = (fixtures) => ({
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
          toArray: async () => {
            const docs = [...(dbData.collections[collectionName] || [])];

            if (!query.summary_day_utc) {
              return docs;
            }

            const { $gte, $lt } = query.summary_day_utc;
            return docs.filter((doc) => doc.summary_day_utc >= $gte && doc.summary_day_utc < $lt);
          }
        })
      }),
      listCollections: () => ({
        toArray: async () => Object.keys(dbData.collections).map((name) => ({ name }))
      })
    };
  }
});

const getRouteHandler = (path, method) => {
  const layer = summariesRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Unable to find ${method.toUpperCase()} ${path} route handler`);
  }

  return layer.route.stack[0].handle;
};

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function status(code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function json(payload) {
      res.body = payload;
      return res;
    })
  };

  return res;
};

describe('Summaries Routes - Unit Tests', () => {
  let app;
  let fixtures;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(summariesRouter);

    fixtures = {
      channel_C123: {
        collections: {
          summaries: [
            { user: 'alice', summary_day_utc: '2026-04-05T00:00:00Z', summary_text: 'Kickoff week' },
            { user: 'bob', summary_day_utc: '2026-04-10T00:00:00Z', summary_text: 'Mid-week notes' },
            { user: 'carol', summary_day_utc: '2026-04-12T00:00:00Z', summary_text: 'Next week prep' }
          ]
        }
      },
      misc_data: {
        collections: {
          notes: [
            { info: 'not a summary database' }
          ]
        }
      }
    };

    mongoose.connection.client = buildMongoClientMock(fixtures);
    runModel.mockReset();
  });

  describe('GET /api/summaries/:databaseKey', () => {
    test('should return summaries for an existing database', async () => {
      const res = await request(app).get('/api/summaries/channel_C123');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dbName', 'channel_C123');
      expect(res.body).toHaveProperty('weekStart', null);
      expect(res.body.summaries).toHaveLength(3);
    });

    test('should return 404 when database key is not found', async () => {
      const res = await request(app).get('/api/summaries/unknown_db');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'No database found for channelKey: unknown_db' });
    });

    test('should canonicalize weekStart and filter to one UTC week', async () => {
      const res = await request(app)
        .get('/api/summaries/channel_C123')
        .query({ weekStart: '2026-04-10' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('weekStart', '2026-04-05T00:00:00Z');
      expect(res.body.summaries).toHaveLength(2);
      expect(res.body.summaries[0]).toHaveProperty('summary_day_utc', '2026-04-05T00:00:00Z');
      expect(res.body.summaries[1]).toHaveProperty('summary_day_utc', '2026-04-10T00:00:00Z');
    });

    test('should return 400 when weekStart is invalid', async () => {
      const res = await request(app)
        .get('/api/summaries/channel_C123')
        .query({ weekStart: 'invalid-date' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'weekStart must be a valid date or ISO timestamp.' });
    });
  });

  describe('POST /api/summaries/:databaseKey', () => {
    test('should call runModel with explicit week', async () => {
      runModel.mockResolvedValue({
        success: true,
        savedCount: 2,
        modelResult: { saved_count: 2 },
        results: ['ok']
      });

      const res = await request(app)
        .post('/api/summaries/channel_C123')
        .query({ week: 14 });

      expect(res.status).toBe(200);
      expect(runModel).toHaveBeenCalledWith('channel_C123', {
        week: 14,
        weekStart: undefined
      });
      expect(res.body).toMatchObject({
        message: 'Summary processing completed successfully',
        requestedWeek: 14,
        savedCount: 2
      });
    });

    test('should call runModel with canonicalized weekStart', async () => {
      runModel.mockResolvedValue({
        success: true,
        savedCount: 1,
        modelResult: { saved_count: 1 },
        results: ['ok']
      });

      const res = await request(app)
        .post('/api/summaries/channel_C123')
        .query({ weekStart: '2026-04-10' });

      expect(res.status).toBe(200);
      expect(runModel).toHaveBeenCalledWith('channel_C123', {
        week: undefined,
        weekStart: '2026-04-05T00:00:00Z'
      });
      expect(res.body).toMatchObject({
        requestedWeekStart: '2026-04-05T00:00:00Z',
        savedCount: 1
      });
    });

    test('should return 400 when both week and weekStart are provided', async () => {
      const res = await request(app)
        .post('/api/summaries/channel_C123')
        .query({ week: 14, weekStart: '2026-04-05' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Use either week or weekStart, not both.' });
      expect(runModel).not.toHaveBeenCalled();
    });

    test('should return 400 when week is out of range', async () => {
      const res = await request(app)
        .post('/api/summaries/channel_C123')
        .query({ week: 90 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'week query must be an integer between 0 and 53.' });
      expect(runModel).not.toHaveBeenCalled();
    });

    test('should return 400 when weekStart is invalid', async () => {
      const res = await request(app)
        .post('/api/summaries/channel_C123')
        .query({ weekStart: 'invalid-date' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'weekStart must be a valid date or ISO timestamp.' });
      expect(runModel).not.toHaveBeenCalled();
    });

    test('should return 500 when model execution fails', async () => {
      runModel.mockResolvedValue({
        success: false,
        message: 'Model execution failed for channel_C123',
        error: 'python crashed'
      });

      const res = await request(app).post('/api/summaries/channel_C123');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: 'Model execution failed for channel_C123',
        details: 'python crashed'
      });
    });
  });

});
