const express = require('express');
const mongoose = require('mongoose');
const getUserModel = require('../models/User').getUserModel;
const insertModelsToDB = require('../../bolt_slack/slack_to_DB').insertModelsToDB;

const router = express.Router();

// GET /api/users/:collectionName - Retrieve information about members of a conversation from its designated collection
router.get('/api/users/:collectionName', async (req, res) => {
  try {
    // Get the model for the specified collection
    const { collectionName } = req.params;
    const User = getUserModel(collectionName);

    const result = await User.find();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } 
});

// POST /api/users/:channelName - insert all members of a channel into MongoDB
router.post('/api/users/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    
    // TODO: inserUserModels should be called within insertModelsToDB to ensure users are inserted before messages (to preserve referential integrity)
    // add logic to put users in a separate collection from messages (e.g. channelName_users)
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;