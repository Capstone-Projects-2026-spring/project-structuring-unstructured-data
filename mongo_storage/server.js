const express = require('express');
const mongoose = require('mongoose');
const Message = require('./models/Message');

require('dotenv').config({ path: '../.env' });

const app = express();
mongoose.set('strictQuery', true); // Suppress deprecation warning for strictQuery


const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const PORT = process.env.PORT;

// Fill in .env file with your database username and password. Also ensure your IP address is whitelisted in your Atlas settings.
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

const newMessage = new Message({
  name: "Test Message",
  msg_size: 123,
  msg: "This is a test message.",
  date: new Date()
});


// GET /api/messages - Retrieve all messages from the database
app.get('/api/messages', async (req, res) => {
  try {
    console.log(await mongoose.connection.db.listCollections().toArray()); // Debug: List collections to verify connection
    const result = await Message.find();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } 
});
