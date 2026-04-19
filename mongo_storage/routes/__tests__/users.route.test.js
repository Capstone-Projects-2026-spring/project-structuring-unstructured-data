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

// Mock the User model module before requiring the router
jest.mock('../../models/User', () => ({
  getUserModel: jest.fn()
}));

const { getUserModel } = require('../../models/User');
const usersRouter = require('../users');

describe('GET /api/users/:collectionName - Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(usersRouter);
    jest.clearAllMocks();
  });

  test('should return 200 and users array when model.find() succeeds', async () => {
    const mockUsers = [
      {
        team_id: 'T001',
        name: 'alice',
        real_name: 'Alice Smith',
        is_admin: true,
        is_owner: false,
        is_bot: false
      },
      {
        team_id: 'T001',
        name: 'bot-user',
        real_name: 'Build Bot',
        is_admin: false,
        is_owner: false,
        is_bot: true
      }
    ];

    const mockFind = jest.fn().mockResolvedValue(mockUsers);
    getUserModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/users/testCollection');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({ name: 'alice', is_admin: true });
    expect(res.body[1]).toMatchObject({ name: 'bot-user', is_bot: true });
    expect(getUserModel).toHaveBeenCalledWith('testCollection');
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith();
  });

  test('should return empty array when collection has no documents', async () => {
    const mockFind = jest.fn().mockResolvedValue([]);
    getUserModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/users/emptyCollection');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  test('should return 500 when model.find() throws an error', async () => {
    const mockError = new Error('Database connection failed');
    const mockFind = jest.fn().mockRejectedValue(mockError);
    getUserModel.mockReturnValue({ find: mockFind });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const res = await request(app).get('/api/users/failCollection');

    expect(res.status).toBe(500);
    expect(res.text).toBe('Server Error');
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);

    consoleErrorSpy.mockRestore();
  });

  test('should handle different collection names correctly', async () => {
    const mockFind = jest.fn().mockResolvedValue([{ name: 'testUser' }]);
    getUserModel.mockReturnValue({ find: mockFind });

    await request(app).get('/api/users/collection1');
    expect(getUserModel).toHaveBeenCalledWith('collection1');

    await request(app).get('/api/users/collection2');
    expect(getUserModel).toHaveBeenCalledWith('collection2');

    expect(getUserModel).toHaveBeenCalledTimes(2);
  });

  test('should return users with extra fields beyond schema', async () => {
    const mockUsersWithExtraFields = [
      {
        team_id: 'T001',
        name: 'alice',
        real_name: 'Alice Smith',
        is_admin: true,
        is_owner: false,
        is_bot: false,
        profile: { title: 'Engineer' },
        timezone: 'UTC'
      }
    ];

    const mockFind = jest.fn().mockResolvedValue(mockUsersWithExtraFields);
    getUserModel.mockReturnValue({ find: mockFind });

    const res = await request(app).get('/api/users/extendedCollection');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty('profile');
    expect(res.body[0].profile).toEqual({ title: 'Engineer' });
    expect(res.body[0]).toHaveProperty('timezone', 'UTC');
  });
});

describe('POST /api/users/:channelName - Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(usersRouter);
    jest.clearAllMocks();
  });

  test('should return 200 and success message on successful insertion', async () => {
    const channelName = 'test-channel';
    const mockMembers = [
      {
        member_id: 'U001',
        team_id: 'T001',
        name: 'alice',
        real_name: 'Alice Smith',
        is_admin: true,
        is_owner: false,
        is_bot: false
      }
    ];

    const mockBulkWrite = jest.fn().mockResolvedValue({
      upsertedCount: 1,
      modifiedCount: 0
    });
    getUserModel.mockReturnValue({ bulkWrite: mockBulkWrite });

    const response = await request(app)
      .post(`/api/users/${channelName}`)
      .send(mockMembers);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      `Members from channel ${channelName} inserted into the database successfully.`
    );
    expect(getUserModel).toHaveBeenCalledWith(channelName);
    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { member_id: 'U001' },
          update: { $set: mockMembers[0] },
          upsert: true
        }
      }
    ]);
  });

  test('should return 400 and error message on insertion failure', async () => {
    const channelName = 'test-channel';
    const errorMessage = 'Database insertion failed';

    const mockBulkWrite = jest.fn().mockRejectedValue(new Error(errorMessage));
    getUserModel.mockReturnValue({ bulkWrite: mockBulkWrite });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const response = await request(app)
      .post(`/api/users/${channelName}`)
      .send([{ member_id: 'U001' }]);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(errorMessage);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('should return 400 when channelName path parameter is blank or whitespace', async () => {
    const mockBulkWrite = jest.fn().mockResolvedValue({
      upsertedCount: 0,
      modifiedCount: 0
    });
    getUserModel.mockReturnValue({ bulkWrite: mockBulkWrite });

    const response = await request(app)
      .post('/api/users/%20%20%20')
      .send([{ name: 'alice' }]);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('channelName path parameter is required');
    expect(getUserModel).not.toHaveBeenCalled();
    expect(mockBulkWrite).not.toHaveBeenCalled();
  });
});
