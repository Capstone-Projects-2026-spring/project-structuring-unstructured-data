const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Load from root directory

// Imports router and initializes express app
const slackRouter = require('./post_endpoint');
const app = express();


// Import credentials from .env file
const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const PORT = process.env.SLACK_RETRIEVAL_PORT || 3002; // Use dedicated port

app.use(express.json());
app.use(slackRouter);


// Custom middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next(); // Continue to next middleware/route
});

// Connects to MongoDB
async function start() {
    try {
        //Connects to the Database
        const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;
        await mongoose.connect(uri, {dbName: "slack"});

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup error:", error);
    }
}

start();
