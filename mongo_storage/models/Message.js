const mongoose = require('mongoose');
const { Schema } = require("mongoose");

const msgSchema = new Schema(
  {
    user: { type: String, required: true },
    type: { type: String, required: true },
    text: { type: String, required: true },
    ts: { type: String, required: true }
  },
  { strict: false } // Ensures all raw fields are logged
);

// Enforce message identity: same user + same timestamp cannot be inserted twice.
// Partial filter avoids unique collisions for docs that don't include both fields.
msgSchema.index(
  { user: 1, ts: 1 },
  {
    unique: true,
    name: 'uniq_user_ts',
    partialFilterExpression: {
      user: { $exists: true, $type: 'string' },
      ts: { $exists: true, $type: 'string' },
    },
  }
);

const toChannelDbName = (channelKey) => {
  const sanitized = String(channelKey || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized) {
    throw new Error('A valid channel key is required');
  }

  return sanitized;
};

// Returns a message model scoped to a database named from the channel key.
const getMessageModel = (channelKey) => {
  const dbName = toChannelDbName(channelKey);
  const modelName = 'Message';
  const channelDb = mongoose.connection.useDb(dbName, { useCache: true });

  if (channelDb.models[modelName]) {
    return channelDb.models[modelName];
  }

  const model = channelDb.model(modelName, msgSchema, 'raw_messages');

  // Ensure indexes exist as each channel-specific collection is initialized.
  model.createIndexes().catch((error) => {
    console.error(`Failed creating indexes for ${dbName}.raw_messages:`, error.message);
  });

  return model;
};

module.exports = { getMessageModel };