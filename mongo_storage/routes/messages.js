const express = require('express');
const getMessageModel = require('../models/Message').getMessageModel;

const router = express.Router();

// GET /api/messages/:channelName - Retrieve messages for a Slack channel database.
router.get('/api/messages/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const hasValidLimit = Number.isInteger(requestedLimit) && requestedLimit > 0;
    const Message = getMessageModel(channelName);

    let query = Message.find();

    if (hasValidLimit) {
      // Return newest-first when caller requests a bounded recent window.
      query = query.sort({ ts: -1 }).limit(requestedLimit);
      const totalCount = await Message.countDocuments();
      res.set('X-Total-Count', String(totalCount));
    }

    const result = await query;
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } 
});

// POST /api/messages/:channelName - insert all messages from a channel into MongoDB
router.post('/api/messages/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const bodyData = req.body;

    if (!channelName || !String(channelName).trim()) {
      return res.status(400).json({ error: 'channelName path parameter is required' });
    }
    
    // Get a model bound to the database resolved from channelName.
    const MessageModel = getMessageModel(channelName);
    
    if (Array.isArray(bodyData)) {
      // If array of messages, do a bulk insert of history
      await MessageModel.insertMany(bodyData);
      console.log(`Array of ${bodyData.length} messages inserted into channel ${channelName}`);
      return res.status(200).json({ message: `Messages from channel ${channelName} inserted into the database successfully.` });
    } else {
      // If single message, check for duplicate and insert
      const existingMessage = await MessageModel.findOne({ ts: bodyData.ts });
      
      if (existingMessage) {
        console.log(`Message with timestamp ${bodyData.ts} already exists in database`);
        return res.status(200).json({ message: 'Message already exists in database', duplicate: true });
      }
      
      const newMessage = new MessageModel({
        user: bodyData.user,
        type: bodyData.type || 'message',
        text: bodyData.text,
        ts: bodyData.ts
      });
      
      await newMessage.save();
      console.log(`Single message stored to ${channelName} database`);
      return res.status(200).json({ message: 'Message stored successfully', duplicate: false });
    }
  } catch (err) {
    console.error("Database insertion error:", err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;