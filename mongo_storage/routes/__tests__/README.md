# API Endpoint Tests

This directory contains unit tests and integration tests for the MongoDB storage API endpoints.

## Test Structure

```
mongo_storage/routes/__tests__/
├── messages.route.test.js        # Unit tests (mocked dependencies)
└── messages.integration.test.js  # Integration tests (real MongoDB)
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (re-run on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Types

### Unit Tests (`messages.route.test.js`)

**Purpose:** Verify route logic in isolation without database dependencies.

**Characteristics:**
- Fast execution (no network/database I/O)
- Mocks `getMessageModel` and Mongoose connection
- Tests route behavior, error handling, and HTTP responses
- No external dependencies required

**Test Cases:**
1. ✓ Returns 200 and messages array when `model.find()` succeeds
2. ✓ Returns empty array when collection has no documents
3. ✓ Returns 500 when `model.find()` throws an error
4. ✓ Handles different collection names correctly
5. ✓ Returns messages with extra fields beyond schema

**Run these frequently during development.**

---

### Integration Tests (`messages.integration.test.js`)

**Purpose:** Verify end-to-end functionality with a real MongoDB database.

**Prerequisites:**
- MongoDB Atlas connection configured in `.env` file:
  ```
  MONGODB_USER=your_username
  MONGODB_PASSWORD=your_password
  ```
- IP address whitelisted in Atlas security settings
- Network connectivity to MongoDB Atlas

**Characteristics:**
- Tests connect to `slack_test` database (separate from production)
- Real database operations (insert, find, drop collections)
- Slower execution (network + database I/O)
- Tests run in isolation (cleanup between tests)

**Test Cases:**
1. ✓ Returns seeded documents from collection
2. ✓ Returns empty array for non-existent collection
3. ✓ Returns documents with extra fields beyond schema
4. ✓ Handles documents missing schema fields
5. ✓ Handles large result sets (100+ documents)
6. ✓ Handles special characters in collection names

**Run these before commits/deployments.**

**Note:** Integration tests gracefully skip if database credentials are not available.

---

## Test Configuration

Jest configuration in `package.json`:
```json
{
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"],
    "testMatch": ["**/__tests__/**/*.test.js"]
  }
}
```

## Debugging Tests

To debug a specific test:
```bash
# Run a single test file
npm test -- messages.route.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="should return 200"

# Run with verbose output
npm test -- --verbose
```

## Best Practices

1. **Unit tests:** Test route logic and error handling with mocks
2. **Integration tests:** Verify real database interactions work correctly
3. **Cleanup:** Integration tests clean up test collections after each run
4. **Isolation:** Each test should be independent and not rely on others
5. **Naming:** Use `test_` prefix for integration test collection names

## Troubleshooting

### Unit Tests Fail
- Check that mocks are properly configured
- Verify Jest configuration in `package.json`
- Clear Jest cache: `npx jest --clearCache`

### Integration Tests Skip/Fail
- Verify `.env` file contains correct MongoDB credentials
- Check MongoDB Atlas IP whitelist includes your current IP
- Test database connectivity: try running `node server.js` manually
- Ensure `slack_test` database exists or can be created

### All Tests Timeout
- Increase Jest timeout in test file: `jest.setTimeout(30000)`
- Check for async operations without `await`
- Verify background processes aren't blocking

## CI/CD Integration

For automated testing pipelines:

```bash
# Run unit tests only (fast, no dependencies)
npm run test:unit

# Run integration tests with DB credentials from environment
MONGODB_USER=$DB_USER MONGODB_PASSWORD=$DB_PASS npm run test:integration
```

---

## Test Coverage

View coverage report after running `npm run test:coverage`:
- Coverage report in terminal
- Detailed HTML report in `coverage/` directory (open `coverage/index.html`)

Aim for:
- **Unit tests:** >80% coverage of route logic
- **Integration tests:** >90% coverage of happy paths and edge cases
