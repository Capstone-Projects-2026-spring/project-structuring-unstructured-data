const mongoose = require('mongoose');
const { Schema, model } = require("mongoose");
require('dotenv').config({ path: '../.env' });

const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;


// Fill in .env file with your database username and password. Also ensure your IP address is whitelisted in your Atlas settings.
const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;

// Connect to MongoDB Atlas using Mongoose
async function connectToAtlas() {
  try {
    // Mongoose v6+ does not require useNewUrlParser/useUnifiedTopology options
    await mongoose.connect(uri); 
    console.log("Mongoose is connected");

    
  } catch (error) {
    console.error("Could not connect:", error.message);
    process.exit(1);
  }
}

connectToAtlas();