const express = require('express');
require('dotenv').config();
const router = express.Router();
const { insertModelsToDB } = require('./slack_to_DB.js');

// POST - insert all messages from into MongoDB
router.post('/api/slack/all_messages', async (req, res) => {
  try {
    
    await insertModelsToDB();
    
    console.log(`Messages from the workspace has been inserted into the database successfully.`);
    res.status(200).json({ message: `Messages from the workspace has been inserted into the database successfully.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;