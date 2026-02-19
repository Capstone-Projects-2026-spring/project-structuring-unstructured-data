const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');

const router = express.Router();

// GET /api/messages - Retrieve all messages from the database
router.get('/api/messages', async (req, res) => {
  try {
    console.log(await mongoose.connection.db.listCollections().toArray()); // Debug: List collections to verify connection
    const result = await Message.find();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } 
});

module.exports = router;