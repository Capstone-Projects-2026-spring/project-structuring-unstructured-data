const express = require('express');
require('dotenv').config();
const router = express.Router();
const { insertModelsToDB, insertSingleMessageToDB } = require('./slack_to_DB.js');

// POST - insert all messages from a channel into MongoDB
router.post('/api/slack/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const { message } = req.body;
    
    // If a single message is provided, store only that message
    if (message) {
      const result = await insertSingleMessageToDB(channelName, message);
      
      if (result.duplicate) {
        return res.status(200).json({ 
          message: 'Message already exists in database',
          duplicate: true 
        });
      }
      
      console.log(`Single message stored to ${channelName} collection`);
      return res.status(200).json({ 
        message: `Message stored to ${channelName} successfully`,
        duplicate: false 
      });
    }
    
    // Otherwise, fetch and store all messages from the channel
    await insertModelsToDB(channelName);
    
    console.log(`Messages from channel ${channelName} inserted into the database successfully.`);
    res.status(200).json({ message: `Messages from channel ${channelName} inserted into the database successfully.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;