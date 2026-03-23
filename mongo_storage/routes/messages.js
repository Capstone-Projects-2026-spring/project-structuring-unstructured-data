const express = require('express');
const mongoose = require('mongoose');
const getMessageModel = require('../models/Message').getMessageModel;
const { runModel } = require('../python')

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


router.get('/api/summary/all', async (req, res) => {
    try {
        runModel();

        const client = mongoose.connection.client;
        const result = {};

        const dbs = await client.db().admin().listDatabases();
        const summaryDbs = dbs.databases.filter(db =>
            db.name.endsWith('_cw') || db.name.endsWith('_pw')
        );

        for (const dbInfo of summaryDbs) {
            const db = client.db(dbInfo.name);
            result[dbInfo.name] = {};

            const collections = await db.listCollections().toArray();
            for (const col of collections) {
                const docs = await db.collection(col.name).find({}).toArray();
                result[dbInfo.name][col.name] = docs;
            }
        }

        res.status(200).json(result);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;