# Get Your Slack App Token - Step by Step

## Where to Find Your App Token (Socket Mode)

### Step 1: Go to Your Slack App
1. Visit https://api.slack.com/apps
2. Click on your app name

### Step 2: Enable Socket Mode
1. Look at the left sidebar
2. Click **"Socket Mode"**
3. Toggle the switch to **"Enable Socket Mode"**

### Step 3: Generate App-Level Token
1. You'll see a button: **"Generate an app-level token"**
2. Click it
3. A dialog will appear

### Step 4: Configure the Token
In the dialog:
- **Name**: Enter `socket-token` (or any name you like)
- **Scopes**: Click "Add Scope" and select `connections:write`
- Click **"Generate"**

### Step 5: Copy the Token
- You'll see a token starting with `xapp-`
- **Copy the entire token** (it's long!)
- Example: `xapp-1-A01234567-1234567890123-abcdef1234567890...`

### Step 6: Add to .env File
Open `bolt_slack/.env` and update:

```env
SLACK_APP_TOKEN=xapp-your-actual-token-here
SLACK_SOCKET_MODE=true
```

## Visual Guide

```
┌─────────────────────────────────────────┐
│  api.slack.com/apps                     │
├─────────────────────────────────────────┤
│  Your Apps                              │
│    └─ API Bot (click here)             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Left Sidebar                           │
├─────────────────────────────────────────┤
│  Basic Information                      │
│  Collaborators                          │
│  Socket Mode ← Click here              │
│  Event Subscriptions                    │
│  OAuth & Permissions                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Socket Mode                            │
├─────────────────────────────────────────┤
│  Enable Socket Mode                     │
│  [Toggle Switch] ← Turn ON              │
│                                         │
│  [Generate an app-level token] ← Click │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Generate App-Level Token               │
├─────────────────────────────────────────┤
│  Token Name: socket-token               │
│                                         │
│  Scopes:                                │
│  └─ connections:write                   │
│                                         │
│  [Generate] ← Click                     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Your App Token                         │
├─────────────────────────────────────────┤
│  xapp-1-A01234567-123456-abc123...     │
│                                         │
│  [Copy] ← Click to copy                 │
└─────────────────────────────────────────┘
```

## Test Your Configuration

Run this command to verify everything is set:

```powershell
cd bolt_slack
# [REMOVED: Slack API token or secret]
# Please use environment variables or a secure method to provide secrets.
```

You should see all ✅ green checkmarks!

## Start Your Bot

```powershell
npm start
```

## Troubleshooting

### "Token not found" error
- Make sure you copied the ENTIRE token (it's very long)
- Check there are no spaces before/after the token in .env
- Make sure it starts with `xapp-`

### "Invalid token" error
- The token might have expired
- Generate a new token in Slack App settings
- Update .env with new token

### Socket Mode not working
- Verify `SLACK_SOCKET_MODE=true` in .env (not "True" or "TRUE")
- Check bot is running
- Reinstall app to workspace after enabling Socket Mode

## Why Socket Mode?

**Before Socket Mode (needed ngrok):**
```
Your Bot ←─ Internet ←─ ngrok ←─ Slack
(localhost)             (tunnel)
```

**With Socket Mode (no ngrok needed):**
```
Your Bot ──WebSocket──► Slack
(localhost)    (secure)
```

Socket Mode opens a WebSocket connection FROM your bot TO Slack, so Slack doesn't need to reach your localhost!

## Next Steps

Once you have the token and bot is running:

1. ✅ Bot should show "Bot is running" in terminal
2. ✅ Go to Slack
3. ✅ Type `/invite @YourBotName` in a channel
4. ✅ Bot should send welcome message
5. ✅ Try posting a message - bot adds 💾 reaction
6. ✅ React with ✅ to test saving

---

**That's it!** No ngrok, no tunneling, just pure local development! 🎉
