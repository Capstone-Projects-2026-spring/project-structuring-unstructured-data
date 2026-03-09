---
sidebar_position: 2
---
# Integration tests

Tests to demonstrate each use-case based on the use-case descriptions and the sequence diagrams. External input should be provided via mock objects and results verified via mock objects. Integration tests should not require manual entry of data nor require manual interpretation of results.


## MongoDB Storage Component

```bash
cd mongo_storage/routes/__tests__/
npm run test:integration
```

**Purpose:** Verify end-to-end storage functionality with a real MongoDB database.

**Prerequisites:**
- MongoDB Atlas connection configured in `.env` file:
  ```
  MONGODB_USER=your_username
  MONGODB_PASSWORD=your_password
  ```
- IP address whitelisted in Atlas security settings
- Network connectivity to MongoDB Atlas

**Test Cases:**
- Returns seeded documents from collection
- Returns empty array for non-existent collection
- Returns documents with extra fields beyond schema
- Handles documents missing schema fields
- Handles large result sets (100+ documents)
- Handles special characters in collection names