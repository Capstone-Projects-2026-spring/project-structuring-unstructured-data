# Slack Bot - Project Integration Guide

This document explains how the Slack bot integrates with the existing project APIs.

## Architecture Overview

```
┌─────────────────┐
│  Slack Channels │
│                 │
└────────┬────────┘
         │
         │ (Events, Commands)
         │
┌────────▼────────┐
│   Slack Bot     │ ← bolt_slack/app.js
│  (@slack/bolt)  │
└────────┬────────┘
         │
         │ (HTTP Requests)
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────────┐
│ GET   │ │ POST        │
│ API   │ │ API         │
└───┬───┘ └──┬──────────┘
    │        │
┌───▼────────▼───┐
│   MongoDB      │
│   Database     │
└────────────────┘
```

## Integration Points

### 1. Message Retrieval API
**Location**: `mongo_storage/routes/messages.js`
- **Endpoint**: `GET /api/messages/:collectionName`
- **Purpose**: Retrieve stored messages from MongoDB
- **Used by**: `/messages` slash command

### 2. Message Storage API
**Location**: `slack_retrieval/post_endpoint.js`
- **Endpoint**: `POST /api/slack/:channelName`
- **Purpose**: Store Slack messages to MongoDB
- **Used by**: `/store-messages` slash command

### 3. Slack API Integration
**Location**: `bolt_slack/app.js`
- **Purpose**: Direct Slack API calls for real-time data
- **Uses**: `@slack/bolt` library
- **Functions**:
  - `getConversationHistory()` - Fetch messages from Slack
  - `getConversationInfo()` - Get channel metadata

## Data Flow

### Storing Messages Flow
```
1. User runs: /store-messages in Slack channel
   ↓
2. Bot receives command event
   ↓
3. Bot calls: POST /api/slack/channel-name
   ↓
4. slack_retrieval/server.js processes request
   ↓
5. Messages fetched from Slack API
   ↓
6. Messages stored in MongoDB collection
   ↓
7. Bot sends success message to user
```

### Retrieving Messages Flow
```
1. User runs: /messages in Slack channel
   ↓
2. Bot receives command event
   ↓
3. Bot calls: GET /api/messages/channel-name
   ↓
4. mongo_storage/server.js processes request
   ↓
5. Messages retrieved from MongoDB
   ↓
6. Bot formats and displays messages in Slack
```

## Running the Complete System

You need to run three servers:

### 1. Message Storage API (GET)
```bash
# Terminal 1
cd mongo_storage
node server.js
# Default port: 3000
```

### 2. Message Retrieval API (POST)
```bash
# Terminal 2
cd slack_retrieval
node server.js
# Default port: 3000 (use different port if needed)
```

### 3. Slack Bot
```bash
# Terminal 3
cd bolt_slack
npm start
# Default port: 3000 (use different port if needed)
```

**Note**: If running all on the same machine, configure different ports:

```env
# bolt_slack/.env
PORT=3000

# mongo_storage/.env
PORT=3001

# slack_retrieval/.env
PORT=3002

API_BASE_URL=http://localhost:3001  # Points to mongo_storage
```

## Environment Variables

### Shared Variables (in root .env)
```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_BOT_USER_ID=U...
MONGODB_USER=...
MONGODB_PASSWORD=...
```

### Bot-Specific Variables
```env
API_BASE_URL=http://localhost:3000  # Your API server URL
PORT=3003                            # Bot server port
```

## API Endpoint Reference

### GET /api/messages/:collectionName
Retrieve messages from a specific channel's collection.

**Request:**
```bash
GET http://localhost:3000/api/messages/general
```

**Response:**
```json
[
  {
    "user": "U123456",
    "type": "message",
    "text": "Hello world",
    "ts": "1234567890.123456"
  }
]
```

### POST /api/slack/:channelName
Store messages from a Slack channel to MongoDB.

**Request:**
```bash
POST http://localhost:3000/api/slack/general
```

**Response:**
```json
{
  "message": "Messages from channel general inserted into the database successfully."
}
```

## Bot Commands

### Slash Commands

| Command | Description | API Endpoint Used |
|---------|-------------|-------------------|
| `/messages` | View recent messages | GET /api/messages/:collection |
| `/store-messages` | Store channel messages | POST /api/slack/:channel |
| `/channel-info` | Get channel info | Slack API (direct) |

### Mentions
- `@bot help` - Show help message
- `@bot status` - Check bot status

### Direct Messages
- Send "help" or "hi" to get bot information

## Error Handling

The bot handles several error scenarios:

1. **API Unavailable**: Falls back to direct Slack API
2. **Database Connection Failed**: Shows error message to user
3. **Permission Denied**: Guides user to add bot to channel
4. **Invalid Channel**: Provides helpful error message

## Security Considerations

1. **Token Security**:
   - Never commit `.env` files
   - Rotate tokens if exposed
   - Use environment variables in production

2. **API Access**:
   - Consider adding authentication to your APIs
   - Implement rate limiting
   - Validate Slack request signatures

3. **Data Privacy**:
   - Bot has access to channel messages
   - Store only necessary data
   - Comply with data retention policies

## Development vs Production

### Development Setup
- Use ngrok for local testing
- Three separate terminal windows
- All services on localhost
- Detailed logging enabled

### Production Setup
- Deploy all services to same server or different servers
- Use proper domain names (no ngrok)
- Configure reverse proxy (nginx/Apache)
- Enable HTTPS
- Use environment-specific configs
- Set up monitoring and logging

## Troubleshooting

### Bot doesn't respond
1. Check all three servers are running
2. Verify environment variables are set
3. Check Slack Event Subscriptions URL
4. Review server logs

### "API connection failed"
1. Verify API servers are running
2. Check `API_BASE_URL` configuration
3. Test API endpoints with curl/Postman
4. Check MongoDB connection

### Commands don't appear
1. Reinstall app to workspace
2. Verify slash commands are created
3. Check Request URLs are correct
4. Wait 30 seconds for Slack to sync

## Testing

### Test Configuration
```bash
cd bolt_slack
node test-config.js
```

### Test API Endpoints
```bash
# Test GET endpoint
curl http://localhost:3000/api/messages/test-channel

# Test POST endpoint
curl -X POST http://localhost:3000/api/slack/test-channel
```

### Test Bot
1. Add bot to test channel
2. Run `/channel-info`
3. Run `/store-messages`
4. Run `/messages`

## Monitoring

Watch logs in each terminal:

**Terminal 1** (mongo_storage):
```
App is listening on port 3001
```

**Terminal 2** (slack_retrieval):
```
Server is running on port 3002
```

**Terminal 3** (bolt_slack):
```
⚡️ Slack Bot is running!
📡 Listening on port 3003
```

## Next Steps

1. ✅ Set up Slack App (see QUICKSTART.md)
2. ✅ Configure environment variables
3. ✅ Start all three servers
4. ✅ Test bot in Slack channel
5. 🔄 Deploy to production (optional)
6. 🔄 Add custom features (optional)

## Additional Resources

- [Slack API Documentation](https://api.slack.com/)
- [Bolt Framework Guide](https://slack.dev/bolt-js/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- Project README.md files in each directory
