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
let dotenv;
try {
  dotenv = require('dotenv');
} catch (_error) {
  try {
    // Render may install dependencies only under bolt_slack in this monorepo.
    dotenv = require('../bolt_slack/node_modules/dotenv');
  } catch (_innerError) {
    dotenv = null;
    console.warn('[DB] dotenv not found; relying on runtime environment variables only.');
  }
}

if (dotenv) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const DB_URI = process.env.MONGODB_URI;
const DB_CLUSTER_HOST = process.env.MONGODB_CLUSTER_HOST;

function buildMongoUri() {
  // Preferred: full connection string from environment.
  if (DB_URI && DB_URI.trim()) {
    return DB_URI.trim();
  }

  // Fallback: compose from parts (only if all required parts are present).
  if (DB_USER && DB_PASSWORD && DB_CLUSTER_HOST) {
    const encodedUser = encodeURIComponent(DB_USER);
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    return `mongodb+srv://${encodedUser}:${encodedPassword}@${DB_CLUSTER_HOST}/?retryWrites=true&w=majority`;
  }

  throw new Error(
    'Missing MongoDB configuration. Set MONGODB_URI (recommended) or set MONGODB_USER, MONGODB_PASSWORD, and MONGODB_CLUSTER_HOST.'
  );
}

function sanitizeMongoUri(uri) {
  // Hide credentials if present in URI logs.
  return uri.replace(/(mongodb\+srv:\/\/)([^:]+):([^@]+)@/i, '$1$2:***@');
}

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
      const mongoUri = buildMongoUri();
      console.log('[DB] Attempting to connect to MongoDB...');
      console.log('[DB] URI:', sanitizeMongoUri(mongoUri));
      
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
