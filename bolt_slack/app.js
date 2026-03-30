const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');

console.log('DEBUG ENV:', {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? 'SET' : 'NOT SET',
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ? 'SET' : 'NOT SET',
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN ? 'SET' : 'NOT SET',
});

const { runModel, postSummaries } = require('../mongo_storage/python');
const { run } = require('jest');
const { insertMessageModels, insertSingleMessageToDB, insertUserModels, buildChannelKey, userIDToName } = require('./slack_to_DB');

// Shared API client for Mongo storage
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
});

const BOT_USER_ID = config.slackBotUserId;

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

// ====================
// Message Listeners
// ====================

// Store pending message confirmations
const pendingMessages = new Map();

// Listen for messages in channels (not from bots)
app.message(async ({ message, client, logger }) => {
  try {
    // Skip if no user (system messages)
    if (!message.user) {
      return;
    }

    // Skip bot messages (including our own)
    if (message.subtype === 'bot_message' || message.bot_id) {
      return;
    }

    // Skip if message is from this bot (double check)
    if (BOT_USER_ID && message.user === BOT_USER_ID) {
      return;
    }

    // Skip direct messages
    if (message.channel_type === 'im') {
      // Handle direct messages to the bot
      const text = message.text.toLowerCase();
      
      if (text.includes('help') || text === 'hi' || text === 'hello') {
        await client.chat.postMessage({
          channel: message.channel,
          text: `👋 Hi! I'm your Slack API bot.\n\n*What I can do:*\n• Store channel messages to database\n• Retrieve messages from database\n• Provide channel information\n\n*How to use:*\n• I'll ask you privately if you want to save your messages\n• Click "✅ Yes, Save" to save to database\n• Click "❌ No, Skip" to skip\n\nYou can also use slash commands like \`/messages\`, \`/store-messages\`, or \`/channel-info\`!`
        });
      } else {
        await client.chat.postMessage({
          channel: message.channel,
          text: `I received your message! Type "help" to see what I can do.`
        });
      }
      return;
    }

    // Only handle messages in channels where bot is present
    if (message.channel_type === 'channel' || message.channel_type === 'group') {
      // Post an EPHEMERAL message (only visible to the message author)
      const result = await client.chat.postEphemeral({
        channel: message.channel,
        user: message.user, // Only visible to this user!
        text: '💾 Would you like to save this message to the database?',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '💾 *Would you like to save this message to the database?*'
            }
          },
          {
            type: 'actions',
            block_id: 'save_message_actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '✅ Yes, Save',
                  emoji: true
                },
                style: 'primary',
                value: `save_${message.channel}_${message.ts}_${message.user}`,
                action_id: 'save_message_confirm'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '❌ No, Skip',
                  emoji: true
                },
                style: 'danger',
                value: `skip_${message.channel}_${message.ts}_${message.user}`,
                action_id: 'save_message_deny'
              }
            ]
          }
        ]
      });

      // Store message info for later use when button is clicked
      const key = `${message.channel}-${message.ts}`;
      pendingMessages.set(key, {
        channel: message.channel,
        timestamp: message.ts,
        text: message.text,
        user: message.user,
        expiresAt: Date.now() + 300000 // 5 minutes
      });

      // Clean up old pending messages
      setTimeout(() => {
        pendingMessages.delete(key);
      }, 300000); // 5 minutes
    }
  } catch (error) {
    logger.error('Error handling message:', error);
  }
});

// ====================
// Button Action Handlers
// ====================

// Handle "Yes, Save" button click
app.action('save_message_confirm', async ({ ack, body, client, logger, respond }) => {
  // Acknowledge the action and update the message to remove buttons
  await ack();
  
  try {
    // Parse the button value to get channel, timestamp, and original user
    const [action, channel, timestamp, originalUser] = body.actions[0].value.split('_');
    const key = `${channel}-${timestamp}`;
    
    // Verify the button clicker is the original message author
    if (body.user.id !== originalUser) {
      // Use respond to update the ephemeral message
      await respond({
        text: '⚠️ Only the message author can save their own message.',
        replace_original: true,
        delete_original: false
      });
      
      // Auto-clear the warning after 1 minute
      setTimeout(async () => {
        try {
          await respond({
            text: '',
            replace_original: true,
            delete_original: true
          });
        } catch (error) {
          logger.error('Error clearing warning:', error);
        }
      }, 60000);
      
      return;
    }
    
    const pendingMessage = pendingMessages.get(key);

    if (!pendingMessage) {
      // Message expired or not found - update the ephemeral message
      await respond({
        text: '⚠️ This save request has expired (5 minute timeout).',
        replace_original: true
      });
      
      // Auto-clear after 1 minute
      setTimeout(async () => {
        try {
          await respond({
            text: '',
            replace_original: true,
            delete_original: true
          });
        } catch (error) {
          logger.error('Error clearing expired message:', error);
        }
      }, 60000);
      
      return;
    }

    // Update the message to show "Processing..."
    await respond({
      text: '⏳ Saving message to database...',
      replace_original: true
    });

    // Get channel info to get channel name
    const channelInfo = await client.conversations.info({
      channel: channel
    });
    const channelName = channelInfo.channel.name;

    // Create a message object to store
    const messageToStore = {
      user: pendingMessage.user,
      type: 'message',
      text: pendingMessage.text,
      ts: pendingMessage.timestamp
    };

    try {
      // Use the database function to store the message
      const result = await insertSingleMessageToDB(channelName, messageToStore);

      // Update with success message
      await respond({
        text: '✅ *Message saved to database successfully!*',
        replace_original: true
      });

      // Auto-clear success message after 1 minute
      setTimeout(async () => {
        try {
          await respond({
            text: '',
            replace_original: true,
            delete_original: true
          });
        } catch (error) {
          logger.error('Error clearing success message:', error);
        }
      }, 60000);

      // Remove from pending messages
      pendingMessages.delete(key);

      logger.info(`Message stored to database for channel: ${channelName} by user: ${body.user.id}`);
    } catch (error) {
      logger.error('Error storing message to database:', error);
      
      // Update with error message
      await respond({
        text: `❌ *Error storing message*\n${error.message}`,
        replace_original: true
      });

      // Auto-clear error message after 1 minute
      setTimeout(async () => {
        try {
          await respond({
            text: '',
            replace_original: true,
            delete_original: true
          });
        } catch (error) {
          logger.error('Error clearing error message:', error);
        }
      }, 60000);
    }
  } catch (error) {
    logger.error('Error handling save confirmation:', error);
  }
});

// Handle "No, Skip" button click
app.action('save_message_deny', async ({ ack, body, client, logger, respond }) => {
  await ack();
  
  try {
    // Parse the button value to get channel, timestamp, and original user
    const [action, channel, timestamp, originalUser] = body.actions[0].value.split('_');
    const key = `${channel}-${timestamp}`;

    // Verify the button clicker is the original message author
    if (body.user.id !== originalUser) {
      await respond({
        text: '⚠️ Only the message author can respond to this prompt.',
        replace_original: true
      });
      
      // Auto-clear the warning after 1 minute
      setTimeout(async () => {
        try {
          await respond({
            text: '',
            replace_original: true,
            delete_original: true
          });
        } catch (error) {
          logger.error('Error clearing warning:', error);
        }
      }, 60000);
      
      return;
    }

    // Update the ephemeral message to show skip confirmation
    await respond({
      text: '🚫 Message will not be saved to database.',
      replace_original: true
    });

    // Auto-clear skip confirmation after 1 minute
    setTimeout(async () => {
      try {
        await respond({
          text: '',
          replace_original: true,
          delete_original: true
        });
      } catch (error) {
        logger.error('Error clearing skip message:', error);
      }
    }, 60000);

    // Remove from pending messages
    pendingMessages.delete(key);

    logger.info(`User ${body.user.id} chose not to store message`);
  } catch (error) {
    logger.error('Error handling save denial:', error);
  }
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