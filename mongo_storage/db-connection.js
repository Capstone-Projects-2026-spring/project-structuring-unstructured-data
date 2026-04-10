/**
 * Shared MongoDB Connection Module
 * Used by both the API server and the Slack bot
 */

let mongoose;
try {
  mongoose = require('mongoose');
} catch (_error) {
  // Render may install dependencies only under bolt_slack in this monorepo.
  mongoose = require('../bolt_slack/node_modules/mongoose');
}
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;

// MongoDB connection URI
const mongoUri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.tnkp3.mongodb.net/?retryWrites=true&w=majority`;

let isConnected = false;
let connectionPromise = null;

/**
 * Connect to MongoDB
 * @returns {Promise} MongoDB connection promise
 */
async function connectToDatabase() {
  if (isConnected) {
    console.log('[DB] Already connected to MongoDB');
    return mongoose.connection;
  }
  
  if (connectionPromise) {
    console.log('[DB] Connection in progress, waiting...');
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      console.log('[DB] Attempting to connect to MongoDB...');
      console.log('[DB] URI:', mongoUri.replace(DB_PASSWORD, '***'));
      
      await mongoose.connect(mongoUri, {
        retryWrites: true,
        w: 'majority',
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      
      isConnected = true;
      console.log('[DB] ✅ Successfully connected to MongoDB');
      console.log('[DB] Connection state:', mongoose.connection.readyState);
      return mongoose.connection;
    } catch (error) {
      console.error('[DB] ❌ Failed to connect to MongoDB:', error.message);
      isConnected = false;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

/**
 * Get current connection status
 * @returns {boolean} True if connected
 */
function isConnectedToDatabase() {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Disconnect from MongoDB
 */
async function disconnectFromDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[DB] Disconnected from MongoDB');
  }
}

module.exports = {
  connectToDatabase,
  isConnectedToDatabase,
  disconnectFromDatabase,
  mongoose
};
