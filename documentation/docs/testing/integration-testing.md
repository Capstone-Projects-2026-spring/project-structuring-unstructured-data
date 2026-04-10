---
sidebar_position: 2
---
# Integration tests

Tests to demonstrate each use-case based on the use-case descriptions and the sequence diagrams. External input should be provided via mock objects and results verified via mock objects. Integration tests should not require manual entry of data nor require manual interpretation of results.


## MongoDB Storage Component

```bash
cd mongo_storage
npm run test:integration
```

**Purpose:** Verify end-to-end message route behavior through the Express router using mocked model/database operations.

**Prerequisites:**
- Node.js dependencies installed for the `mongo_storage` package (`npm install`)

**Test Cases:**

### Messages Route (`/api/messages/:channelName`)

- GET returns seeded documents from a channel-specific store
- GET returns empty array for a new channel with no messages
- GET returns documents with extra fields beyond schema
- GET handles documents missing expected schema fields
- GET handles large result sets (100 documents)
- GET supports special characters in channel name via sanitization
- POST inserts array payload and verifies persisted messages through GET
- POST inserts one message and reports duplicate on repeated user + ts

### Users Route (`/api/users/:channelName`)

- GET returns seeded channel members from a channel-specific store
- GET returns empty array for a channel with no members
- GET returns member documents with extra fields beyond schema
- POST inserts member arrays and verifies persisted members through GET
- POST returns validation error when `channelName` is blank

### Summaries Route (`/api/summaries/:databaseKey`)

- GET returns summaries for an existing channel summary database
- GET returns 404 when no matching summary database exists
- GET with `weekStart` returns the normalized one-week UTC summary window
- GET with invalid `weekStart` returns validation error
- POST with `week` runs summary generation and returns processing metadata
- POST with `weekStart` runs summary generation using canonicalized UTC week start
- POST rejects requests containing both `week` and `weekStart`
- POST rejects invalid `week` values outside the accepted range
- POST returns model execution errors from the summary generation pipeline
