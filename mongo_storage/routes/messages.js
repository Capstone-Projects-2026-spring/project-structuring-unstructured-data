const express = require('express');
const mongoose = require('mongoose');
const getMessageModel = require('../models/Message').getMessageModel;
const insertModelsToDB = require('../../bolt_slack/slack_to_DB').insertModelsToDB;

const router = express.Router();

// GET /api/messages/:collectionName - Retrieve all messages in a conversation from its designated collection
router.get('/api/messages/:collectionName', async (req, res) => {
  try {
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

// POST - insert all messages from a channel into MongoDB
router.post('/api/messages/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    
    await insertModelsToDB(channelName);
    
    console.log(`Messages from channel ${channelName} inserted into the database successfully.`);
    res.status(200).json({ message: `Messages from channel ${channelName} inserted into the database successfully.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;