const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const getMessageModel = require('../models/Message');

const router = express.Router();

// GET /api/messages/:collectionName - Retrieve all messages in a conversation from its designated collection
router.get('/api/messages/:collectionName', async (req, res) => {
  try {
    console.log(await mongoose.connection.db.listCollections().toArray()); // Debug: List collections to verify connection
    
    // Get the model for the specified collection
    const { collectionName } = req.params;
    const Message = getMessageModel(collectionName);

    const result = await Message.find();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } 
});

module.exports = router;