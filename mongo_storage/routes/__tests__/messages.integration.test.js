const request = require('supertest');
const express = require('express');
 
jest.mock('../../models/Message', () => ({
  getMessageModel: jest.fn()
}));

const messagesRouter = require('../messages');
const { getMessageModel } = require('../../models/Message');

/**
 * Integration Tests for GET/POST /api/messages/:channelName
 *
 * These tests exercise the full router stack via HTTP while mocking Message model
 * operations with an in-memory channel store.
 */

describe('Messages API - Integration Tests', () => {
  let app;
  const channelStore = new Map();
  const modelCache = new Map();
  const TEST_CHANNEL_PREFIX = 'it_';
  let sequence = 0;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const getChannelDocs = (channelName) => {
    if (!channelStore.has(channelName)) {
      channelStore.set(channelName, []);
    }
    return channelStore.get(channelName);
  };

  const findMatchingDoc = (docs, query = {}) => docs.find((doc) => (
    Object.entries(query).every(([key, expectedValue]) => doc[key] === expectedValue)
  ));

  const createMessageModel = (channelName) => {
    const docs = getChannelDocs(channelName);

    class MockMessageModel {
      constructor(payload) {
        this.payload = clone(payload);
      }

      async save() {
        docs.push(clone(this.payload));
        return clone(this.payload);
      }

      static async insertMany(payload) {
        const normalizedPayload = payload.map((item) => clone(item));
        docs.push(...normalizedPayload);
        return normalizedPayload;
      }

      static async find() {
        return clone(docs);
      }

      static async countDocuments() {
        return docs.length;
      }

      static async findOne(query) {
        const matched = findMatchingDoc(docs, query);
        return matched ? clone(matched) : null;
      }
    }

    return MockMessageModel;
  };

  const getOrCreateMessageModel = (channelName) => {
    if (!modelCache.has(channelName)) {
      modelCache.set(channelName, createMessageModel(channelName));
    }
    return modelCache.get(channelName);
  };

  const createChannelName = (suffix) => {
    sequence += 1;
    const compactTime = Date.now().toString(36).slice(-6);
    const compactSeq = sequence.toString(36);
    const compactSuffix = String(suffix || 'x').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'x';
    return `${TEST_CHANNEL_PREFIX}${compactSuffix}_${compactTime}${compactSeq}`;
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(messagesRouter);
    getMessageModel.mockImplementation((channelName) => getOrCreateMessageModel(channelName));
  });

  beforeEach(() => {
    channelStore.clear();
    modelCache.clear();
    getMessageModel.mockClear();
    getMessageModel.mockImplementation((channelName) => getOrCreateMessageModel(channelName));
  });

  describe('GET /api/messages/:channelName', () => {
    test('should return seeded documents from channel database', async () => {
      const channelName = createChannelName('seeded_docs');
      const testMessages = [
        { user: 'alice', type: 'message', text: 'Hello from integration test', ts: '1001.000001' },
        { user: 'bob', type: 'message', text: 'This is a test message', ts: '1001.000002' }
      ];

      const MessageModel = getMessageModel(channelName);
      await MessageModel.insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('user', 'alice');
      expect(res.body[1]).toHaveProperty('user', 'bob');
      expect(res.body[0]).toHaveProperty('text', 'Hello from integration test');
    });

    test('should return empty array for new channel database', async () => {
      const channelName = createChannelName('empty_channel');
      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return documents with extra fields beyond schema', async () => {
      const channelName = createChannelName('extra_fields');
      const testMessages = [
        {
          user: 'charlie',
          type: 'message',
          text: 'Message with extra data',
          ts: '1002.000001',
          metadata: { priority: 'high', tags: ['test', 'important'] },
          attachments: [{ id: 1, url: 'http://example.com' }]
        }
      ];

      const MessageModel = getMessageModel(channelName);
      await MessageModel.insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('metadata');
      expect(res.body[0]).toHaveProperty('attachments');
      expect(res.body[0].metadata).toHaveProperty('priority', 'high');
    });

    test('should handle documents missing schema fields', async () => {
      const channelName = createChannelName('missing_fields');
      const testMessages = [
        { user: 'dave', type: 'message' },
        { user: 'eve', text: 'Complete message', type: 'message', ts: '1003.000001' }
      ];

      const MessageModel = getMessageModel(channelName);
      await MessageModel.insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).not.toHaveProperty('text');
      expect(res.body[1]).toHaveProperty('text', 'Complete message');
    });

    test('should handle large result sets', async () => {
      const channelName = createChannelName('large_collection');
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        user: `user${i}`,
        type: 'message',
        text: `Message number ${i}`,
        ts: `2000.${String(i).padStart(6, '0')}`
      }));

      const MessageModel = getMessageModel(channelName);
      await MessageModel.insertMany(largeDataset);

      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(100);
    });

    test('should support special characters in channel name via sanitization', async () => {
      const channelName = `it msg/26#${Date.now().toString(36).slice(-4)}`;
      const testMessages = [
        { user: 'frank', type: 'message', text: 'Special channel', ts: '1004.000001' }
      ];

      const MessageModel = getMessageModel(channelName);
      await MessageModel.insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('text', 'Special channel');
    });
  });

  describe('POST /api/messages/:channelName', () => {
    test('should insert array payload and persist to channel database', async () => {
      const channelName = createChannelName('post_array');
      const payload = [
        { user: 'amy', type: 'message', text: 'Bulk one', ts: '3001.000001' },
        { user: 'ben', type: 'message', text: 'Bulk two', ts: '3001.000002' }
      ];

      const postRes = await request(app)
        .post(`/api/messages/${encodeURIComponent(channelName)}`)
        .send(payload);

      expect(postRes.status).toBe(200);
      expect(postRes.body).toMatchObject({
        message: `Messages from channel ${channelName} inserted into the database successfully.`,
        insertedCount: 2,
        skippedCount: 0
      });

      const getRes = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(2);
      expect(getRes.body[0]).toHaveProperty('text', 'Bulk one');
      expect(getRes.body[1]).toHaveProperty('text', 'Bulk two');
    });

    test('should insert one message and then report duplicate by ts', async () => {
      const channelName = createChannelName('post_single_duplicate');
      const payload = { user: 'zoe', type: 'message', text: 'Hello once', ts: '4001.000001' };

      const firstRes = await request(app)
        .post(`/api/messages/${encodeURIComponent(channelName)}`)
        .send(payload);

      expect(firstRes.status).toBe(200);
      expect(firstRes.body).toMatchObject({
        message: 'Message stored successfully',
        duplicate: false
      });

      const secondRes = await request(app)
        .post(`/api/messages/${encodeURIComponent(channelName)}`)
        .send(payload);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body).toMatchObject({
        message: 'Message already exists in database',
        duplicate: true
      });

      const getRes = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(1);
      expect(getRes.body[0]).toHaveProperty('ts', payload.ts);
    });
  });
});
