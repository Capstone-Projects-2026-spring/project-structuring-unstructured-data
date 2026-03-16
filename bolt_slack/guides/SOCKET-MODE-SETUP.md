# Socket Mode Setup (No ngrok/tunneling needed!)

**Socket Mode** is the easiest way to run your Slack bot locally without needing ngrok, localtunnel, or any public URL!

## Why Socket Mode?

✅ **No public URL needed** - Works entirely on your local machine  
✅ **No tunneling tools** - No ngrok, localtunnel, etc.  
✅ **Secure** - No need to expose your local server to the internet  
✅ **Easy setup** - Just one extra token  
✅ **Perfect for development** - Test locally without complications  

## Quick Setup (5 minutes)

### Step 1: Enable Socket Mode in Slack App

1. Go to https://api.slack.com/apps
2. Select your app
3. Go to **"Socket Mode"** in the sidebar
4. Toggle **"Enable Socket Mode"** to **ON**
5. Click **"Generate an app-level token"**
   - Token Name: `socket-token` (or any name)
   - Add scope: `connections:write`
   - Click **"Generate"**
6. **Copy the token** (starts with `xapp-`) - you'll need this!

### Step 2: Update Your .env File

Add these lines to your `.env` file in `bolt_slack` folder:

```env
SLACK_APP_TOKEN=xapp-1-A01234567-1234567890123-abcdef1234567890
SLACK_SOCKET_MODE=true
```

Your complete `.env` should look like:

```env
SLACK_BOT_TOKEN=YOUR_SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET=YOUR_SLACK_SIGNING_SECRET
SLACK_BOT_USER_ID=YOUR_SLACK_BOT_USER_ID
SLACK_APP_TOKEN=xapp-YOUR-ACTUAL-TOKEN-HERE
SLACK_SOCKET_MODE=true
API_BASE_URL=http://localhost:3000
PORT=3000
```

### Step 3: Configure Event Subscriptions

Since you're using Socket Mode, you **DON'T need** to set a Request URL!

1. Go to **"Event Subscriptions"** in your Slack App
2. Toggle **"Enable Events"** to **ON**
3. **Skip the Request URL** - Socket Mode doesn't need it!
4. Scroll to **"Subscribe to bot events"**
5. Add these events:
   - `app_mention`
   - `member_joined_channel`
   - `message.channels`
   - `message.im`
   - `reaction_added`
6. Click **"Save Changes"**

### Step 4: Update Slash Commands

For Slash Commands in Socket Mode:

1. Go to **"Slash Commands"**
2. For each command, you can either:
   - **Option A**: Leave Request URL empty (Socket Mode will handle it)
   - **Option B**: Use a dummy URL like `https://example.com` (won't be called)

### Step 5: Reinstall Your App

**Important:** You must reinstall the app after enabling Socket Mode!

1. Go to **"Install App"** or **"OAuth & Permissions"**
2. Click **"Reinstall to Workspace"**
3. Click **"Allow"**

### Step 6: Start Your Bot

```powershell
cd bolt_slack
npm start
```

You should see:
```
⚡️ Slack Bot is running!
📡 Listening on port 3000
🔗 API Base URL: http://localhost:3000
✅ Bot is ready to receive commands and events!
```

### Step 7: Test!

Go to Slack and test:

1. `/invite @YourBotName` in a channel
2. Post a message - bot should add 💾 reaction
3. Try `/channel-info`

**That's it!** No ngrok, no public URL needed! 🎉

## How It Works

```
┌─────────────┐         WebSocket         ┌──────────────┐
│             │◄─────────────────────────►│              │
│  Slack API  │   (Secure Connection)     │  Your Local  │
│             │                            │     Bot      │
└─────────────┘                            └──────────────┘
```

Socket Mode uses a WebSocket connection from your bot to Slack, so Slack doesn't need to reach your server!

## Troubleshooting

### "Invalid app token"
- Make sure you copied the full token (starts with `xapp-`)
- Check for extra spaces in `.env` file
- Regenerate token if needed

### Bot doesn't respond
- Verify `SLACK_SOCKET_MODE=true` in `.env`
- Check bot is running: `npm start`
- Reinstall app to workspace
- Check console logs for errors

### Slash commands don't work
- Make sure Request URL is set to a valid URL (even if not used)
- Or remove Request URL field entirely
- Reinstall app after changes

## Socket Mode vs HTTP Mode

| Feature | Socket Mode | HTTP Mode (ngrok) |
|---------|-------------|-------------------|
| Public URL needed | ❌ No | ✅ Yes |
| Tunneling tool needed | ❌ No | ✅ Yes (ngrok/etc) |
| Setup complexity | ⭐ Easy | ⭐⭐⭐ Complex |
| Local development | ✅ Perfect | ⚠️ Requires tunnel |
| Production ready | ⚠️ Not recommended | ✅ Yes |
| Firewall issues | ✅ No issues | ⚠️ May be blocked |

## When to Use Each Mode

### Use Socket Mode for:
- ✅ Local development
- ✅ Testing on your machine
- ✅ Behind corporate firewall
- ✅ Quick prototyping

### Use HTTP Mode for:
- ✅ Production deployment
- ✅ When hosting on a server with public IP
- ✅ Better performance at scale
- ✅ Multiple instances

## Production Deployment

For production, you should deploy to a server and use HTTP mode:

### Option 1: Heroku (Free Tier)
```bash
# Disable Socket Mode for production
echo "SLACK_SOCKET_MODE=false" >> .env

# Deploy to Heroku
heroku create your-bot-name
git push heroku main
```

### Option 2: Railway.app
1. Connect GitHub repo
2. Set environment variables
3. Deploy automatically

### Option 3: Your Own Server
```bash
# On your server
git clone your-repo
cd bolt_slack
npm install
npm start
```

## Additional Resources

- [Slack Socket Mode Docs](https://api.slack.com/apis/connections/socket)
- [Bolt Framework Socket Mode](https://slack.dev/bolt-js/concepts#socket-mode)

---

**Recommendation:** Use Socket Mode for development, then deploy to a server with HTTP mode for production! 🚀
