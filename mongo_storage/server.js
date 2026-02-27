const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Import routers
const messagesRouter = require('./routes/messages');

// Import database credentials from .env file
const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const PORT = process.env.PORT;

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

module.exports = app;
mongoose.set('strictQuery', true); // Suppress deprecation warning for strictQuery

// Fill in .env file with your database username and password. 
// Also ensure your IP address is whitelisted in your Atlas settings.
const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;


// Connect to MongoDB Atlas using Mongoose
const start = async() => {
  try {
    // Mongoose v6+ does not require useNewUrlParser/useUnifiedTopology options
    await mongoose.connect(uri, { dbName: 'slack' });

    app.listen(PORT, () => {
      console.log("App is listening on port " + PORT);
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
}
start();
