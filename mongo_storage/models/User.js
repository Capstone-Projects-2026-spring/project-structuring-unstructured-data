const mongoose = require('mongoose');
const { Schema } = require("mongoose");

const userSchema = new Schema(
  {
    team_id: String,
    name: String,
    real_name: String,
    is_admin: Boolean,
    is_owner: Boolean,
    is_bot: Boolean
  },
  { strict: false } // Ensures all raw fields are logged
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

// Returns a user model scoped to a database named from the channel key.
const getUserModel = (channelKey) => {
  const dbName = toChannelDbName(channelKey);
  const modelName = 'Member';
  const channelDb = mongoose.connection.useDb(dbName, { useCache: true });

  if (channelDb.models[modelName]) {
    return channelDb.models[modelName];
  }

  return channelDb.model(modelName, userSchema, 'members');
};

module.exports = { getUserModel };