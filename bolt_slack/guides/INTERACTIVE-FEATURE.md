# Interactive Message Storage Feature

## Overview

The bot now includes an interactive message storage feature that allows users to selectively save messages to the database using emoji reactions.

## How It Works

### 1. **Bot Adds Reaction**
When a user posts a message in a channel where the bot is present:
- Bot automatically adds a 💾 (floppy disk) reaction to the message
- This indicates the message can be saved to the database

### 2. **User Responds**
The user (or any team member) can respond by adding their own reaction:
- ✅ **Checkmark** - Save this message to the database
- ❌ **X** - Don't save this message

### 3. **Bot Takes Action**

#### If user reacts with ✅:
1. Bot stores the message to MongoDB
2. Adds a ✅ reaction to confirm
3. Posts a confirmation message in the thread: "✅ Message stored to database successfully!"

#### If user reacts with ❌:
1. Bot removes the 💾 reaction
2. Posts a message in thread: "🚫 Message will not be stored to database."
3. Clears the message from pending queue

## Visual Flow

```
User posts: "Important meeting notes: Project deadline is Friday"
    ↓
Bot adds: 💾 (save disk emoji)
    ↓
User adds: ✅ (checkmark)
    ↓
Bot confirms: ✅ + Thread message "Message stored to database successfully!"
```

## Usage Example

### Scenario 1: Saving a Message

```
@Alice: "Q4 revenue is up 15% - great job team! 🎉"
    [💾] ← Bot adds this automatically
    
@Bob adds: ✅  ← Team member wants to save this

Bot responds in thread:
    "✅ Message stored to database successfully!"
```

### Scenario 2: Skipping a Message

```
@Charlie: "Anyone want coffee?"
    [💾] ← Bot adds this automatically
    
@Charlie adds: ❌  ← Not important enough to save

Bot responds in thread:
    "🚫 Message will not be stored to database."
```

## Technical Details

### Message Tracking

- **Pending Messages**: Stored in memory with a 5-minute expiration
- **Key Format**: `{channelId}-{messageTimestamp}`
- **Auto-cleanup**: Messages automatically removed after 5 minutes if no action taken

### API Integration

When a user confirms with ✅, the bot:

1. Retrieves channel information
2. Creates message object:
   ```javascript
   {
     user: "U1234567890",
     type: "message",
     text: "The message content",
     ts: "1234567890.123456"
   }
   ```
3. POSTs to API: `/api/slack/{channelName}` with message data
4. API checks for duplicates (by timestamp)
5. Stores to MongoDB if unique

### Duplicate Prevention

The API automatically checks for duplicate messages:
- Uses message timestamp (`ts`) as unique identifier
- If message already exists, returns: `{ duplicate: true }`
- Bot informs user if message was already stored

## Configuration

### Required Slack Event Subscriptions

Add these to your Slack App's Event Subscriptions:

```
✓ message.channels    - Listen for channel messages
✓ reaction_added      - Detect when users add reactions
✓ app_mention         - Bot mentions for help
```

### Required Bot Permissions

```
✓ channels:history    - Read message history
✓ reactions:read      - See reactions on messages
✓ reactions:write     - Add reactions to messages
✓ chat:write          - Send confirmation messages
```

## Best Practices

### For Users

1. **Be Selective**: Only save important messages to avoid database clutter
2. **Quick Response**: React within 5 minutes (pending messages expire)
3. **Team Collaboration**: Anyone can save a message, not just the author

### For Administrators

1. **Monitor Storage**: Check database size regularly
2. **Set Guidelines**: Establish what types of messages should be saved
3. **API Availability**: Ensure API server is running for storage to work

## Advantages

### Over Bulk Storage (`/store-messages`):

✅ **Selective**: Only save important messages
✅ **Real-time**: Messages stored as they happen
✅ **User Control**: Team decides what's worth keeping
✅ **Less Noise**: Database contains only valuable content

### User Experience:

✅ **Intuitive**: Simple emoji reactions everyone understands
✅ **Non-intrusive**: Doesn't interrupt conversation flow
✅ **Collaborative**: Any team member can save messages
✅ **Feedback**: Immediate confirmation when message is saved

## Troubleshooting

### Bot doesn't add 💾 reaction

**Possible causes:**
- Bot not invited to channel (`/invite @BotName`)
- Missing `reactions:write` permission
- Message is from another bot

### ✅ reaction doesn't save message

**Possible causes:**
- API server not running
- More than 5 minutes passed since message
- Network connectivity issues

**Check logs for:**
```
Error storing message to database: <error details>
```

### Message says "already exists"

- Message was previously stored
- This is normal behavior to prevent duplicates
- No action needed

## Alternative Commands

If you prefer bulk operations:

- **`/store-messages`** - Store ALL messages from channel at once
- **`/messages`** - View stored messages from database

## Code Reference

### Main Components

1. **`app.js`** - Message listener and reaction handler
2. **`slack_retrieval/post_endpoint.js`** - API endpoint for storage
3. **`slack_retrieval/slack_to_DB.js`** - Database insertion logic

### Key Functions

```javascript
// Track pending messages
const pendingMessages = new Map();

// Listen for messages
app.message(async ({ message, client }) => { ... });

// Handle reactions
app.event('reaction_added', async ({ event, client }) => { ... });

// Store single message
insertSingleMessageToDB(channelName, messageData);
```

## Future Enhancements

Potential improvements:

- 📊 Add statistics: "You've saved 150 messages this month"
- 🏷️ Add tags/categories via additional emoji reactions
- ⏰ Scheduled saves: Save messages at specific times
- 📁 Bulk review: Show pending messages that haven't been decided on
- 🔍 Search: Find saved messages without leaving Slack

## Related Documentation

- [README.md](README.md) - Full bot documentation
- [QUICKSTART.md](QUICKSTART.md) - Setup guide
- [INTEGRATION.md](INTEGRATION.md) - API integration details
