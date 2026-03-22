const path = require('path');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Load env from repo root so CI/local share the same config
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const messagesRouter = require('../messages');
const { getMessageModel } = require('../../models/Message');

/**
 * Integration Tests for GET/POST /api/messages/:channelName
 * 
 * PREREQUISITES:
 * - MongoDB Atlas connection configured in .env file
 * - IP address whitelisted in Atlas settings
 * - Atlas user must be allowed to create/drop test databases
 * 
 * These tests connect to a real MongoDB instance and verify end-to-end functionality.
 * Run these tests separately from unit tests when you have database connectivity.
 */

describe('Messages API - Integration Tests', () => {
  let app;
  let isConnected = false;
  const TEST_CHANNEL_PREFIX = 'it_';
  const usedChannelNames = new Set();
  let sequence = 0;
  const DB_USER = process.env.MONGODB_USER;
  const DB_PASSWORD = process.env.MONGODB_PASSWORD;
  const uri = `mongodb+srv://${encodeURIComponent(DB_USER || '')}:${encodeURIComponent(DB_PASSWORD || '')}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;

  const createChannelName = (suffix) => {
    sequence += 1;
    const compactTime = Date.now().toString(36).slice(-6);
    const compactSeq = sequence.toString(36);
    const compactSuffix = String(suffix || 'x').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'x';
    const channelName = `${TEST_CHANNEL_PREFIX}${compactSuffix}_${compactTime}${compactSeq}`;
    usedChannelNames.add(channelName);
    return channelName;
  };

  const cleanupChannelDb = async (channelName) => {
    try {
      const dbName = getMessageModel(channelName).db.name;
      await mongoose.connection.client.db(dbName).dropDatabase();
    } catch (err) {
      // NamespaceNotFound/no DB yet is expected for channels that were never written.
      if (!/ns not found|not found/i.test(String(err && err.message))) {
        throw err;
      }
    }
  };

  beforeAll(async () => {
    // Skip tests if no database credentials
    if (!DB_USER || !DB_PASSWORD) {
      console.warn('⚠ Skipping integration tests: MongoDB credentials not found in .env');
      return;
    }

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
      });
      isConnected = true;
    } catch (err) {
      console.warn('⚠ Skipping integration tests: unable to connect to MongoDB:', err.message);
      return;
    }

    // Setup Express app with router
    app = express();
    app.use(express.json());
    app.use(messagesRouter);
  }, 30000); // 30 second timeout for connection

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      for (const channelName of usedChannelNames) {
        // Best-effort cleanup in case a test exits early.
        // eslint-disable-next-line no-await-in-loop
        await cleanupChannelDb(channelName);
      }
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    for (const channelName of usedChannelNames) {
      // eslint-disable-next-line no-await-in-loop
      await cleanupChannelDb(channelName);
    }

    usedChannelNames.clear();
  });

  describe('GET /api/messages/:channelName', () => {
    test('should return seeded documents from channel database', async () => {
      if (!isConnected) {
        return;
      }

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
      if (!isConnected) {
        return;
      }

      const channelName = createChannelName('empty_channel');
      const res = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return documents with extra fields beyond schema', async () => {
      if (!isConnected) {
        return;
      }

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
      if (!isConnected) {
        return;
      }

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
      if (!isConnected) {
        return;
      }

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
      if (!isConnected) {
        return;
      }

      const channelName = `it msg/26#${Date.now().toString(36).slice(-4)}`;
      usedChannelNames.add(channelName);
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
      if (!isConnected) {
        return;
      }

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
        message: `Messages from channel ${channelName} inserted into the database successfully.`
      });

      const getRes = await request(app).get(`/api/messages/${encodeURIComponent(channelName)}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(2);
      expect(getRes.body[0]).toHaveProperty('text', 'Bulk one');
      expect(getRes.body[1]).toHaveProperty('text', 'Bulk two');
    });

    test('should insert one message and then report duplicate by ts', async () => {
      if (!isConnected) {
        return;
      }

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
