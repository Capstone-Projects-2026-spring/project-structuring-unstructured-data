const request = require('supertest');
const express = require('express');

// Mock mongoose so we don't need a real DB
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      readyState: 0,
      db: null
    }
  };
});

// Mock getMessageModel before requiring the router
jest.mock('../../models/Message', () => ({
  getMessageModel: jest.fn()
}));

const { getMessageModel } = require('../../models/Message');
const messagesRouter = require('../messages');

describe('GET /api/insights/week/:collectionName - Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(messagesRouter);
    jest.clearAllMocks();
  });

  test('should return messageCount, activeUsers, and topUsers for week messages', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    // 3 messages, 2 unique users
    const mockMessages = [
      { user: 'U1', ts: String(nowSeconds - 60), text: 'hello' },
      { user: 'U1', ts: String(nowSeconds - 120), text: 'again' },
      { user: 'U2', ts: String(nowSeconds - 180), text: 'yo' }
    ];

    const mockFind = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockMessages)
    });

    // getMessageModel should return an object with find()
    getMessageModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/insights/week/testCollection');

    expect(res.status).toBe(200);
    expect(res.body.collectionName).toBe('testCollection');
    expect(res.body.messageCount).toBe(3);
    expect(res.body.activeUsers).toBe(2);

    // Top user should be U1 with 2
    expect(res.body.topUsers[0]).toMatchObject({ user: 'U1', count: 2 });
  });

  test('should handle messages with missing/invalid ts by ignoring them', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    const mockMessages = [
      { user: 'U1', ts: 'not-a-number', text: 'bad ts' },
      { user: 'U2', ts: String(nowSeconds - 60), text: 'good ts' }
    ];

    const mockFind = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockMessages)
    });

    getMessageModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/insights/week/testCollection');

    expect(res.status).toBe(200);
    expect(res.body.messageCount).toBe(1);
    expect(res.body.activeUsers).toBe(1);
    expect(res.body.topUsers[0]).toMatchObject({ user: 'U2', count: 1 });
  });
});