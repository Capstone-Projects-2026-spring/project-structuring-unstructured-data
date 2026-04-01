const express = require('express');
const mongoose = require('mongoose');
const { runModel } = require('../python');
const { buildChannelKey } = require('../../bolt_slack/slack_to_DB');

const router = express.Router();

// GET /api/summary/all - Retrieve summary documents from summary databases.
router.get('/api/summary/all', async (_req, res) => {
  try {
    runModel('slack');

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

// GET /api/summary/:channelName - Retrieve all summary documents from a given channel database.
router.get('/api/summary/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const dbName = buildChannelKey(channelKey);

    runModel(dbName);

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

module.exports = router;
