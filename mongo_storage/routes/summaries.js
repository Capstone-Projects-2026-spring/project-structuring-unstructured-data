const express = require('express');
const mongoose = require('mongoose');
const { runModel, runUserModel } = require('../python');
const {
  parseWeekQuery,
  toCanonicalWeekStartIso,
  toNextWeekIso,
} = require('../../shared-utils/dateUtils');
const e = require('express');

const router = express.Router();

// GET /api/summaries/all - Retrieve summary documents from summary databases.
router.get('/api/summaries/all', async (_req, res) => {
  try {
    console.log('[GET /api/summaries/all] Starting request');
    // runModel('slack');

    const client = mongoose.connection.client;
    const result = {};

    const dbs = await client.db().admin().listDatabases();
    console.log(`[GET /api/summaries/all] All databases: ${dbs.databases.map(db => db.name).join(', ')}`);

    const summaryDbs = dbs.databases.filter(
      (db) => db.name.endsWith('_cw') || db.name.endsWith('_pw')
    );
    console.log(`[GET /api/summaries/all] Summary databases (_cw/_pw): ${summaryDbs.map(db => db.name).join(', ')}`);

    for (const dbInfo of summaryDbs) {
      const db = client.db(dbInfo.name);
      result[dbInfo.name] = {};

      const collections = await db.listCollections().toArray();
      console.log(`[GET /api/summaries/all] Database ${dbInfo.name} has ${collections.length} collections`);

      for (const col of collections) {
        const docs = await db.collection(col.name).find({}).toArray();
        result[dbInfo.name][col.name] = docs;
        console.log(`[GET /api/summaries/all] Collection ${dbInfo.name}.${col.name} has ${docs.length} documents`);
      }
    }

    console.log('[GET /api/summaries/all] Request completed successfully');
    res.status(200).json(result);
  } catch (err) {
    console.error('[GET /api/summaries/all] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summaries/:databaseKey - Retrieve all summary documents from a given channel database. 
// NOTE: databaseKey includes channel name AND channelId retrieved from the Slack API
// Optional query params:
// - weekStart: Date or ISO timestamp used to retrieve exactly one week of summaries.
//   The value is normalized to UTC Sunday 00:00:00Z and used as a 7-day range query on summary_day_utc.
//   Examples:
//   - GET /api/summaries/myChannel_C123
//   - GET /api/summaries/myChannel_C123?weekStart=2026-04-05
//   - GET /api/summaries/myChannel_C123?weekStart=2026-04-05T00:00:00Z
router.get('/api/summaries/:databaseKey', async (req, res) => {
  try {
    const { databaseKey } = req.params;
    const { weekStart } = req.query;
    console.log(`[GET /api/summaries/:databaseKey] Received request for databaseKey: ${databaseKey}`);

    const client = mongoose.connection.client;

    // List all databases to find one with the exact requested name.
    const dbs = await client.db().admin().listDatabases();
    console.log(`[GET /api/summaries/:databaseKey] Available databases: ${dbs.databases.map(db => db.name).join(', ')}`);

    const matchingDb = dbs.databases.find((db) => db.name === databaseKey);

    if (!matchingDb) {
      console.warn(`[GET /api/summaries/:databaseKey] No database found for key: ${databaseKey}`);
      return res.status(404).json({ error: `No database found for channelKey: ${databaseKey}` });
    }

    console.log(`[GET /api/summaries/:databaseKey] Found matching database: ${matchingDb.name}`);

    const db = client.db(matchingDb.name);
    let query = {};
    let resolvedWeekStart = null;

    if (weekStart !== undefined) {
      resolvedWeekStart = toCanonicalWeekStartIso(weekStart);
      if (!resolvedWeekStart) {
        return res.status(400).json({ error: 'weekStart must be a valid date or ISO timestamp.' });
      }

      const nextWeek = toNextWeekIso(resolvedWeekStart);
      query = {
        summary_day_utc: {
          $gte: resolvedWeekStart,
          $lt: nextWeek,
        },
      };
    }

    const summaries = await db.collection('summaries').find(query).toArray();

    console.log(`[GET /api/summaries/:databaseKey] Retrieved ${summaries.length} summaries from ${matchingDb.name}`);

    res.status(200).json({ dbName: matchingDb.name, weekStart: resolvedWeekStart, summaries });
  } catch (err) {
    console.error(`[GET /api/summaries/:databaseKey] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/summaries/:databaseKey - Insert a summary document into the appropriate channel database using Gemini Python model. 
// NOTE: databaseKey includes channel name AND channelId retrieved from the Slack API
// Optional query params:
// - week: Integer 0..53. Generates summaries from messages that match this week number.
// - weekStart: Date or ISO timestamp. Converted to its UTC Sunday week start and used to choose the target week.
// Rules:
// - If neither is provided, the model infers the latest available week.
// - Provide only one of week or weekStart (sending both returns 400).
// Examples:
// - POST /api/summaries/myChannel_C123
// - POST /api/summaries/myChannel_C123?week=14
// - POST /api/summaries/myChannel_C123?weekStart=2026-04-05
router.post('/api/summaries/:databaseKey', async (req, res) => {
  try {
    const { databaseKey } = req.params;
    const { week, weekStart } = req.query;

    const parsedWeek = parseWeekQuery(week);
    if (!parsedWeek.ok) {
      return res.status(400).json({ error: parsedWeek.error });
    }

    const resolvedWeekStart = weekStart !== undefined ? toCanonicalWeekStartIso(weekStart) : undefined;
    if (weekStart !== undefined && !resolvedWeekStart) {
      return res.status(400).json({ error: 'weekStart must be a valid date or ISO timestamp.' });
    }

    if (parsedWeek.value !== undefined && resolvedWeekStart !== undefined) {
      return res.status(400).json({ error: 'Use either week or weekStart, not both.' });
    }

    const modelResult = await runModel(databaseKey, {
      week: parsedWeek.value,
      weekStart: resolvedWeekStart,
    });
    
    if (!modelResult.success) {
      console.warn(`[POST /api/summaries/:databaseKey] Model execution failed for ${databaseKey}: ${modelResult.error}`);
      return res.status(500).json({ error: modelResult.message, details: modelResult.error });
    }

    console.log(`[POST /api/summaries/:databaseKey] Model verification successful. Results:`, modelResult.results);
    console.log(`[POST /api/summaries/:databaseKey] Model processed summary data for databaseKey: ${databaseKey}`);
    
    res.status(200).json({
      message: 'Summary processing completed successfully',
      requestedWeek: parsedWeek.value,
      requestedWeekStart: resolvedWeekStart,
      savedCount: modelResult.savedCount,
      modelMetadata: modelResult.modelResult,
      modelResults: modelResult.results,
    });
  } catch (err) {
    console.error(`[POST /api/summaries/:databaseKey] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// USER SUMMARIES ROUTES

// GET /api/user_summaries/:databaseKey/:userId? - Retrieve user summary documents from a given channel database, optionally filtered by userId.
router.get('/api/user_summaries/:databaseKey/:userId?', async (req, res) => {
  try {
    const databaseKey  = req.params.databaseKey;
    const client = mongoose.connection.client;
    const dbs = await client.db().admin().listDatabases();
    const matchingDb = dbs.databases.find((db) => db.name === databaseKey);

    if (!matchingDb) {
      console.warn(`[GET /api/user_summaries/:databaseKey] No database found for key: ${databaseKey}`);
      return res.status(404).json({ error: `No database found for channelKey: ${databaseKey}` });
    }
    
    const db = client.db(matchingDb.name);

    if (req.query.userId) {
      const userId = req.query.userId;
      const userSummary = await db.collection('user_summaries').findOne({ user: userId });
      console.log(`[GET /api/user_summaries/:databaseKey] Retrieved user summary for userId ${userId} from ${matchingDb.name}:`, userSummary);
      return res.status(200).json({ dbName: matchingDb.name, userSummary });
    } else {
      const userSummaries = await db.collection('user_summaries').find({}).toArray();
      console.log(`[GET /api/user_summaries/:databaseKey] Retrieved ${userSummaries.length} user summaries from ${matchingDb.name}`);
      res.status(200).json({ dbName: matchingDb.name, userSummaries });
    }
  } catch (err) {
    console.error(`[GET /api/user_summaries/:databaseKey] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user_summaries/:databaseKey - Insert user summary documents into the appropriate channel database.
router.post('/api/user_summaries/:databaseKey', async (req, res) => {
  try {
    const { databaseKey } = req.params;
    const userSummaries = req.body;
    const client = mongoose.connection.client;

    const dbs = await client.db().admin().listDatabases();
    const matchingDb = dbs.databases.find((db) => db.name === databaseKey);
    if (!matchingDb) {
      console.warn(`[POST /api/user_summaries/:databaseKey] No database found for key: ${databaseKey}`);
      return res.status(404).json({ error: `No database found for channelKey: ${databaseKey}` });
    }
    const db = client.db(matchingDb.name);

    const modelResult = await runUserModel(databaseKey);
    
    if (!modelResult.success) {
      console.warn(`[POST /api/user_summaries/:databaseKey] User model execution failed for ${databaseKey}: ${modelResult.error}`);
      return res.status(500).json({ error: modelResult.message, details: modelResult.error });
    }

    console.log(`[POST /api/user_summaries/:databaseKey] User model execution successful. Results:`, modelResult.results);
    console.log(`[POST /api/user_summaries/:databaseKey] User summaries processed for databaseKey: ${databaseKey}`);
    
    res.status(200).json({
      message: 'User summaries processed successfully',
      databaseKey: databaseKey,
      modelMetadata: modelResult.modelResult,
      modelResults: modelResult.results,
    });
  } catch (err) {
    console.error(`[POST /api/user_summaries/:databaseKey] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
