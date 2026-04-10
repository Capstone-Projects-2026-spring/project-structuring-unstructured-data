---
sidebar_position: 1
---
# Unit tests
Unit tests isolate each router method and verify behavior with mocked dependencies.
Each test case below lists the input values, mocked behavior, and expected output.

## MongoDB Storage Component

**To run tests:**
```bash
cd mongo_storage
npm run test:unit
```

**Purpose:** Verify custom database routing logic in isolation without database or Python dependencies.

**Mocking strategy:**
- `mongoose` is mocked to a disconnected connection so no live database is opened.
- `../../models/Message` is mocked so `getMessageModel()` returns route-specific method stubs.
- `../../models/User` is mocked so `getUserModel()` returns route-specific method stubs.
- `../../python` is mocked in `summaries.route.test.js` so `runModel()` never invokes Python during unit tests.
- `../../../bolt_slack/slack_to_DB` is mocked in `messages.route.test.js` so Slack ingestion helpers never run.
- For summary DB reads, `mongoose.connection.client` is replaced with in-memory client mocks for `listDatabases()`, `collection().find()`, and `listCollections()` flows.
- Route tests assert HTTP responses and model calls only; no external services are used.

### Messages Route (`/api/messages/:channelName`)

**Test cases:**

| Test case | Inputs | Mocked dependency behavior | Expected output |
| --- | --- | --- | --- |
| GET returns messages when `model.find()` succeeds | `GET /api/messages/testCollection` | `getMessageModel('testCollection')` returns `{ find: mockFind }`, and `mockFind` resolves to two message objects | HTTP 200; response body contains the two messages; `getMessageModel` called with `testCollection`; `mockFind` called once with no args |
| GET returns empty array when collection has no documents | `GET /api/messages/emptyCollection` | `mockFind` resolves to `[]` | HTTP 200; response body is `[]` |
| GET returns 500 when `model.find()` throws | `GET /api/messages/failCollection` | `mockFind` rejects with `Database connection failed` | HTTP 500; response text is `Server Error`; `console.error` receives the thrown error |
| GET handles different collection names correctly | `GET /api/messages/collection1`, then `GET /api/messages/collection2` | `getMessageModel` is mocked for each collection name | `getMessageModel` called with each collection name; called twice total |
| GET returns extra fields beyond schema | `GET /api/messages/extendedCollection` | `mockFind` resolves to a message object with `extraField1` and `metadata` | HTTP 200; response body preserves extra fields |
| GET returns limited newest-first results | `GET /api/messages/testCollection?limit=2` | `find()` returns a query object with `sort()` and `limit()`; `countDocuments()` resolves to `2`; `limit()` resolves to two ordered messages | HTTP 200; `X-Total-Count: 2`; `sort({ ts: -1 })` and `limit(2)` are called |
| POST returns success for a single array insert | `POST /api/messages/test-channel` with one message array item | `insertMany()` resolves with the inserted message | HTTP 200; response body message says the channel was inserted successfully; `insertMany()` called with `[mockMessage]` and `{ ordered: false }` |
| POST returns 400 when insertion fails | `POST /api/messages/test-channel` with `[{}]` | `insertMany()` rejects with `Database insertion failed` | HTTP 400; response body contains the error message |
| DELETE removes a message by timestamp | `DELETE /api/messages/test-channel/1234567890.123456` | `deleteOne({ ts })` resolves with `{ deletedCount: 1 }` | HTTP 200; response body is `{ message: 'Message deleted successfully' }`; `deleteOne()` called with `{ ts }` |
| DELETE returns 404 when no message matches | `DELETE /api/messages/test-channel/1234567890.123456` | `deleteOne({ ts })` resolves with `{ deletedCount: 0 }` | HTTP 404; response body is `{ error: 'Message not found' }` |

### Users Route (`/api/users/:channelName`)

**Test cases:**

| Test case | Inputs | Mocked dependency behavior | Expected output |
| --- | --- | --- | --- |
| GET returns users when `model.find()` succeeds | `GET /api/users/testCollection` | `getUserModel('testCollection')` returns `{ find: mockFind }`, and `mockFind` resolves to two user objects | HTTP 200; response body contains both users; `getUserModel` called with `testCollection`; `mockFind` called once |
| GET returns empty array when collection has no documents | `GET /api/users/emptyCollection` | `mockFind` resolves to `[]` | HTTP 200; response body is `[]` |
| GET returns 500 when `model.find()` throws | `GET /api/users/failCollection` | `mockFind` rejects with `Database connection failed` | HTTP 500; response text is `Server Error`; `console.error` receives the thrown error |
| GET handles different collection names correctly | `GET /api/users/collection1`, then `GET /api/users/collection2` | `getUserModel` is mocked for each collection name | `getUserModel` called with each collection name; called twice total |
| GET returns extra fields beyond schema | `GET /api/users/extendedCollection` | `mockFind` resolves to a user object with `profile` and `timezone` | HTTP 200; response body preserves extra fields |
| POST inserts a member array successfully | `POST /api/users/test-channel` with two member objects | `insertMany()` resolves successfully | HTTP 200; response body says the members were inserted successfully; `insertMany()` called with the payload |
| POST returns 400 when insertion fails | `POST /api/users/test-channel` with `[{}]` | `insertMany()` rejects with `Database insertion failed` | HTTP 400; response body contains the error message |
| POST rejects a blank channel name | `POST /api/users/%20%20%20` with `[ { name: 'alice' } ]` | `getUserModel` is not called because validation fails first | HTTP 400; response body is `{ error: 'channelName path parameter is required' }` |

### Summaries Route (`/api/summaries/:databaseKey`)

**Test cases:**

| Test case | Inputs | Mocked dependency behavior | Expected output |
| --- | --- | --- | --- |
| GET returns summaries for an existing database | `GET /api/summaries/channel_C123` | `mongoose.connection.client.db().admin().listDatabases()` includes `channel_C123`; `collection('summaries').find({}).toArray()` resolves to three summary docs | HTTP 200; response includes `dbName: channel_C123`, `weekStart: null`, and three summaries |
| GET returns 404 when database key is missing | `GET /api/summaries/unknown_db` | mocked `listDatabases()` omits `unknown_db` | HTTP 404; response is `{ error: 'No database found for channelKey: unknown_db' }` |
| GET with `weekStart` canonicalizes to UTC Sunday and filters one week | `GET /api/summaries/channel_C123?weekStart=2026-04-10` | summaries mock includes docs across week boundaries; query filter applies `$gte/$lt` week window | HTTP 200; `weekStart` becomes `2026-04-05T00:00:00Z`; response includes only docs in that week |
| GET rejects invalid `weekStart` | `GET /api/summaries/channel_C123?weekStart=invalid-date` | no model run; validation fails in route | HTTP 400; response is `{ error: 'weekStart must be a valid date or ISO timestamp.' }` |
| POST with `week` calls model and returns metadata | `POST /api/summaries/channel_C123?week=14` | `runModel()` resolves `{ success: true, savedCount: 2, ... }` | HTTP 200; `runModel('channel_C123', { week: 14, weekStart: undefined })` called; response includes success message and `savedCount: 2` |
| POST with `weekStart` canonicalizes and calls model | `POST /api/summaries/channel_C123?weekStart=2026-04-10` | `runModel()` resolves success | HTTP 200; `runModel()` called with canonicalized `weekStart: 2026-04-05T00:00:00Z` |
| POST rejects mixed `week` and `weekStart` | `POST /api/summaries/channel_C123?week=14&weekStart=2026-04-05` | validation branch; `runModel()` not called | HTTP 400; response is `{ error: 'Use either week or weekStart, not both.' }` |
| POST rejects out-of-range `week` | `POST /api/summaries/channel_C123?week=90` | validation branch; `runModel()` not called | HTTP 400; response is `{ error: 'week query must be an integer between 0 and 53.' }` |
| POST rejects invalid `weekStart` | `POST /api/summaries/channel_C123?weekStart=invalid-date` | validation branch; `runModel()` not called | HTTP 400; response is `{ error: 'weekStart must be a valid date or ISO timestamp.' }` |
| POST returns 500 when model execution fails | `POST /api/summaries/channel_C123` | `runModel()` resolves `{ success: false, message: ..., error: ... }` | HTTP 500; response body includes model failure `error` and `details` |