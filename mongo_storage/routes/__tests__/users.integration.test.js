const request = require('supertest');
const express = require('express');

jest.mock('../../models/User', () => ({
  getUserModel: jest.fn()
}));

const usersRouter = require('../users');
const { getUserModel } = require('../../models/User');

/**
 * Integration Tests for GET/POST /api/users/:channelName
 *
 * These tests exercise the full users router over HTTP while mocking User model
 * operations with an in-memory channel store.
 */

describe('Users API - Integration Tests', () => {
  let app;
  const channelStore = new Map();
  const modelCache = new Map();

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const getChannelUsers = (channelName) => {
    if (!channelStore.has(channelName)) {
      channelStore.set(channelName, []);
    }
    return channelStore.get(channelName);
  };

  const createUserModel = (channelName) => {
    const members = getChannelUsers(channelName);

    class MockUserModel {
      static async find() {
        return clone(members);
      }

      static async insertMany(payload) {
        if (!Array.isArray(payload)) {
          throw new Error('Members payload must be an array');
        }

        const ops = payload.map((item) => ({
          updateOne: {
            filter: { member_id: item.member_id },
            update: { $set: item },
            upsert: true
          }
        }));

        return MockUserModel.bulkWrite(ops);
      }

      static async bulkWrite(ops) {
        if (!Array.isArray(ops)) {
          throw new Error('bulkWrite operations must be an array');
        }

        let upsertedCount = 0;
        let modifiedCount = 0;

        ops.forEach((op) => {
          const updateOne = op && op.updateOne;
          const member = updateOne && updateOne.update && updateOne.update.$set;

          if (!member) {
            return;
          }

          const memberId = updateOne.filter && updateOne.filter.member_id;
          const existingIndex = members.findIndex((item) => item.member_id === memberId);
          const nextMember = clone(member);

          if (existingIndex === -1) {
            members.push(nextMember);
            upsertedCount += 1;
            return;
          }

          members[existingIndex] = nextMember;
          modifiedCount += 1;
        });

        return { upsertedCount, modifiedCount };
      }
    }

    return MockUserModel;
  };

  const getOrCreateUserModel = (channelName) => {
    if (!modelCache.has(channelName)) {
      modelCache.set(channelName, createUserModel(channelName));
    }
    return modelCache.get(channelName);
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(usersRouter);

    getUserModel.mockImplementation((channelName) => getOrCreateUserModel(channelName));
  });

  beforeEach(() => {
    channelStore.clear();
    modelCache.clear();
    getUserModel.mockClear();
    getUserModel.mockImplementation((channelName) => getOrCreateUserModel(channelName));
  });

  describe('GET /api/users/:channelName', () => {
    test('should return seeded members from channel store', async () => {
      const channelName = 'it_users_seeded';
      const seededMembers = [
        {
          member_id: 'U001',
          team_id: 'T001',
          name: 'alice',
          real_name: 'Alice Smith',
          is_admin: true,
          is_owner: false,
          is_bot: false
        },
        {
          member_id: 'U002',
          team_id: 'T001',
          name: 'bob',
          real_name: 'Bob Jones',
          is_admin: false,
          is_owner: false,
          is_bot: false
        }
      ];

      const UserModel = getUserModel(channelName);
      await UserModel.insertMany(seededMembers);

      const res = await request(app).get(`/api/users/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('name', 'alice');
      expect(res.body[1]).toHaveProperty('name', 'bob');
    });

    test('should return empty array for channel with no members', async () => {
      const channelName = 'it_users_empty';

      const res = await request(app).get(`/api/users/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return members with extra fields beyond schema', async () => {
      const channelName = 'it_users_extra_fields';
      const seededMembers = [
        {
          member_id: 'U003',
          team_id: 'T001',
          name: 'charlie',
          profile: { title: 'Engineer' },
          timezone: 'UTC'
        }
      ];

      const UserModel = getUserModel(channelName);
      await UserModel.insertMany(seededMembers);

      const res = await request(app).get(`/api/users/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('profile');
      expect(res.body[0]).toHaveProperty('timezone', 'UTC');
    });
  });

  describe('POST /api/users/:channelName', () => {
    test('should insert member array and persist to channel store', async () => {
      const channelName = 'it_users_post';
      const payload = [
        {
          member_id: 'U010',
          team_id: 'T001',
          name: 'dana',
          real_name: 'Dana Ray',
          is_admin: false,
          is_owner: false,
          is_bot: false
        },
        {
          member_id: 'U011',
          team_id: 'T001',
          name: 'evan',
          real_name: 'Evan Chu',
          is_admin: false,
          is_owner: true,
          is_bot: false
        }
      ];

      const postRes = await request(app)
        .post(`/api/users/${encodeURIComponent(channelName)}`)
        .send(payload);

      expect(postRes.status).toBe(200);
      expect(postRes.body).toMatchObject({
        message: `Members from channel ${channelName} inserted into the database successfully.`
      });

      const getRes = await request(app).get(`/api/users/${encodeURIComponent(channelName)}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(2);
      expect(getRes.body[0]).toHaveProperty('member_id', 'U010');
      expect(getRes.body[1]).toHaveProperty('member_id', 'U011');
    });

    test('should return 400 when channelName is blank', async () => {
      const postRes = await request(app)
        .post('/api/users/%20%20%20')
        .send([{ member_id: 'U099', name: 'nobody' }]);

      expect(postRes.status).toBe(400);
      expect(postRes.body).toMatchObject({
        error: 'channelName path parameter is required'
      });
    });
  });
});
