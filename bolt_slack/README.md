# Slack API Bot

An interactive Slack bot that can be added to channels to access your API for storing and retrieving messages.

## Features

- 💾 **Interactive Message Storage**: Private prompts to save messages to database (NEW!)
- 🤖 **Interactive Bot**: Responds to mentions, commands, and direct messages
- 📬 **Message Management**: Store and retrieve channel messages via API
- 📊 **Channel Information**: Get detailed information about channels
- 🔄 **Real-time Integration**: Connects Slack channels with your MongoDB API
- ⚡ **Slash Commands**: Easy-to-use commands for common operations

## Quick Feature Overview

### 🆕 Interactive Message Storage
When someone posts a message, the bot shows a **private prompt** (only they can see) with buttons:
- Click **✅ Yes, Save** to save the message to database
- Click **❌ No, Skip** to skip saving
- The prompt updates in-place with confirmation
- Confirmation messages auto-clear after 1 minute
- **Complete privacy**: Other users never see the prompts

See [INTERACTIVE-FEATURE.md](INTERACTIVE-FEATURE.md) for detailed documentation.

## Setup Instructions

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "API Bot") and select your workspace
4. Click "Create App"

### 2. Configure Bot Permissions

Navigate to **OAuth & Permissions** and add these **Bot Token Scopes**:

- `app_mentions:read` - View messages that mention the bot
- `channels:history` - View messages in public channels
- `channels:read` - View basic channel info
- `chat:write` - Send messages as the bot
- `commands` - Add slash commands
- `im:history` - View direct messages
- `im:read` - View basic direct message info
- `im:write` - Send direct messages
- `reactions:read` - View reactions on messages (for interactive storage)
- `reactions:write` - Add reactions to messages (for interactive storage)
- `users:read` - View users in workspace

### 3. Set Up Slash Commands

Navigate to **Slash Commands** and create these commands:

#### `/messages`
- **Command**: `/messages`
- **Request URL**: `https://your-server.com/slack/events` (or your ngrok URL during dev)
- **Short Description**: Retrieve recent messages from this channel
- **Usage Hint**: (leave empty)

#### `/store-messages`
- **Command**: `/store-messages`
- **Request URL**: `https://your-server.com/slack/events`
- **Short Description**: Store channel messages to database
- **Usage Hint**: (leave empty)

#### `/channel-info`
- **Command**: `/channel-info`
- **Request URL**: `https://your-server.com/slack/events`
- **Short Description**: Get channel information
- **Usage Hint**: (leave empty)

### 4. Enable Event Subscriptions

Navigate to **Event Subscriptions**:

1. Turn on "Enable Events"
2. Set **Request URL**: `https://your-server.com/slack/events`
3. Subscribe to these **Bot Events**:
   - `app_mention` - When the bot is mentioned
   - `member_joined_channel` - When the bot joins a channel
   - `message.channels` - Channel messages (for interactive storage feature)
   - `message.im` - Direct messages to the bot
   - `reaction_added` - When reactions are added (for interactive storage feature)

### 5. Install the App to Your Workspace

1. Navigate to **OAuth & Permissions**
2. Click "Install to Workspace"
3. Review permissions and click "Allow"
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 6. Configure Environment Variables

Create or update your `.env` file in the project root:

```env
# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_BOT_USER_ID=U1234567890

# API Configuration
API_BASE_URL=http://localhost:3000
PORT=3000

# MongoDB Configuration (for your API)
MONGODB_USER=your-mongodb-username
MONGODB_PASSWORD=your-mongodb-password
```

To find these values:
- **SLACK_BOT_TOKEN**: OAuth & Permissions → Bot User OAuth Token
- **SLACK_SIGNING_SECRET**: Basic Information → App Credentials → Signing Secret
- **SLACK_BOT_USER_ID**: Basic Information → App ID (or check in workspace)

### 7. Install Dependencies

```bash
cd bolt_slack
npm install
```

### 8. Start the Bot

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

### 9. Expose Your Local Server (Development)

If testing locally, use ngrok to expose your server:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and update:
- Event Subscriptions → Request URL
- Slash Commands → Request URLs

## Usage

### Add Bot to a Channel

1. In Slack, go to any channel
2. Type `/invite @YourBotName`
3. The bot will send a welcome message with available commands

### Available Commands

#### In Channels:

- **`/messages`** - Retrieve recent messages from the database
- **`/store-messages`** - Store current channel messages to the database
- **`/channel-info`** - Get detailed channel information
- **`@BotName help`** - Show help message
- **`@BotName status`** - Check bot status

#### Direct Messages:

- Send "help" or "hi" to get information about the bot

### API Integration

The bot integrates with your existing API endpoints:

- **GET** `/api/messages/{channelName}` - Retrieve messages
- **POST** `/api/slack/{channelName}` - Store messages

## Project Structure

```
bolt_slack/
├── app.js              # Main bot application
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## Bot Features Explained

### Event Listeners

- **`member_joined_channel`**: Sends welcome message when bot joins a channel
- **`app_mention`**: Responds when bot is mentioned with @
- **`message`**: Handles direct messages to the bot

### Slash Commands

- Provides interactive UI for common operations
- Shows results directly in Slack
- Handles errors gracefully

### API Integration

- Fetches messages from your MongoDB API
- Stores messages to database via API
- Falls back to direct Slack API if backend is unavailable

## Troubleshooting

### Bot doesn't respond to commands

1. Check that the bot is running: `npm start`
2. Verify environment variables are set correctly
3. Check Slack App Event Subscriptions URL is correct
4. Review bot permissions in Slack App settings

### "API connection failed" messages

1. Ensure your API servers are running:
   - `mongo_storage/server.js` for GET endpoints
   - `slack_retrieval/server.js` for POST endpoints
2. Check `API_BASE_URL` in `.env`
3. Verify MongoDB connection credentials

### Slash commands don't appear

1. Reinstall the app to your workspace
2. Check that commands are created in Slack App settings
3. Verify Request URLs are correct

### Bot can't see messages

1. Check bot has required permissions (see Setup step 2)
2. Ensure bot is added to the channel (`/invite @BotName`)
3. Verify `channels:history` scope is granted

## Development

### Testing Locally

1. Start ngrok: `ngrok http 3000`
2. Update Slack App URLs with ngrok URL
3. Start bot: `npm start`
4. Test commands in Slack

### Logging

The bot logs all operations to console:
- ✅ Success operations
- ❌ Errors with details
- 🚀 API calls
- 📡 Server status

### Extending the Bot

To add new commands:

1. Add command in Slack App settings
2. Add `app.command()` handler in `app.js`
3. Implement the command logic
4. Test in Slack

## API Endpoints Reference

Your backend should have these endpoints running:

### mongo_storage (Port 3000)
- `GET /api/messages/:collectionName` - Retrieve messages

### slack_retrieval (Port 3000)
- `POST /api/slack/:channelName` - Store messages

Make sure these servers are running before using the bot.

## Security Notes

- Never commit `.env` file with real credentials
- Use environment variables for all sensitive data
- Rotate tokens if accidentally exposed
- Restrict bot permissions to minimum required
- Use HTTPS for production deployments

## License

Part of the project-structuring-unstructured-data project.
