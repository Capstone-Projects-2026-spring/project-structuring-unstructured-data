const express = require('express');
const getUserModel = require('../models/User').getUserModel;

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
    const membersData = req.body;

    if (!channelName || !String(channelName).trim()) {
      return res.status(400).json({ error: 'channelName path parameter is required' });
    }

    const UserModel = getUserModel(channelName);
    await UserModel.insertMany(membersData);
    console.log(`Array of ${membersData.length} members inserted into channel ${channelName}`);
    return res.status(200).json({ message: `Members from channel ${channelName} inserted into the database successfully.` });
  } catch (err) {
    console.error("Database insertion error:", err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;