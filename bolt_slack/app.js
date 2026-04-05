const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const config = require('./config');
const autoSavedMessages = new Map();
const userAutoSavePreference = new Map();
const {
  publishHomeTab,
  HOME_CHANNEL_SELECT_ACTION_ID,
  HOME_REFRESH_ACTION_ID,
  HOME_SUMMARY_WEEK_SELECT_ACTION_ID,
  encodeDashboardState
} = require('./homeDashboard');

console.log('DEBUG ENV:', {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? 'SET' : 'NOT SET',
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ? 'SET' : 'NOT SET',
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN ? 'SET' : 'NOT SET',
});

const { insertMessageModels, insertSingleMessageToDB, insertUserModels, buildChannelKey, userIDToName } = require('./slack_to_DB');

// Shared API client for Mongo storage
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
});

const BOT_USER_ID = config.slackBotUserId;

function parseDashboardState(rawValue) {
  if (!rawValue) {
    return {
      channelName: '',
      selectedWeek: null
    };
  }

  // Backward compatibility for older button values that stored only channelName.
  if (!rawValue.startsWith('{')) {
    return {
      channelName: rawValue,
      selectedWeek: null
    };
  }

  try {
    const parsed = JSON.parse(rawValue);
    const parsedSelectedWeek = Number.parseInt(parsed.selectedWeek, 10);

    return {
      channelName: typeof parsed.channelName === 'string' ? parsed.channelName : '',
      selectedWeek: Number.isFinite(parsedSelectedWeek) ? parsedSelectedWeek : null
    };
  } catch (_error) {
    return {
      channelName: '',
      selectedWeek: null
    };
  }
}

function getSelectedOptionValueFromViewState(viewState, actionId) {
  const values = viewState && viewState.values ? Object.values(viewState.values) : [];

  for (const valueGroup of values) {
    if (!valueGroup || typeof valueGroup !== 'object') {
      continue;
    }

    for (const actionState of Object.values(valueGroup)) {
      if (!actionState || actionState.type !== 'static_select' || actionState.action_id !== actionId) {
        continue;
      }

      return actionState.selected_option && actionState.selected_option.value
        ? actionState.selected_option.value
        : '';
    }
  }

  return '';
}

// Initialize Express and Slack App based on mode
let receiver;
let expressApp;
let app;

if (!config.socketMode) {
  // HTTP Mode: Create Express receiver for webhook-based events
  const express = require('express');
  expressApp = express();
  
  // Create receiver - this handles /slack/events
  receiver = new ExpressReceiver({
    signingSecret: config.slackSigningSecret,
    app: expressApp,  // Pass the Express app to ExpressReceiver
  });
  
  // Create Slack app with the receiver
  app = new App({
    token: config.slackBotToken,
    signingSecret: config.slackSigningSecret,
    socketMode: false,
    receiver: receiver,
  });
} else {
  // Socket Mode: No receiver needed, uses WebSocket
  app = new App({
    token: config.slackBotToken,
    signingSecret: config.slackSigningSecret,
    socketMode: true,
    appToken: config.slackAppToken,
  });
}

// API endpoint configuration
const API_BASE_URL = config.apiBaseUrl; // MongoDB API endpoint

// ====================
// Helper Functions
// ====================

// Fetch select number of messages via conversations.history
async function getConversationHistory(channelId, limit = 100) {
  try {
    console.log(`🚀 Attempting to pull messages from: ${channelId}`);
    
    const result = await app.client.conversations.history({
      channel: channelId,
      limit: limit
    });

    console.log(`✅ Success! Found ${result.messages.length} messages.`);
    return result.messages;
  } catch (error) {
    console.error("❌ Extraction Error:", error.data ? error.data.error : error.message);
    throw error;
  }
}

// Fetch select number of messages via conversations.history, ONLY collecting messages posted AFTER the last call
async function getRecentConversationHistory(channelId, lastTimestamp) {
  try {
    console.log(`🚀 Attempting to pull messages from: ${channelId} since ${lastTimestamp}`);
    
    const result = await app.client.conversations.history({
      channel: channelId,
      oldest: lastTimestamp,
      // limit = 1000 per call
    });

    console.log(`✅ Success! Found ${result.messages.length} new messages.`);
    console.log(JSON.stringify(result.messages, null, 2));
  } catch (error) {
    console.error("❌ Extraction Error:", error.data ? error.data.error : error.message);
  }
}

// Fetch info about channel via conversations.info
async function getConversationInfo(channelId) {
  try {  
    const result = await app.client.conversations.info({
      channel: channelId,
      include_num_members: true
    });

    console.log(`✅ Success! Found data for conversation ${result.channel.name}`);
    return result.channel;
  } catch (error) {
    console.error("❌ Retrieval Error:", error.data ? error.data.error : error.message);
    throw error;
  }
}

// Fetch messages from API
async function fetchMessagesFromAPI(collectionName) {
  try {
    const response = await apiClient.get(`/api/messages/${collectionName}`);
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Fetch member data from API
async function fetchMembersFromAPI(collectionName) {
  try {
    const response = await apiClient.get(`/api/users/${collectionName}`);
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// ====================
// Slack Event Listeners
// ====================

// Listen for when the bot is added to a channel
app.event('member_joined_channel', async ({ event, client, logger }) => {
  try {
    // Check if the bot was added
    if (event.user === BOT_USER_ID) {
      await client.chat.postMessage({
        channel: event.channel,
        text: `👋 Hello! I'm your Slack API bot. I can help you manage and store messages from this channel.\n\n*🎯 Interactive Message Storage:*\nWhenever someone posts a message, I'll reply with a question:\n💾 "Would you like to save this message to the database?"\n\nSimply click:\n• "✅ Yes, Save" to store it\n• "❌ No, Skip" to ignore it\n\n*📋 Available Commands:*\n• \`/messages\` - View messages stored in database\n• \`/store-messages\` - Store ALL channel messages at once\n• \`/channel-info\` - Get channel information\n• \`@bot help\` - Show detailed help`
      });
    }
  } catch (error) {
    logger.error('Error handling member_joined_channel:', error);
  }
});

// Listen for app mentions (@bot)
app.event('app_mention', async ({ event, client, logger }) => {
  try {
    const text = event.text.toLowerCase();
    
    if (text.includes('help')) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `🤖 *Slack API Bot - Help*\n\n*Interactive Message Storage:*\n• I'll reply to every message asking if you want to save it\n• Click the "✅ Yes, Save" button to save to database\n• Click the "❌ No, Skip" button to skip\n\n*Slash Commands:*\n• \`/messages\` - Retrieve recent messages from database\n• \`/store-messages\` - Store ALL channel messages to database\n• \`/channel-info\` - Get detailed channel information\n• \`@bot help\` - Show this help message\n• \`@bot status\` - Check bot and API status\n\n*Direct API Access:*\n• GET \`${API_BASE_URL}/api/messages/{channelName}\` - Retrieve messages\n• POST \`${API_BASE_URL}/api/messages/{channelName}\` - Store messages`
      });
    } else if (text.includes('status')) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `✅ Bot is running and connected!\nGET API: ${API_BASE_URL}\nPOST API: ${API_BASE_URL}\n\n💾 Interactive message storage is enabled - I'll ask about each message with easy buttons!`
      });
    } else {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `I'm here! Use \`@bot help\` to see what I can do.\n\n💡 Tip: I'll ask about saving each message with simple Yes/No buttons!`
      });
    }
  } catch (error) {
    logger.error('Error handling app_mention:', error);
  }
});

// Publish Home tab when a user opens the app's Home.
app.event('app_home_opened', async ({ event, client, logger }) => {
  await publishHomeTab({
    client,
    userId: event.user,
    logger,
    apiClient,
    buildChannelKey
  });
});

// ====================
// Slash Commands
// ====================

// /messages - Retrieve recent messages
app.command('/messages', async ({ command, ack, respond, client }) => {
  await ack();
  
  try {
    const channelInfo = await getConversationInfo(command.channel_id);
    const channelName = channelInfo.name;
    
    // Try to fetch from API first
    try {
      const channelKey = await buildChannelKey(channelName);
      const messages = await fetchMessagesFromAPI(channelKey);
      
      if (messages && messages.length > 0) {
        const messageLines = await Promise.all(
          messages.slice(0, 5).map(async (msg, idx) => {
            let displayName = msg.user || 'unknown-user';

            if (msg.user) {
              try {
                const resolvedName = await userIDToName(msg.user);
                if (resolvedName) {
                  displayName = resolvedName;
                }
              } catch (_error) {
                // Fall back to the user ID if Slack user lookup fails.
              }
            }

            return `${idx + 1}. *${displayName}*: ${msg.text || '(no text)'} _at ${new Date(parseFloat(msg.ts) * 1000).toLocaleString()}_`;
          })
        );

        const messageText = messageLines.join('\n');
        
        await respond({
          response_type: 'in_channel',
          text: `📬 *Recent Messages from Database* (${messages.length} total):\n\n${messageText}\n\n_Use \`/store-messages\` to update the database._`
        });
      } else {
        await respond({
          response_type: 'ephemeral',
          text: `No messages found in database for channel *${channelName}*. Use \`/store-messages\` first.`
        });
      }
    } catch (error) {
      // If API fails, fetch directly from Slack
      const messages = await getConversationHistory(command.channel_id, 5);
      const messageText = messages.map((msg, idx) => 
        `${idx + 1}. ${msg.text || '(no text)'}`
      ).join('\n');
      
      await respond({
        response_type: 'in_channel',
        text: `📬 *Recent Messages (from Slack)*:\n\n${messageText}\n\n_Note: API connection failed. Showing live Slack data._`
      });
    }
  } catch (error) {
    console.error('Error in /messages command:', error);
    await respond({
      response_type: 'ephemeral',
      text: `❌ Error: ${error.message}`
    });
  }
});

// /store-messages - Store messages to database
app.command('/store-messages', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    const channelInfo = await getConversationInfo(command.channel_id);
    const channelName = channelInfo.name;
    
    await respond({
      response_type: 'ephemeral',
      text: `⏳ Storing messages from *${channelName}*...`
    });
    
    await insertMessageModels(channelName);
    
    await respond({
      response_type: 'in_channel',
      text: `✅ Messages from *${channelName}* stored successfully to the database!`
    });
  } catch (error) {
    console.error('Error in /store-messages command:', error);
    await respond({
      response_type: 'ephemeral',
      text: `❌ Error storing messages: ${error.message}`
    });
  }
});

// /store-members - Store channel members data to database
app.command('/store-members', async ({ command, ack, respond }) => {
  await ack();
  try {
    const channelInfo = await getConversationInfo(command.channel_id);
    const channelName = channelInfo.name;

    await respond({
      response_type: 'ephemeral',
      text: `⏳ Storing member data from *${channelName}*...`
    });
    await insertUserModels(channelName);

    await respond({
      response_type: 'in_channel',
      text: `✅ Member data from *${channelName}* stored successfully to the database!`
    });
  } catch (error) {
    console.error('Error in /store-members command:', error);
    await respond({
      response_type: 'ephemeral',
      text: `❌ Error storing member data: ${error.message}`
    });
  }
});

// /channel-info - Get channel information
app.command('/channel-info', async ({ command, ack, respond }) => {
  await ack();
  
  try {
    const channelInfo = await getConversationInfo(command.channel_id);
    
    await respond({
      response_type: 'in_channel',
      text: `📊 *Channel Information*\n\n*Name:* ${channelInfo.name}\n*ID:* ${channelInfo.id}\n*Created:* ${new Date(channelInfo.created * 1000).toLocaleString()}\n*Members:* ${channelInfo.num_members || 'N/A'}\n*Topic:* ${channelInfo.topic?.value || 'No topic set'}\n*Purpose:* ${channelInfo.purpose?.value || 'No purpose set'}`
    });
  } catch (error) {
    console.error('Error in /channel-info command:', error);
    await respond({
      response_type: 'ephemeral',
      text: `❌ Error: ${error.message}`
    });
  }
});

// summary - Get channel summary
app.command('/summary', async ({ command, ack, respond, client }) => {
    await ack();

    try {
        const channel_id = command.channel_id;
        const channel_name = command.channel_name;

        await respond({
            response_type: 'ephemeral',
            text: 'Fetching summaries...'
        });

        // Fetch all summaries from the API
        const response = await apiClient.get('/api/summary/all');
        const allSummaries = response.data;

        const weeks = [
            { suffix: 'cw', label: 'Current Week' },
            { suffix: 'pw', label: 'Past Week' }
        ];

        for (const week of weeks) {
            const db_name = `${channel_name}_S_${week.suffix}`;
            const weekData = allSummaries[db_name];

            if (!weekData || Object.keys(weekData).length === 0) {
                await client.chat.postMessage({
                    channel: channel_id,
                    text: `No summaries found for *${week.label}* in *#${channel_name}*.`
                });
                continue;
            }

            // Post week header
            await client.chat.postMessage({
                channel: channel_id,
                text: `*${week.label} Summaries for #${channel_name}*`
            });

            // Each key is a day
            for (const day in weekData) {
                const docs = weekData[day];
                if (!docs || docs.length === 0) continue;

                await client.chat.postMessage({
                    channel: channel_id,
                    text: `*${day}*`
                });

                for (const doc of docs) {
                    if (!doc.sum_text || doc.sum_text === '()') continue;

                    await client.chat.postMessage({
                        channel: channel_id,
                        text: `*User:* ${doc.user}\n*Summary:* ${doc.sum_text}`
                    });
                }
            }
        }

    } catch(err) {
        console.error('Error in /summary command:', err);
        await respond({
            response_type: 'ephemeral',
            text: `Error fetching summaries: ${err.message}`
        });
    }
});

// /members-info - Get information about all members in the channel
app.command('/members-info', async ({ command, ack, respond }) => {
  await ack();
  try {
    const channelInfo = await getConversationInfo(command.channel_id);
    const channelName = channelInfo.name;
    const collectionName = await buildChannelKey(channelName);

    const membersData = await apiClient.get(`/api/users/${collectionName}`);


    if (membersData && membersData.data && membersData.data.length > 0) {
      const memberText = membersData.data.map((member, idx) => 
        `${idx + 1}. *${member.name}* (${member.real_name}) - ${member.is_admin ? 'Admin' : 'Member'}`
      ).join('\n');
      await respond({
        response_type: 'in_channel',
        text: `👥 *Members in ${channelName}*:\n\n${memberText}\n\n_Use \`/store-members\` to update member data._`
      });
    } else {
      await respond({
        response_type: 'ephemeral',
        text: `No member data found in database for channel *${channelName}*. Use \`/store-members\` first.`
      });
    }
  } catch (error) {
    console.error('Error in /members-info command:', error);
    await respond({
      response_type: 'ephemeral',
      text: `❌ Error: ${error.message}`
    });
  }
});

// /refresh-home - Refresh the Home dashboard for the current user
app.command('/refresh-home', async ({ command, ack, respond, client, logger }) => {
  await ack();

  // Send immediate response to avoid timeout
  // publishHomeTab() is slow due to paginated channel list and API calls
  await respond({
    response_type: 'ephemeral',
    text: '⏳ Refreshing your home dashboard...'
  });

  // Do the actual refresh asynchronously in the background
  // This prevents the 3-second timeout while still updating the user's Home tab
  publishHomeTab({
    client,
    userId: command.user_id,
    logger,
    apiClient
  })
    .then(() => {
      console.log(`✅ Home dashboard successfully refreshed for user ${command.user_id}`);
    })
    .catch((error) => {
      console.error('Error refreshing Home dashboard:', error);
    });
});

// Home tab channel dropdown: republish with selected channel data.
app.action(HOME_CHANNEL_SELECT_ACTION_ID, async ({ ack, body, client, logger }) => {
  await ack();

  try {
    const selectedChannelName = body.actions && body.actions[0] && body.actions[0].selected_option
      ? body.actions[0].selected_option.value
      : '';

    publishHomeTab({
      client,
      userId: body.user.id,
      logger,
      apiClient,
      selectedChannelName,
      selectedWeek: null
    })
      .catch((error) => {
        logger.error('Error handling Home channel selection:', error);
      });
  } catch (error) {
    logger.error('Error handling Home channel selection:', error);
  }
});

// Home tab refresh button: republish the dashboard on click.
app.action(HOME_REFRESH_ACTION_ID, async ({ ack, body, client, logger }) => {
  await ack();

  const actionValue = body.actions && body.actions[0] && body.actions[0].value
    ? body.actions[0].value
    : encodeDashboardState({ channelName: '', selectedWeek: null });

  const {
    channelName: selectedChannelName,
    selectedWeek
  } = parseDashboardState(actionValue);

  // Republish asynchronously so ack is never blocked by dashboard work.
  publishHomeTab({
    client,
    userId: body.user.id,
    logger,
    apiClient,
    selectedChannelName,
    selectedWeek
  })
    .catch((error) => {
      logger.error('Error handling Home refresh action:', error);
    });
});

// Home tab week dropdown: republish with selected week updates.
app.action(HOME_SUMMARY_WEEK_SELECT_ACTION_ID, async ({ ack, body, client, logger }) => {
  await ack();

  const selectedWeekRaw = body.actions && body.actions[0] && body.actions[0].selected_option
    ? body.actions[0].selected_option.value
    : '';
  const selectedChannelName = getSelectedOptionValueFromViewState(body.view && body.view.state, HOME_CHANNEL_SELECT_ACTION_ID);
  const selectedWeek = Number.parseInt(selectedWeekRaw, 10);

  publishHomeTab({
    client,
    userId: body.user.id,
    logger,
    apiClient,
    selectedChannelName,
    selectedWeek: Number.isFinite(selectedWeek) ? selectedWeek : null
  })
    .catch((error) => {
      logger.error('Error handling Home week selection action:', error);
    });
});

// ====================
// Message Listeners
// ====================

// Listen for messages in channels (not from bots)
app.message(async ({ message, client, logger }) => {
  try {
    if (!message.user) return;
    if (message.subtype === 'bot_message' || message.bot_id) return;
    if (BOT_USER_ID && message.user === BOT_USER_ID) return;

    // Handle DMs to the bot
    if (message.channel_type === 'im') {
      const text = message.text.toLowerCase();
      if (text.includes('help') || text === 'hi' || text === 'hello') {
        await client.chat.postMessage({
          channel: message.channel,
          text: `👋 Hi! I'm your Slack bot.\n\n*How saving works:*\n• Your messages are automatically saved to the database\n• You have 30 minutes to unsave any message\n• Use \`/autosave-off\` to stop auto-saving your messages\n• Use \`/autosave-on\` to turn it back on\n\n*Slash Commands:*\n• \`/messages\` - View saved messages\n• \`/store-messages\` - Bulk save channel messages\n• \`/channel-info\` - Get channel info`
        });
      } else {
        await client.chat.postMessage({
          channel: message.channel,
          text: `I received your message! Type "help" to see what I can do.`
        });
      }
      return;
    }

    // Only handle channel/group messages
    if (message.channel_type === 'channel' || message.channel_type === 'group') {

      // Check if user has turned off autosave
      if (userAutoSavePreference.get(message.user) === false) {
        // Still offer a manual save button if they have autosave off
        await client.chat.postEphemeral({
          channel: message.channel,
          user: message.user,
          text: '💾 Auto-save is off. Want to save this message?',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '💾 *Auto-save is off for you.* Want to save this message manually?'
              }
            },
            {
              type: 'actions',
              block_id: 'manual_save_actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '✅ Save this message', emoji: true },
                  style: 'primary',
                  value: `manualsave_${message.channel}_${message.ts}_${message.user}`,
                  action_id: 'manual_save_message'
                },
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '🔁 Turn Auto-Save Back On', emoji: true },
                  value: `autosaveon_${message.user}`,
                  action_id: 'enable_autosave'
                }
              ]
            }
          ]
        });
        return;
      }

      // AUTO-SAVE: immediately save the message to the database
      try {
        const channelInfo = await client.conversations.info({ channel: message.channel });
        const channelName = channelInfo.channel.name;

        const messageToStore = {
          user: message.user,
          type: 'message',
          text: message.text,
          ts: message.ts
        };

        await insertSingleMessageToDB(channelName, messageToStore);

        // Store in unsave window map for 30 minutes
        const key = `${message.channel}-${message.ts}`;
        autoSavedMessages.set(key, {
          channel: message.channel,
          channelName: channelName,
          timestamp: message.ts,
          text: message.text,
          user: message.user,
          savedAt: Date.now()
        });

        // Auto-remove from unsave window after 30 minutes
        setTimeout(() => {
          autoSavedMessages.delete(key);
        }, 1800000); // 30 minutes

        // Notify user privately with unsave option
        const expiresAt = new Date(Date.now() + 1800000).toLocaleTimeString();
        await client.chat.postEphemeral({
          channel: message.channel,
          user: message.user,
          text: `✅ Your message was auto-saved. You can unsave it until ${expiresAt}.`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *Your message was saved to the database.*\nYou can unsave it any time in the next 30 minutes _(until ${expiresAt})_.\nTo stop auto-saving, use \`/autosave-off\`.`
              }
            },
            {
              type: 'actions',
              block_id: 'unsave_actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '↩️ Unsave This Message', emoji: true },
                  style: 'danger',
                  value: `unsave_${message.channel}_${message.ts}_${message.user}`,
                  action_id: 'unsave_message'
                }
              ]
            }
          ]
        });

      } catch (saveError) {
        logger.error('Auto-save failed:', saveError);
        await client.chat.postEphemeral({
          channel: message.channel,
          user: message.user,
          text: `⚠️ Auto-save failed for your message: ${saveError.message}`
        });
      }
    }
  } catch (error) {
    logger.error('Error handling message:', error);
  }
});

// ====================
// Button Action Handlers
// ====================

// Handle "Unsave" button — removes message from DB within 30-min window
app.action('unsave_message', async ({ ack, body, client, logger, respond }) => {
  await ack();
  try {
    const parts = body.actions[0].value.split('_');
    // value format: unsave_CHANNEL_TIMESTAMP_USER
    const channel = parts[1];
    const timestamp = parts[2];
    const originalUser = parts[3];
    const key = `${channel}-${timestamp}`;

    if (body.user.id !== originalUser) {
      await respond({ text: '⚠️ Only the message author can unsave this message.', replace_original: true });
      return;
    }

    const savedMessage = autoSavedMessages.get(key);

    if (!savedMessage) {
      await respond({
        text: '⏰ The 30-minute unsave window has expired. This message is now permanently saved.',
        replace_original: true
      });
      return;
    }

    // Remove from unsave map
    autoSavedMessages.delete(key);

    // Actually delete from MongoDB
    try {
      const channelKey = await buildChannelKey(savedMessage.channelName);
      await apiClient.delete(`/api/messages/${encodeURIComponent(channelKey)}/${savedMessage.timestamp}`);
    } catch (deleteErr) {
      logger.error('Failed to delete message from DB:', deleteErr);
    }

    await respond({
      text: '↩️ *Message unsaved.* It has been removed from the database.',
      replace_original: true
    });

    logger.info(`User ${body.user.id} unsaved message ${timestamp} from channel ${channel}`);
  } catch (error) {
    logger.error('Error handling unsave:', error);
  }
});

// Handle manual save button (for users with autosave off)
app.action('manual_save_message', async ({ ack, body, client, logger, respond }) => {
  await ack();
  try {
    const parts = body.actions[0].value.split('_');
    const channel = parts[1];
    const timestamp = parts[2];
    const originalUser = parts[3];

    if (body.user.id !== originalUser) {
      await respond({ text: '⚠️ Only the message author can save this message.', replace_original: true });
      return;
    }

    const channelInfo = await client.conversations.info({ channel });
    const channelName = channelInfo.channel.name;

    // We need to fetch the message text from Slack since we didn't store it
    const history = await client.conversations.history({
      channel,
      latest: timestamp,
      limit: 1,
      inclusive: true
    });

    const msg = history.messages?.[0];
    if (!msg) {
      await respond({ text: '⚠️ Could not find the original message.', replace_original: true });
      return;
    }

    await insertSingleMessageToDB(channelName, {
      user: originalUser,
      type: 'message',
      text: msg.text,
      ts: timestamp
    });

    await respond({
      text: '✅ *Message saved to database successfully!*',
      replace_original: true
    });
  } catch (error) {
    logger.error('Error handling manual save:', error);
    await respond({ text: `❌ Error saving message: ${error.message}`, replace_original: true });
  }
});

// Handle "Turn Auto-Save Back On" button
app.action('enable_autosave', async ({ ack, body, respond, logger }) => {
  await ack();
  try {
    userAutoSavePreference.set(body.user.id, true);
    await respond({
      text: '✅ *Auto-save is back on.* Your messages will be saved automatically going forward.',
      replace_original: true
    });
  } catch (error) {
    logger.error('Error enabling autosave:', error);
  }
});

// ====================
// Auto-Save Slash Commands
// ====================

// /autosave-off - User opts out of auto-saving
app.command('/autosave-off', async ({ command, ack, respond }) => {
  await ack();
  userAutoSavePreference.set(command.user_id, false);
  await respond({
    response_type: 'ephemeral',
    text: `🔕 *Auto-save turned off.* Your messages will no longer be saved automatically.\nUse \`/autosave-on\` to turn it back on, or click the save button that appears after each message.`
  });
});

// /autosave-on - User opts back into auto-saving
app.command('/autosave-on', async ({ command, ack, respond }) => {
  await ack();
  userAutoSavePreference.set(command.user_id, true);
  await respond({
    response_type: 'ephemeral',
    text: `✅ *Auto-save turned on.* Your messages will be saved automatically with a 30-minute unsave window.`
  });
});

// ====================
// App Startup
// ====================

(async () => {
  const port = config.botPort;

  try {
    if (config.socketMode) {
      // Socket Mode: WebSocket connection
      await app.start(port);
      console.log('⚡️ Slack Bot is running in Socket Mode!');
      console.log(`📡 Listening on port ${port}`);
    } else {
      // HTTP Mode: ExpressReceiver handles /slack/events endpoint
      console.log('🔧 Setting up HTTP mode for Slack events...');
      
      // Add middleware to Express for logging and health checks
      expressApp.use(require('express').json());
      expressApp.use(require('express').urlencoded({ extended: true }));
      
      // Request logging (skip /slack/events for cleaner logs)
      expressApp.use((req, res, next) => {
        if (req.path !== '/slack/events') {
          console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        }
        next();
      });
      
      // Health check endpoints
      expressApp.get('/', (req, res) => {
        res.status(200).json({ 
          status: 'ok', 
          service: 'Slack Bot',
          mode: 'HTTP',
          endpoints: { 
            health: '/health',
            events: '/slack/events'
          }
        });
      });
      
      expressApp.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
      });
      
      // Start the Express server
      // ExpressReceiver already added /slack/events route to expressApp
      expressApp.listen(port, '0.0.0.0', () => {
        console.log('⚡️ Slack Bot is running in HTTP Mode!');
        console.log(`📡 Listening on 0.0.0.0:${port}`);
        console.log(`📨 Slack events: POST /slack/events (auto-configured by ExpressReceiver)`);
        console.log(`🔗 Health: GET /health`);
      });
    }

    console.log(`🔗 Database API: ${API_BASE_URL}`);
    console.log('\n✅ Bot is ready to receive commands and events!');
  } catch (error) {
    console.error('❌ Failed to start Slack Bot:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
})();