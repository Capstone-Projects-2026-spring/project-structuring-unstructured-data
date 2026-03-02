const express = require('express');
require('dotenv').config();
const router = express.Router();
const { connectDB, insertMessagesToDB } = require('./mongo_data');

// POST - insert all messages from a channel into MongoDB
router.post('/api/slack/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    
    insertMessagesToDB(channelName);
    
    console.log(`Messages from channel ${channelName} inserted into the database successfully.`);
    res.status(200).json({ message: `Messages from channel ${channelName} inserted into the database successfully.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;