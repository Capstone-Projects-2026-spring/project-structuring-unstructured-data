const express = require('express');
const getMessageModel = require('../models/Message').getMessageModel;

const router = express.Router();
const MB = 1024 * 1024;
const MAX_BSON_DOCUMENT_BYTES = 16 * MB;
const DEFAULT_BATCH_BYTES = 12 * MB;
const DEFAULT_BATCH_COUNT = 500;

const toByteSize = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BATCH_BYTES_LIMIT = toPositiveInt(process.env.MONGO_INSERT_BATCH_BYTES, DEFAULT_BATCH_BYTES);
const BATCH_COUNT_LIMIT = toPositiveInt(process.env.MONGO_INSERT_BATCH_COUNT, DEFAULT_BATCH_COUNT);

const insertManyInChunks = async (MessageModel, documents) => {
  const oversized = [];
  const writeFailures = [];
  let insertedCount = 0;
  let currentBatch = [];
  let currentBatchBytes = 0;

  const flushBatch = async () => {
    if (currentBatch.length === 0) {
      return;
    }

    const docsToInsert = currentBatch.map((item) => item.document);

    try {
      const inserted = await MessageModel.insertMany(docsToInsert, { ordered: false });
      insertedCount += inserted.length;
    } catch (err) {
      if (Array.isArray(err?.writeErrors)) {
        insertedCount += docsToInsert.length - err.writeErrors.length;
        for (const writeError of err.writeErrors) {
          const failedDoc = currentBatch[writeError.index];
          writeFailures.push({
            index: failedDoc.originalIndex,
            code: writeError.code,
            message: writeError.errmsg || writeError.message || 'Write error during batch insert'
          });
        }
      } else {
        throw err;
      }
    }

    currentBatch = [];
    currentBatchBytes = 0;
  };

  for (let i = 0; i < documents.length; i += 1) {
    const document = documents[i];

    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      writeFailures.push({
        index: i,
        code: 'INVALID_DOCUMENT',
        message: 'Each item in payload array must be a JSON object'
      });
      continue;
    }

    const documentBytes = toByteSize(document);

    // MongoDB BSON document limit is 16MB per document.
    if (documentBytes > MAX_BSON_DOCUMENT_BYTES) {
      oversized.push({
        index: i,
        bytes: documentBytes,
        limit: MAX_BSON_DOCUMENT_BYTES,
      });
      continue;
    }

    const wouldExceedBytes = currentBatchBytes + documentBytes > BATCH_BYTES_LIMIT;
    const wouldExceedCount = currentBatch.length >= BATCH_COUNT_LIMIT;

    if (wouldExceedBytes || wouldExceedCount) {
      await flushBatch();
    }

    currentBatch.push({ originalIndex: i, document });
    currentBatchBytes += documentBytes;
  }

  await flushBatch();

  return {
    insertedCount,
    oversized,
    writeFailures,
    totalReceived: documents.length,
  };
};

// GET /api/messages/:channelName - Retrieve all messages for a Slack channel database.
router.get('/api/messages/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const Message = getMessageModel(channelName);

    const result = await Message.find();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } 
});

// POST /api/messages/:channelName - insert all messages from a channel into MongoDB
router.post('/api/messages/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const bodyData = req.body;

    if (!channelName || !String(channelName).trim()) {
      return res.status(400).json({ error: 'channelName path parameter is required' });
    }
    
    // Get a model bound to the database resolved from channelName.
    const MessageModel = getMessageModel(channelName);
    
    if (Array.isArray(bodyData)) {
      const batchResult = await insertManyInChunks(MessageModel, bodyData);
      console.log(`Array payload received (${batchResult.totalReceived}) for channel ${channelName}; inserted=${batchResult.insertedCount}, oversized=${batchResult.oversized.length}, failed=${batchResult.writeFailures.length}`);

      if (batchResult.insertedCount === 0 && (batchResult.oversized.length > 0 || batchResult.writeFailures.length > 0)) {
        return res.status(413).json({
          error: 'No documents were inserted from array payload',
          insertedCount: batchResult.insertedCount,
          oversizedDocuments: batchResult.oversized,
          writeFailures: batchResult.writeFailures,
          maxBsonDocumentBytes: MAX_BSON_DOCUMENT_BYTES,
          maxBatchBytes: BATCH_BYTES_LIMIT,
          maxBatchCount: BATCH_COUNT_LIMIT,
        });
      }

      return res.status(200).json({
        message: `Messages from channel ${channelName} inserted into the database successfully.`,
        insertedCount: batchResult.insertedCount,
        skippedCount: batchResult.oversized.length + batchResult.writeFailures.length,
        oversizedDocuments: batchResult.oversized,
        writeFailures: batchResult.writeFailures,
        maxBsonDocumentBytes: MAX_BSON_DOCUMENT_BYTES,
        maxBatchBytes: BATCH_BYTES_LIMIT,
        maxBatchCount: BATCH_COUNT_LIMIT,
      });
    } else {
      if (!bodyData || typeof bodyData !== 'object') {
        return res.status(400).json({ error: 'Request body must be a JSON object or array of objects' });
      }

      const singleDocBytes = toByteSize(bodyData);
      if (singleDocBytes > MAX_BSON_DOCUMENT_BYTES) {
        return res.status(413).json({
          error: `Single document exceeds MongoDB 16MB BSON limit (${singleDocBytes} bytes)`,
          maxBsonDocumentBytes: MAX_BSON_DOCUMENT_BYTES,
        });
      }

      // If single message, check for duplicate by message identity (user + ts)
      const existingMessage = await MessageModel.findOne({ user: bodyData.user, ts: bodyData.ts });
      
      if (existingMessage) {
        console.log(`Message for user ${bodyData.user} with timestamp ${bodyData.ts} already exists in database`);
        return res.status(200).json({ message: 'Message already exists in database', duplicate: true });
      }
      
      const newMessage = new MessageModel({
        user: bodyData.user,
        type: bodyData.type || 'message',
        text: bodyData.text,
        ts: bodyData.ts
      });
      
      await newMessage.save();
      console.log(`Single message stored to ${channelName} database`);
      return res.status(200).json({ message: 'Message stored successfully', duplicate: false });
    }
  } catch (err) {
    console.error("Database insertion error:", err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;