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


jest.mock('../slack_to_DB.js', () => ({
  insertModelsToDB: jest.fn()
}));

// import it separately so you can control it in tests
const { insertModelsToDB } = require('../slack_to_DB.js');
const messagesRouter = require('../post_endpoint.js');

describe('POST /api/slack/:channelName - Unit Tests',() => {
    let app;

    beforeEach(() => {
        app = express();
    app.use(express.json());
    app.use(messagesRouter);
    jest.clearAllMocks();
    });

    test('should return 200 and success message on successful insertion', async () => {
        const channelName = 'test-channel';
        const mockMessage = {
            user: 'U12345678',
            type: 'message',
            text: 'Hello, world!',
            ts: '1234567890.123456'
        };

        insertModelsToDB.mockResolvedValue();

        const response = await request(app)
        .post(`/api/slack/${channelName}`)
        .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(`Messages from channel ${channelName} inserted into the database successfully.`);

});

    test('should return 400 and error message on insertion failure', async () => {
        const channelName = 'test-channel';
        const errorMessage = 'Database insertion failed';

        insertModelsToDB.mockRejectedValue(new Error(errorMessage));

        const response = await request(app)
        .post(`/api/slack/${channelName}`)
        .send();


    expect(response.status).toBe(400);
    expect(response.body.error).toBe(errorMessage);

});
});