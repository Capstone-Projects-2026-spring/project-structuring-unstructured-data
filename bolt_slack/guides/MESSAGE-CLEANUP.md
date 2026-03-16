# Message Cleanup Feature

## Overview

The bot uses **ephemeral messages** (only visible to the user who posted) with auto-updating and auto-clearing functionality to keep the user's view clean without exposing their storage decisions to others.

## How It Works

### 1. **Private Ephemeral Prompts**
When a user posts a message:
- The bot sends an **ephemeral prompt** (only visible to that user)
- Other channel members don't see the prompt at all
- Complete privacy for the user's decision-making

### 2. **Message Updates on Interaction**
When a user clicks a button:
- The ephemeral message is **updated in-place** to show the result
- No new messages are created
- The buttons disappear and are replaced with the confirmation text

### 3. **Auto-Clearing After 1 Minute**
All confirmation messages automatically clear after **1 minute**:
- ✅ Success confirmations ("Message saved to database successfully!")
- ❌ Skip confirmations ("Message will not be saved to database")
- ⚠️ Error messages (API errors, permission warnings, etc.)
- ⏱️ Expiration notices (5-minute timeout warnings)

## Benefits

- **Complete Privacy**: Only the user sees the prompts and confirmations
- **Clean Interface**: Messages update in-place rather than creating new ones
- **Auto-Cleanup**: Confirmations disappear automatically after 1 minute
- **No Channel Clutter**: Other users never see the bot's storage prompts
- **Better UX**: Seamless experience with smooth message transitions

## Technical Implementation

### Using Ephemeral Messages with `respond()`

```javascript
// 1. Initial ephemeral prompt (only user sees this)
await client.chat.postEphemeral({
  channel: message.channel,
  user: message.user, // Only visible to this user!
  text: '💾 Would you like to save this message?',
  blocks: [/* interactive buttons */]
});

// 2. When button clicked, update the ephemeral message
await respond({
  text: '✅ Message saved successfully!',
  replace_original: true  // Replaces the prompt in-place
});

// 3. Auto-clear after 1 minute
setTimeout(async () => {
  await respond({
    text: '',
    replace_original: true,
    delete_original: true  // Clears the ephemeral message
  });
}, 60000);
```

### Key Technical Details

- **`chat.postEphemeral`**: Creates messages only visible to one user
- **`respond()` function**: Updates interactive messages in-place
- **`replace_original: true`**: Replaces the message content
- **`delete_original: true`**: Clears the ephemeral message completely
- **Cannot use `chat.delete()`**: Ephemeral messages can't be deleted via that API

## User Experience

### What the User Sees:
1. User posts a message
2. Bot shows ephemeral prompt with buttons (only they see it)
3. User clicks ✅ Yes, Save or ❌ No, Skip
4. Prompt updates to show "⏳ Saving message to database..."
5. Then updates to "✅ Message saved successfully!" 
6. After 1 minute, the confirmation disappears
7. Their view stays clean

### What Others See:
- **Nothing!** All bot interactions are completely private
- Only the original user message remains visible
- No clutter, no bot messages in the channel

## Configuration

The auto-clear timeout is set to **60 seconds (1 minute)**. To change this:

```javascript
// In app.js, find the setTimeout calls:
setTimeout(async () => {
  await respond({
    text: '',
    replace_original: true,
    delete_original: true
  });
}, 60000); // Change this value (in milliseconds)
```

### Recommended Timeouts
- **30 seconds**: Very quick cleanup (might not give enough time to read)
- **60 seconds**: Current setting - good balance ✓
- **120 seconds**: Longer visibility for slower readers
- **300 seconds**: 5 minutes - good for important messages

## Error Handling

The bot gracefully handles errors:
- Logs errors to console without crashing
- Shows error messages to the user (ephemeral)
- Continues operation even if updates fail
- Auto-clears error messages after 1 minute

## Permissions Required

The bot needs these permissions:
- `chat:write` - Post ephemeral messages
- No special deletion permissions needed (ephemeral messages clear automatically)

## Testing

To test the feature:
1. Post a message in a channel with the bot
2. You should see an ephemeral prompt (others won't see it)
3. Click ✅ Yes, Save or ❌ No, Skip
4. Observe:
   - Prompt updates to show status ✓
   - Then updates to show confirmation ✓
   - Wait 1 minute
   - Confirmation clears completely ✓
5. Ask another user - they won't see any of your bot interactions ✓

## Privacy Advantages

✅ **Complete Privacy**: Storage decisions are private to each user
✅ **No Exposure**: Other channel members never see prompts
✅ **Clean Channel**: Channel view stays uncluttered for everyone
✅ **Individual Control**: Each user manages their own messages independently

## Notes

- Ephemeral messages are ONLY visible to the specified user
- The original message being saved/skipped remains in the channel
- Message updates are instant and smooth
- Auto-clearing is automatic and requires no user action
- This approach is the recommended Slack best practice for private interactions
