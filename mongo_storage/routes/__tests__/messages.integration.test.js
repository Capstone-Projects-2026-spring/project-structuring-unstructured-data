const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../../../.env' });

const messagesRouter = require('../messages');
const getMessageModel = require('../../models/Message');

/**
 * Integration Tests for GET /api/messages/:collectionName
 * 
 * PREREQUISITES:
 * - MongoDB Atlas connection configured in .env file
 * - IP address whitelisted in Atlas settings
 * - Test database access (uses 'slack_test' database)
 * 
 * These tests connect to a real MongoDB instance and verify end-to-end functionality.
 * Run these tests separately from unit tests when you have database connectivity.
 */

describe('GET /api/messages/:collectionName - Integration Tests', () => {
  let app;
  const TEST_DB_NAME = 'slack_test';
  const DB_USER = process.env.MONGODB_USER;
  const DB_PASSWORD = process.env.MONGODB_PASSWORD;
  const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;

  beforeAll(async () => {
    // Skip tests if no database credentials
    if (!DB_USER || !DB_PASSWORD) {
      console.warn('⚠ Skipping integration tests: MongoDB credentials not found in .env');
      return;
    }

    // Connect to test database
    await mongoose.connect(uri, { dbName: TEST_DB_NAME });

    // Setup Express app with router
    app = express();
    app.use(express.json());
    app.use(messagesRouter);
  }, 30000); // 30 second timeout for connection

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clean up test collections before each test
    if (mongoose.connection.readyState !== 1) return;
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const collection of collections) {
      if (collection.name.startsWith('test_')) {
        await mongoose.connection.db.dropCollection(collection.name);
      }
    }
  });

  describe('when database is accessible', () => {
    test('should return seeded documents from collection', async () => {
      if (!DB_USER || !DB_PASSWORD) {
        return; // Skip if no credentials
      }

      const collectionName = 'test_integration_messages';
      const testMessages = [
        { user: 'alice', type: 'message', text: 'Hello from integration test', ts: new Date() },
        { user: 'bob', type: 'message', text: 'This is a test message', ts: new Date() }
      ];

      // Seed the collection
      await mongoose.connection.db.collection(collectionName).insertMany(testMessages);

      // Make request
      const res = await request(app).get(`/api/messages/${collectionName}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('user', 'alice');
      expect(res.body[1]).toHaveProperty('user', 'bob');
      expect(res.body[0]).toHaveProperty('text', 'Hello from integration test');
    });

    test('should return empty array for non-existent collection', async () => {
      if (!DB_USER || !DB_PASSWORD) {
        return;
      }

      const collectionName = 'test_nonexistent_collection';
      const res = await request(app).get(`/api/messages/${collectionName}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return documents with extra fields beyond schema', async () => {
      if (!DB_USER || !DB_PASSWORD) {
        return;
      }

      const collectionName = 'test_extra_fields';
      const testMessages = [
        {
          user: 'charlie',
          type: 'message',
          text: 'Message with extra data',
          ts: new Date(),
          metadata: { priority: 'high', tags: ['test', 'important'] },
          attachments: [{ id: 1, url: 'http://example.com' }]
        }
      ];

      await mongoose.connection.db.collection(collectionName).insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${collectionName}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('metadata');
      expect(res.body[0]).toHaveProperty('attachments');
      expect(res.body[0].metadata).toHaveProperty('priority', 'high');
    });

    test('should handle documents missing schema fields', async () => {
      if (!DB_USER || !DB_PASSWORD) {
        return;
      }

      const collectionName = 'test_missing_fields';
      const testMessages = [
        { user: 'dave', type: 'message' }, // Missing text and ts
        { user: 'eve', text: 'Complete message', type: 'message', ts: new Date() }
      ];

      await mongoose.connection.db.collection(collectionName).insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${collectionName}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).not.toHaveProperty('text');
      expect(res.body[1]).toHaveProperty('text', 'Complete message');
    });

    test('should handle large result sets', async () => {
      if (!DB_USER || !DB_PASSWORD) {
        return;
      }

      const collectionName = 'test_large_collection';
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        user: `user${i}`,
        type: 'message',
        text: `Message number ${i}`,
        ts: new Date()
      }));

      await mongoose.connection.db.collection(collectionName).insertMany(largeDataset);

      const res = await request(app).get(`/api/messages/${collectionName}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(100);
    });
  });

  describe('edge cases', () => {
    test('should handle special characters in collection name', async () => {
      if (!DB_USER || !DB_PASSWORD) {
        return;
      }

      // MongoDB collection names have restrictions, but test valid special chars
      const collectionName = 'test_messages_2024_v1';
      const testMessages = [
        { user: 'frank', type: 'message', text: 'Special collection', ts: new Date() }
      ];

      await mongoose.connection.db.collection(collectionName).insertMany(testMessages);

      const res = await request(app).get(`/api/messages/${collectionName}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
