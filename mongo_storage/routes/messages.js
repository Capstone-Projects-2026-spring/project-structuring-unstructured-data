const express = require('express');
const mongoose = require('mongoose');
const getMessageModel = require('../models/Message').getMessageModel;

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

// GET /api/insights/week/:collectionName - Basic dashboard insights for current week
router.get('/api/insights/week/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    const Message = getMessageModel(collectionName);

    // Compute start of week (Monday 00:00) and end (now)
    const now = new Date();
    const day = now.getDay(); // 0=Sun,1=Mon...
    const diffToMonday = (day === 0 ? 6 : day - 1); // if Sunday, go back 6
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Pull messages for the week (Slack ts can be string/number; we'll filter in JS if needed)
    const messages = await Message.find({}).lean();

    const weekMessages = messages.filter(m => {
      const tsDate = new Date(parseFloat(m.ts) * 1000);
      return !isNaN(tsDate) && tsDate >= startOfWeek && tsDate <= now;
    });

    const messageCount = weekMessages.length;

    // Active users + top users
    const userCounts = {};
    for (const msg of weekMessages) {
      if (!msg.user) continue;
      userCounts[msg.user] = (userCounts[msg.user] || 0) + 1;
    }

    const activeUsers = Object.keys(userCounts).length;
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user, count]) => ({ user, count }));

    res.status(200).json({
      collectionName,
      startOfWeek: startOfWeek.toISOString(),
      end: now.toISOString(),
      messageCount,
      activeUsers,
      topUsers
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// POST - insert messages (single or array) from a channel into MongoDB
router.post('/api/messages/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const bodyData = req.body;
    
    // Get the model for the given channel collection
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
      console.log(`Single message stored to ${channelName} collection`);
      return res.status(200).json({ message: 'Message stored successfully', duplicate: false });
    }
  } catch (err) {
    console.error("Database insertion error:", err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;