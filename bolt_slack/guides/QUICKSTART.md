# Quick Start Guide - Slack Bot Setup

This guide will help you get your Slack bot up and running in under 10 minutes.

## ⚡ Recommended: Socket Mode (No ngrok needed!)

**Socket Mode** is the easiest way to run your bot locally - no public URL or tunneling required!

See [SOCKET-MODE-SETUP.md](SOCKET-MODE-SETUP.md) for detailed Socket Mode instructions.

## Alternative: HTTP Mode with ngrok

If you prefer HTTP mode or need it for production, see [TUNNEL-ALTERNATIVES.md](TUNNEL-ALTERNATIVES.md) for options.

## Prerequisites

- Node.js installed (v14 or higher)
- A Slack workspace where you have admin permissions
- MongoDB Atlas account (already configured in your project)

## Step-by-Step Setup

### 1. Create Slack App (2 minutes)

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `API Bot` (or your preferred name)
4. Select your workspace
5. Click **"Create App"**

### 2. Add Permissions (2 minutes)

Go to **"OAuth & Permissions"** in the sidebar, scroll to **"Scopes"**, and add these **Bot Token Scopes**:

```
✓ app_mentions:read
✓ channels:history
✓ channels:read
✓ chat:write
✓ commands
✓ im:history
✓ im:read
✓ im:write
✓ reactions:read    (NEW - for interactive storage)
✓ reactions:write   (NEW - for interactive storage)
✓ users:read
```

Click **"Save Changes"** after adding all scopes.

### 3. Create Slash Commands (3 minutes)

Go to **"Slash Commands"** in the sidebar, click **"Create New Command"** for each:

**Command 1:**
- Command: `/messages`
- Request URL: `https://your-domain.com/slack/events` (we'll update this)
- Short Description: `Retrieve recent messages from this channel`

**Command 2:**
- Command: `/store-messages`
- Request URL: `https://example.com` (Socket Mode doesn't use this)
- Short Description: `Store channel messages to database`

**Command 3:**
- Command: `/channel-info`
- Request URL: `https://example.com` (Socket Mode doesn't use this)
- Short Description: `Get channel information`

### 4. Enable Socket Mode (1 minute) ⚡ NEW!

**This eliminates the need for ngrok!**

1. Go to **"Socket Mode"** in sidebar
2. Toggle **"Enable Socket Mode"** to **ON**
3. Click **"Generate an app-level token"**
4. Token Name: `socket-token`
5. Add scope: `connections:write`
6. Click **"Generate"**
7. **Copy the app token** (starts with `xapp-`) - you'll need this!

### 5. Install App to Workspace (1 minute)

1. Go to **"OAuth & Permissions"**
2. Click **"Install to Workspace"** (or "Reinstall" if already installed)
3. Click **"Allow"**
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`) - you'll need this!

### 6. Get Your Credentials (1 minute)

1. **Bot Token**: Already copied from step 5 (or go to "OAuth & Permissions")
2. **Signing Secret**: Go to "Basic Information" → "App Credentials" → Copy "Signing Secret"
3. **App Token**: Already copied from step 4 (starts with `xapp-`)
4. **Bot User ID**: Go to "Basic Information" → Copy "App ID"
3. **Bot User ID**: Go to "Basic Information" → Copy "App ID"

### 7. Configure Environment Variables (1 minute)

Update your `.env` file in the `bolt_slack` folder:

```env
SLACK_BOT_TOKEN=YOUR_SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET=YOUR_SLACK_SIGNING_SECRET
SLACK_BOT_USER_ID=YOUR_SLACK_BOT_USER_ID
SLACK_APP_TOKEN=xapp-1-A01234567-1234567890123-abcdef1234567890
SLACK_SOCKET_MODE=true
API_BASE_URL=http://localhost:3000
PORT=3000
```

### 8. Install Dependencies & Start Bot

```bash
cd bolt_slack
npm install
npm start
```

You should see:
```
⚡️ Slack Bot is running!
📡 Listening on port 3000
🔗 API Base URL: http://localhost:3000
✅ Bot is ready to receive commands and events!
```

### 9. Configure Event Subscriptions (1 minute)

**With Socket Mode, you DON'T need a Request URL!**

1. Go to **"Event Subscriptions"**
2. Toggle **"Enable Events"** to **ON**
3. **Skip the Request URL field** (Socket Mode doesn't need it!)
4. Subscribe to **Bot Events**:
   - `app_mention`
   - `member_joined_channel`
   - `message.channels` (NEW - for interactive storage)
   - `message.im`
   - `reaction_added` (NEW - for interactive storage)
5. Click **"Save Changes"**

**📝 Note:** When users make a decision (Yes/No), the bot's prompt disappears immediately and confirmation messages auto-delete after 1 minute to keep channels clean!

4. Subscribe to **Bot Events**:
   - `app_mention`
   - `member_joined_channel`
   - `message.channels` (NEW - for interactive storage)
   - `message.im`
   - `reaction_added` (NEW - for interactive storage)
5. Click **"Save Changes"**

### 10. Test Your Bot!

In Slack:

1. Go to any channel
2. Type: `/invite @API Bot`
3. The bot should send a welcome message!
4. Try: `/channel-info`
5. **NEW**: Post a message and watch for the 💾 reaction!
6. React with ✅ to save it to the database

## Quick Test Commands

```
/channel-info          → Get channel details
/messages              → View recent messages
/store-messages        → Store ALL messages to DB
@API Bot help          → Show help

🆕 Interactive Storage (Private & Auto-Clearing):
1. Post any message
2. You see a private prompt (others don't see it)
3. Click ✅ to save or ❌ to skip
4. Prompt updates with confirmation
5. Confirmation auto-clears after 1 minute
```

## Common Issues

**Bot doesn't respond:**
- ✓ Check bot is running (`npm start`)
- ✓ Verify ngrok is running
- ✓ Check Event Subscriptions URL is correct

**"API connection failed":**
- ✓ Start your API servers:
  ```bash
  # Terminal 1
  cd mongo_storage
  node server.js
  
  # Terminal 2
  cd slack_retrieval
  node server.js
  ```

**Commands don't appear:**
- ✓ Reinstall app to workspace
- ✓ Wait 30 seconds for Slack to sync

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Configure Event Subscriptions for advanced features
- Deploy to production server (replace ngrok URL)

## Need Help?

Check the main README.md or review the Slack API documentation at https://api.slack.com/docs
