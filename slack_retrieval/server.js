const express = require('express');
const mongodb = require('mongodb');
const { connectDB} = require('./mongo_data.js');
require('dotenv').config({ path: '../.env' });

// Imports router and initializes express app
const slackRouter = require('./post_endpoint');
const app = express();

//Imports Port from .env
const PORT = process.env.PORT;

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
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup error:", error);
    }
}

start();
