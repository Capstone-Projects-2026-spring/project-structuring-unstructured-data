const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock mongoose connection
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      readyState: 0, // disconnected for unit tests
      db: null
    }
  };
});

// Mock the Message model module before requiring the router
jest.mock('../../models/Message', () => jest.fn());

const getMessageModel = require('../../models/Message');
const messagesRouter = require('../messages');

describe('GET /api/messages/:collectionName - Unit Tests', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(messagesRouter);
    jest.clearAllMocks();
  });

  test('should return 200 and messages array when model.find() succeeds', async () => {
    const mockMessages = [
      { user: 'user1', type: 'message', text: 'Hello', ts: new Date('2024-01-01') },
      { user: 'user2', type: 'message', text: 'World', ts: new Date('2024-01-02') }
    ];

    const mockFind = jest.fn().mockResolvedValue(mockMessages);
    getMessageModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/messages/testCollection');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({ user: 'user1', type: 'message', text: 'Hello' });
    expect(res.body[1]).toMatchObject({ user: 'user2', type: 'message', text: 'World' });
    expect(getMessageModel).toHaveBeenCalledWith('testCollection');
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith();
  });

  test('should return empty array when collection has no documents', async () => {
    const mockFind = jest.fn().mockResolvedValue([]);
    getMessageModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/messages/emptyCollection');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  test('should return 500 when model.find() throws an error', async () => {
    const mockError = new Error('Database connection failed');
    const mockFind = jest.fn().mockRejectedValue(mockError);
    getMessageModel.mockReturnValue({ find: mockFind });

    // Suppress console.error for this test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const res = await request(app).get('/api/messages/failCollection');

    expect(res.status).toBe(500);
    expect(res.text).toBe('Server Error');
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);

    consoleErrorSpy.mockRestore();
  });

  test('should handle different collection names correctly', async () => {
    const mockFind = jest.fn().mockResolvedValue([{ user: 'testUser' }]);
    getMessageModel.mockReturnValue({ find: mockFind });

    await request(app).get('/api/messages/collection1');
    expect(getMessageModel).toHaveBeenCalledWith('collection1');

    await request(app).get('/api/messages/collection2');
    expect(getMessageModel).toHaveBeenCalledWith('collection2');

    expect(getMessageModel).toHaveBeenCalledTimes(2);
  });

  test('should return messages with extra fields beyond schema', async () => {
    const mockMessagesWithExtraFields = [
      {
        user: 'user1',
        type: 'message',
        text: 'Hello',
        ts: new Date('2024-01-01'),
        extraField1: 'value1',
        metadata: { foo: 'bar' }
      }
    ];

    const mockFind = jest.fn().mockResolvedValue(mockMessagesWithExtraFields);
    getMessageModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/messages/extendedCollection');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty('extraField1', 'value1');
    expect(res.body[0]).toHaveProperty('metadata');
    expect(res.body[0].metadata).toEqual({ foo: 'bar' });
  });
});
