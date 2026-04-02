const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load from root directory

// Import routers
const messagesRouter = require('./routes/messages');
const usersRouter = require('./routes/users');
const summariesRouter = require('./routes/summaries');

// Import database credentials from .env file
const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const PORT = process.env.DB_PORT || process.env.PORT || 5000;

// initialize express app
const app = express();

// Set up middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next(); // Continue to next middleware/route
});

// Mount routers
app.use(messagesRouter);
app.use(usersRouter);
app.use(summariesRouter);

// Simple health endpoint for uptime checks
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

mongoose.set('strictQuery', true); // Suppress deprecation warning for strictQuery

// Use local MongoDB URI if available, otherwise fall back to Atlas
const MONGODB_LOCAL = process.env.MONGODB_LOCAL === 'true';
let uri;

if (MONGODB_LOCAL) {
  // For local MongoDB, use the MONGODB_URI directly or construct it with properly encoded credentials
  uri = process.env.MONGODB_URI || `mongodb://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/test`;
} else {
  uri = `mongodb+srv://${encodeURIComponent(DB_USER || '')}:${encodeURIComponent(DB_PASSWORD || '')}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;
}

if (MONGODB_LOCAL) {
  console.log(`Connecting to MongoDB (Local: ${MONGODB_LOCAL}) at host: ${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}`);
} else {
  console.log(`Connecting to MongoDB Atlas (suds-cluster.poxtvnp.mongodb.net)`);
}

// Connect to MongoDB using Mongoose
const start = async () => {
  try {
    if (!DB_USER || !DB_PASSWORD) {
      throw new Error('MONGODB_USER and MONGODB_PASSWORD must be set in the environment');
    }

    // Connect once to the Mongo cluster; channel-specific databases are selected later via useDb.
    await mongoose.connect(uri, {
      authSource: 'admin'  // Specify the auth database for local MongoDB
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongo connection error:', err);
    });

    app.listen(PORT, () => {
      console.log("App is listening on port " + PORT);
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
module.exports.start = start;
