---
sidebar_position: 1
---
# Unit tests
For each method, one or more test cases.

A test case consists of input parameter values and expected results.

All external classes should be stubbed using mock objects.

## MongoDB Storage Component

**To run tests:**
```bash
cd mongo_storage/routes/__tests__/
npm run test:unit
```

**Purpose:** Verify custom database routing logic in isolation without database dependencies.

**Test Cases:**
- Returns 200 and messages array when `model.find()` succeeds
- Returns empty array when collection has no documents
- Returns 500 when `model.find()` throws an error
- Handles different collection names correctly
- Returns messages with extra fields beyond schema