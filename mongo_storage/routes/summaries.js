const express = require('express');
const mongoose = require('mongoose');
// const { runModel } = require('../python');
const { buildChannelKey } = require('../../bolt_slack/slack_to_DB');

const router = express.Router();

// GET /api/summaries/all - Retrieve summary documents from summary databases.
router.get('/api/summaries/all', async (_req, res) => {
  try {
    // runModel('slack');

    const client = mongoose.connection.client;
    const result = {};

    const dbs = await client.db().admin().listDatabases();
    const summaryDbs = dbs.databases.filter(
      (db) => db.name.endsWith('_cw') || db.name.endsWith('_pw')
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summaries/:channelName - Retrieve all summary documents from a given channel database.
router.get('/api/summaries/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const dbName = await buildChannelKey(channelName);

    // runModel(dbName);

    const client = mongoose.connection.client;
    const db = client.db(dbName);
    const summaries = await db.collection('summaries').find({}).toArray();

    res.status(200).json({ dbName, summaries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
