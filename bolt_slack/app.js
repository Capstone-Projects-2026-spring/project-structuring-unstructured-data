const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const {
  connectToDatabase,
  isConnectedToDatabase,
  mongoose: dbMongoose
} = require('../mongo_storage/db-connection');
const config = require('./config');
const autoSavedMessages = new Map();
const userAutoSavePreference = new Map();
const {
  publishHomeTab,
  HOME_CHANNEL_SELECT_ACTION_ID,
  HOME_REFRESH_ACTION_ID,
  HOME_SUMMARY_WEEK_SELECT_ACTION_ID,
  HOME_ADMIN_STORE_MEMBERS,
  HOME_ADMIN_VIEW_UNSTORED,
  encodeDashboardState,
  checkIfUserIsAdmin
} = require('./homeDashboard');

console.log('DEBUG ENV:', {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? 'SET' : 'NOT SET',
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ? 'SET' : 'NOT SET',
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN ? 'SET' : 'NOT SET',
});

const { insertMessageModels, insertSingleMessageToDB, insertUserModels, buildChannelKey, userIDToName } = require('./slack_to_DB');

// Token management for multi-workspace support
const tokenCache = new Map(); // Cache tokens by team_id
const channelLabelCache = new Map(); // Cache channel_id -> resolved label (name or fallback id)

function normalizeTeamId(teamId) {
  return typeof teamId === 'string' ? teamId.trim() : '';
}

async function safePostEphemeral(client, payload, logger, contextLabel = 'ephemeral message') {
  try {
    return await client.chat.postEphemeral(payload);
  } catch (error) {
    const slackError = error?.data?.error;
    if (slackError === 'channel_not_found' || slackError === 'not_in_channel') {
      logger.warn(`[${contextLabel}] Skipped: ${slackError} for channel ${payload.channel}`);
      return null;
    }
    throw error;
  }
}

async function resolveChannelLabel(client, channelId, logger, contextLabel = 'channel') {
  if (!channelId) {
    return channelId;
  }

  const cached = channelLabelCache.get(channelId);
  if (cached) {
    return cached;
  }

  try {
    const channelInfo = await client.conversations.info({ channel: channelId });
    const resolvedName = channelInfo?.channel?.name || channelId;
    channelLabelCache.set(channelId, resolvedName);
    return resolvedName;
  } catch (error) {
    const slackError = error?.data?.error;
    if (slackError === 'channel_not_found' || slackError === 'not_in_channel') {
      logger.warn(`[${contextLabel}] Could not resolve channel metadata (${slackError}) for ${channelId}; using channel ID fallback for API key.`);
      channelLabelCache.set(channelId, channelId);
      return channelId;
    }
    throw error;
  }
}

async function getWorkspaceToken(teamId) {
  const normalizedTeamId = normalizeTeamId(teamId);
  const defaultTeamId = normalizeTeamId(process.env.SLACK_TEAM_ID);

  console.log('[Auth:getWorkspaceToken] Resolving token', {
    incomingTeamId: teamId || null,
    normalizedTeamId: normalizedTeamId || null,
    defaultTeamId: defaultTeamId || null,
    hasDefaultEnvToken: Boolean(config.slackBotToken)
  });

  // The default workspace keeps using the configured env token.
  if (!normalizedTeamId || normalizedTeamId === defaultTeamId) {
    console.log('[Auth:getWorkspaceToken] Using default workspace env token fallback', {
      reason: !normalizedTeamId ? 'missing-team-id' : 'matched-default-team-id'
    });
    return config.slackBotToken;
  }

  // Check cache first for installed workspaces.
  if (tokenCache.has(normalizedTeamId)) {
    const cachedToken = tokenCache.get(normalizedTeamId);
    console.log('[Auth:getWorkspaceToken] Cache hit for workspace token', {
      teamId: normalizedTeamId,
      tokenPresent: Boolean(cachedToken)
    });
    return cachedToken;
  }

  console.log('[Auth:getWorkspaceToken] Cache miss, querying WorkspaceToken collection', {
    teamId: normalizedTeamId
  });
  
  // Try to fetch from database
  try {
    const WorkspaceToken = require('../mongo_storage/models/WorkspaceToken');
    const record = await WorkspaceToken.findOne({ team_id: normalizedTeamId });
    if (record) {
      tokenCache.set(normalizedTeamId, record.access_token);
      console.log('[Auth:getWorkspaceToken] Database token found and cached', {
        teamId: normalizedTeamId,
        hasAccessToken: Boolean(record.access_token),
        hasBotUserId: Boolean(record.bot_user_id),
        updatedLastUsedAt: record.last_used || null
      });
      return record.access_token;
    }

    console.warn('[Auth:getWorkspaceToken] Database query returned no token record', {
      teamId: normalizedTeamId
    });
  } catch (error) {
    console.error('[Auth:getWorkspaceToken] Failed while querying WorkspaceToken', {
      teamId: normalizedTeamId,
      errorMessage: error.message,
      errorName: error.name
    });
  }

  console.warn('[Auth:getWorkspaceToken] Returning null token', {
    teamId: normalizedTeamId
  });
  
  return null;
}

async function authorizeWorkspace({ teamId }) {
  const botToken = await getWorkspaceToken(teamId);

  if (!botToken) {
    throw new Error(`No bot token available for team ${teamId || 'unknown'}`);
  }

  // Returning botToken lets Bolt create a workspace-scoped client for this request.
  return { botToken };
}

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
    const parsedSelectedWeek = typeof parsed.selectedWeek === 'string'
      ? parsed.selectedWeek.trim()
      : '';

    return {
      channelName: typeof parsed.channelName === 'string' ? parsed.channelName : '',
      selectedWeek: parsedSelectedWeek || null
    };
  } catch (_error) {
    return {
      channelName: '',
      selectedWeek: null
    };
  }
}

function getSelectedOptionValueFromViewState(viewState, actionId) {
  const valueGroups = viewState && viewState.values ? Object.values(viewState.values) : [];

  for (const valueGroup of valueGroups) {
    if (!valueGroup || typeof valueGroup !== 'object') {
      continue;
    }

    // In Slack Home view state, action_id is usually the key in valueGroup.
    const keyedState = valueGroup[actionId];
    if (keyedState && keyedState.selected_option && keyedState.selected_option.value) {
      return keyedState.selected_option.value;
    }

    // Fallback for payload variations that include action_id on state objects.
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

function getWorkspaceIdFromPayload(payload) {
  return payload?.team_id
    || payload?.team?.id
    || payload?.authorizations?.[0]?.team_id
    || payload?.context_team_id
    || payload?.enterprise?.id
    || payload?.authorizations?.[0]?.enterprise_id
    || payload?.context_enterprise_id
    || null;
}

function getWorkspaceNameFromPayload(payload) {
  return payload?.team?.name
    || payload?.team_name
    || payload?.team?.domain
    || payload?.team_domain
    || payload?.authorizations?.[0]?.team_name
    || null;
}

function getHomeWorkspaceContext(payload) {
  return {
    teamId: getWorkspaceIdFromPayload(payload),
    workspaceName: getWorkspaceNameFromPayload(payload)
  };
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
    authorize: authorizeWorkspace,
    signingSecret: config.slackSigningSecret,
    socketMode: false,
    receiver: receiver,
  });
  console.log('✅ Slack App initialized in HTTP mode with ExpressReceiver');
} else {
  // Socket Mode: No receiver needed, uses WebSocket
  app = new App({
    authorize: authorizeWorkspace,
    signingSecret: config.slackSigningSecret,
    socketMode: true,
    appToken: config.slackAppToken,
  });
  console.log('✅ Slack App initialized in Socket mode');
}

// API endpoint configuration
const API_BASE_URL = config.apiBaseUrl; // MongoDB API endpoint

// ====================
// Helper Functions
// ====================

// Fetch select number of messages via conversations.history
async function fetchConversationHistory(channelId, limit = 100, client) {
  try {
    if (!client) {
      throw new Error('Slack client is required to fetch conversation history');
    }

    console.log(`🚀 Attempting to pull messages from: ${channelId}`);
    
    const result = await client.conversations.history({
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

// Fetch info about channel via conversations.info
async function getConversationInfo(channelId, client) {
  try {  
    if (!client) {
      throw new Error('Slack client is required to fetch conversation info');
    }

    const result = await client.conversations.info({
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
app.event('member_joined_channel', async ({ event, client, logger, context }) => {
  try {
    // Check if the bot was added
  if (event.user === context?.botUserId || event.user === BOT_USER_ID) {
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
app.event('app_home_opened', async ({ event, body, client, logger }) => {
  console.log('🏠 [app_home_opened] Event triggered for user:', event.user);
  const userId = event.user;
  const { teamId, workspaceName } = getHomeWorkspaceContext(body);
  const resolvedTeamId = teamId || getWorkspaceIdFromPayload(event);
  const resolvedWorkspaceName = workspaceName || getWorkspaceNameFromPayload(event);
  
  // Publish a loading view immediately (within Slack's 3-second timeout)
  try {
    console.log('🏠 [app_home_opened] Publishing loading view immediately...');
    await client.views.publish({
      user_id: userId,
      view: {
        type: 'home',
        callback_id: 'home_dashboard_v1',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'SUD Dashboard'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⏳ Loading your dashboard...'
            }
          }
        ]
      }
    });
    console.log('🏠 [app_home_opened] Loading view published successfully');
  } catch (error) {
    console.error('❌ [app_home_opened] Error publishing loading view:', error);
  }

  // Fetch and publish the full dashboard in the background (no timeout constraint)
  console.log('🏠 [app_home_opened] Scheduling full dashboard load in background...');
  setImmediate(async () => {
    try {
      console.log('🏠 [app_home_opened] Background: Calling publishHomeTab...');
      await publishHomeTab({
        client,
        userId,
        teamId: resolvedTeamId,
        workspaceName: resolvedWorkspaceName,
        logger,
        apiClient
      });
      console.log('🏠 [app_home_opened] Background: publishHomeTab completed successfully');
    } catch (error) {
      console.error('❌ [app_home_opened] Background: Error publishing home tab:', error);
      
      // Publish an error view
      try {
        await client.views.publish({
          user_id: userId,
          view: {
            type: 'home',
            callback_id: 'home_dashboard_v1',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: 'SUD Dashboard'
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `❌ Error loading dashboard: ${error.message}`
                }
              }
            ]
          }
        });
      } catch (publishError) {
        console.error('❌ [app_home_opened] Failed to publish error view:', publishError);
      }
      
      if (logger) {
        logger.error('Error in app_home_opened background task:', error);
      }
    }
  });
});
console.log('📋 Registered: app_home_opened event handler');

// ====================
// Slash Commands
// ====================

// /messages - Retrieve recent messages
app.command('/messages', async ({ command, ack, respond, client }) => {
  await ack();
  
  try {
  const channelInfo = await getConversationInfo(command.channel_id, client);
    const channelName = channelInfo.name;
    
    // Try to fetch from API first
    try {
      const channelKey = await buildChannelKey(channelName, { client });
      const messages = await fetchMessagesFromAPI(channelKey);
      
      if (messages && messages.length > 0) {
        const messageLines = await Promise.all(
          messages.slice(0, 5).map(async (msg, idx) => {
            let displayName = msg.user || 'unknown-user';

            if (msg.user) {
              try {
                const resolvedName = await userIDToName(msg.user, client);
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
      const messages = await fetchConversationHistory(command.channel_id, 5, client);
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
app.command('/store-messages', async ({ command, ack, respond, client }) => {
  await ack();
  
  try {
  const channelInfo = await getConversationInfo(command.channel_id, client);
    const channelName = channelInfo.name;
    
    await respond({
      response_type: 'ephemeral',
      text: `⏳ Storing messages from *${channelName}*...`
    });
    
  await insertMessageModels(channelName, { client });
    
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
app.command('/store-members', async ({ command, ack, client }) => {
  await ack();
  try {
    const channelInfo = await getConversationInfo(command.channel_id, client);
    const channelName = channelInfo.name;

    const dm = await client.conversations.open({ users: command.user_id });
    await client.chat.postMessage({
      channel: dm.channel.id,
      text: `⏳ Storing member data from *${channelName}*...`
    });
    await insertUserModels(channelName, { client });

    await client.chat.postMessage({
      channel: dm.channel.id,
      text: `✅ Member data from *${channelName}* stored successfully to the database!`
    });
  } catch (error) {
    console.error('Error in /store-members command:', error);
  }
});

// /channel-info - Get channel information
app.command('/channel-info', async ({ command, ack, respond, client }) => {
  await ack();
  
  try {
  const channelInfo = await getConversationInfo(command.channel_id, client);
    
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

// summarize-week - Send channel summary for most recent week into channel
app.command('/summarize-week', async ({ command, ack, respond, client }) => {
    await ack();

    try {
        const channel_id = command.channel_id;
        const channel_name = command.channel_name;

        const databaseKey = await buildChannelKey(channel_name, { client });

        if (!databaseKey) {
            throw new Error(`Failed to build database key for channel: ${channel_name}`);
        }

        await respond({
            response_type: 'ephemeral',
            text: 'Structuring summaries... (this may take up to a minute)'
        });

        // Use a command-specific timeout because Gemini summary generation can exceed default API timeout.
        const response = await apiClient.post(
          `/api/summaries/${encodeURIComponent(databaseKey)}`,
          null,
          { timeout: 120000 }
        );
        const savedCount = response.data?.savedCount || 0;
        const weekStart = response.data?.weekStart || 'N/A';

        if (savedCount > 0) {
            await respond({
                response_type: 'in_channel',
            text: `✅ Created ${savedCount} summaries for *${channel_name}*!`
              });
        } else {
            await respond({
                response_type: 'in_channel',
                text: `⚠️ No summaries were created for *${channel_name}*.`
              });
        }
        
        return {
            success: true,
            dbName: databaseKey,
            message: `Model executed successfully for ${databaseKey}, summaries created for week starting ${weekStart}`,
            results: response.data?.modelResults || []
        };

    } catch(err) {
        if (err.code === 'ECONNABORTED') {
          await respond({
            response_type: 'ephemeral',
            text: '⏳ Summary generation is still running and exceeded the request wait time. Please check the Home dashboard or re-run /summarize-week shortly.'
          });
          return;
        }

        console.error('Error in /summarize-week command:', {
          message: err.message,
          code: err.code,
          status: err.response?.status,
          data: err.response?.data
        });
        await respond({
            response_type: 'ephemeral',
          text: `Error fetching summaries: ${err.response?.status ? `${err.response.status} - ` : ''}${err.message}`
        });
    }
});

// /members-info - Get information about all members in the channel
app.command('/members-info', async ({ command, ack, respond, client }) => {
  await ack();
  try {
  const channelInfo = await getConversationInfo(command.channel_id, client);
    const channelName = channelInfo.name;
    const collectionName = await buildChannelKey(channelName, { client });

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
  const { teamId, workspaceName } = getHomeWorkspaceContext(command);

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
    teamId,
    workspaceName,
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
  const { teamId, workspaceName } = getHomeWorkspaceContext(body);

  try {
    const selectedChannelName = body.actions && body.actions[0] && body.actions[0].selected_option
      ? body.actions[0].selected_option.value
      : '';
    const selectedWeekRaw = getSelectedOptionValueFromViewState(body.view && body.view.state, HOME_SUMMARY_WEEK_SELECT_ACTION_ID);

    publishHomeTab({
      client,
      userId: body.user.id,
      teamId,
      workspaceName,
      logger,
      apiClient,
      selectedChannelName,
      selectedWeek: selectedWeekRaw || null
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
  const { teamId, workspaceName } = getHomeWorkspaceContext(body);

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
    teamId,
    workspaceName,
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
  const { teamId, workspaceName } = getHomeWorkspaceContext(body);

  const selectedWeekRaw = body.actions && body.actions[0] && body.actions[0].selected_option
    ? body.actions[0].selected_option.value
    : '';
  const selectedChannelName = getSelectedOptionValueFromViewState(body.view && body.view.state, HOME_CHANNEL_SELECT_ACTION_ID);

  publishHomeTab({
    client,
    userId: body.user.id,
    teamId,
    workspaceName,
    logger,
    apiClient,
    selectedChannelName,
    selectedWeek: selectedWeekRaw || null
  })
    .catch((error) => {
      logger.error('Error handling Home week selection action:', error);
    });
});

//Home tab ADMIN controls
//Stores the members of every conversation the bot is in
app.action(HOME_ADMIN_STORE_MEMBERS, async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const isAdmin = await checkIfUserIsAdmin(client, body.user.id);
    if (!isAdmin) {
      logger.warn(`Non-admin user ${body.user.id} attempted to store members.`);
      return;
    }
    const channels = [];
    let cursor;
    do {
      const response = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
        cursor
      });
      for (const channel of response.channels || []) {
        if (channel.id && channel.name) {
          channels.push(channel.name);
        }
      }
      cursor = response.response_metadata?.next_cursor;
    } while (cursor);
    console.log(`Admin ${body.user.id} triggered store members for ${channels.length} channels`);
    const dm = await client.conversations.open({ users: body.user.id });
    await client.chat.postMessage({
      channel: dm.channel.id,
      text: `⏳ Storing members for ${channels.length} channels...`
    });
    let failed = 0;
    for (const channelName of channels) {
      try {
        await insertUserModels(channelName);
        console.log(`Stored members for #${channelName}`);
      } catch (error) {
        console.error(`Failed to store members for #${channelName}:`, error.message);
        failed++;
      }
    }
    const succeeded = channels.length - failed;
    await client.chat.postMessage({
      channel: dm.channel.id,
      text: failed === 0
        ? `✅ Successfully stored members for all ${succeeded} channels.`
        : `⚠️ Stored members for ${succeeded}/${channels.length} channels. ${failed} failed — check logs for details.`
    });
    publishHomeTab({
      client,
      userId: body.user.id,
      logger,
      apiClient
    }).catch((error) => logger.error('Error refreshing home tab:', error));
  } catch (error) {
    logger.error('Error handling admin store members:', error);
  }
});

// Home tab admin: show unstored messages for a channel in DM
app.action(HOME_ADMIN_VIEW_UNSTORED, async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const { channelId, channelName, channelKey } = JSON.parse(body.actions[0].value);

    const [slackResult, storedResult] = await Promise.all([
      client.conversations.history({ channel: channelId, limit: 1000 }),
      apiClient.get(`/api/messages/${encodeURIComponent(channelKey)}`)
    ]);

    const isHumanMessage = (msg) => !msg.bot_id && msg.subtype !== 'bot_message' && msg.user;
    const slackMessages = (slackResult.messages || []).filter(isHumanMessage);
    const storedTimestamps = new Set(
      (storedResult.data || []).filter(isHumanMessage).map((msg) => msg.ts)
    );
    const unstoredMessages = slackMessages.filter((msg) => !storedTimestamps.has(msg.ts));

    const dm = await client.conversations.open({ users: body.user.id });

    if (unstoredMessages.length === 0) {
      await client.chat.postMessage({
        channel: dm.channel.id,
        text: `✅ All messages in *#${channelName}* are stored.`
      });
      return;
    }

    const CHUNK = 20;
    for (let i = 0; i < unstoredMessages.length; i += CHUNK) {
      const chunk = unstoredMessages.slice(i, i + CHUNK);
      const header = i === 0
        ? `📋 *Unstored messages in #${channelName}* (${unstoredMessages.length} total):\n\n`
        : '';
      const lines = chunk.map((msg, idx) => {
        const time = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
        return `${i + idx + 1}. <@${msg.user}> _${time}_\n>${(msg.text || '(no text)').replace(/\n/g, '\n>')}`;
      }).join('\n\n');
      await client.chat.postMessage({ channel: dm.channel.id, text: header + lines });
    }
  } catch (error) {
    logger.error('Error viewing unstored messages:', error);
  }
});

// ====================
// Message Listeners
// ====================

// Listen for messages in channels (not from bots)
app.message(async ({ message, client, logger, context }) => {
  try {
    if (!message.user) return;
    if (message.subtype === 'bot_message' || message.bot_id) return;
  if ((context?.botUserId && message.user === context.botUserId) || (BOT_USER_ID && message.user === BOT_USER_ID)) return;

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
        await safePostEphemeral(client, {
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
        }, logger, 'autosave-off prompt');
        return;
      }

      // AUTO-SAVE: immediately save the message to the database
      try {
        const channelName = await resolveChannelLabel(client, message.channel, logger, 'autosave');

        const messageToStore = {
          user: message.user,
          type: 'message',
          text: message.text,
          ts: message.ts
        };

  await insertSingleMessageToDB(channelName, messageToStore, { channelId: message.channel });

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
        await safePostEphemeral(client, {
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
        }, logger, 'autosave success notice');

      } catch (saveError) {
        logger.error('Auto-save failed:', saveError);
        await safePostEphemeral(client, {
          channel: message.channel,
          user: message.user,
          text: `⚠️ Auto-save failed for your message: ${saveError.message}`
        }, logger, 'autosave failure notice');
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
      const channelKey = await buildChannelKey(savedMessage.channelName, { client });
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

    let channelName = channel;
    channelName = await resolveChannelLabel(client, channel, logger, 'manual-save');

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
    }, { channelId: channel });

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
    // Connect to MongoDB for multi-workspace token storage
    console.log('🔗 Connecting to MongoDB for workspace token storage...');
    try {
      await connectToDatabase();
      console.log('✅ MongoDB connection established');
    } catch (dbError) {
      console.error('⚠️  Warning: Could not connect to MongoDB:', dbError.message);
      console.error('⚠️  Multi-workspace token storage will not work, but bot will continue with single workspace');
    }

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
      
      // OAuth redirect endpoint
      expressApp.get('/slack/oauth_redirect', async (req, res) => {
        console.log('[OAuth] Received redirect request with code:', req.query.code ? 'present' : 'missing');
        
        const code = req.query.code;
        const state = req.query.state;
        
        if (!code) {
          console.error('[OAuth] Error: Missing code parameter');
          return res.status(400).send('Error: Missing code parameter');
        }
        
        try {
          // Exchange code for token using Slack's oauth.v2.access endpoint
          const bodyData = new URLSearchParams({
            client_id: process.env.SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            code: code,
            redirect_uri: process.env.SLACK_REDIRECT_URI || 'https://project-structuring-unstructured-data.onrender.com/slack/oauth_redirect'
          });

          console.log('[OAuth] Exchanging code with client_id:', process.env.SLACK_CLIENT_ID ? '✓ Set' : '✗ NOT SET');
          console.log('[OAuth] Exchanging code with client_secret:', process.env.SLACK_CLIENT_SECRET ? '✓ Set' : '✗ NOT SET');

          const response = await axios.post('https://slack.com/api/oauth.v2.access', bodyData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          
          if (!response.data.ok) {
            console.error('[OAuth] Error from Slack:', response.data.error);
            return res.status(400).send(`Error: ${response.data.error}`);
          }
          
          console.log('[OAuth] ✅ Successfully exchanged code for token');
          
          // Extract workspace info from response
          // Note: team_id/team_name might be nested or named differently
          const accessToken = response.data.access_token;
          const teamId = response.data.team?.id || response.data.team_id;
          const teamName = response.data.team?.name || response.data.team_name;
          const botUserId = response.data.bot_user_id;
          
          console.log('[OAuth] Response data:', { 
            teamId, 
            teamName, 
            botUserId, 
            hasAccessToken: !!accessToken 
          });
          
          // Save token to database for multi-workspace support (REQUIRED for multi-workspace)
          if (teamId && accessToken) {
            try {
              const WorkspaceToken = require('../mongo_storage/models/WorkspaceToken');
              
              // Check if MongoDB is connected
              let readyState = dbMongoose.connection.readyState;
              console.log('[OAuth] MongoDB connection state:', readyState, '(0=disconnected, 1=connected, 2=connecting, 3=disconnecting)');

              // Attempt a reconnect on demand (handles cold starts/restarts)
              if (!isConnectedToDatabase()) {
                console.log('[OAuth] MongoDB not connected, attempting reconnect...');
                await connectToDatabase();
                readyState = dbMongoose.connection.readyState;
                console.log('[OAuth] MongoDB connection state after reconnect attempt:', readyState);
              }
              
              if (readyState !== 1) {
                console.error('[OAuth] ❌ MongoDB is not connected. Current state:', readyState);
                console.error('[OAuth] MONGODB_USER:', process.env.MONGODB_USER ? 'SET' : 'NOT SET');
                console.error('[OAuth] MONGODB_PASSWORD:', process.env.MONGODB_PASSWORD ? 'SET' : 'NOT SET');
                throw new Error(`MongoDB not connected (state: ${readyState}). Check environment variables MONGODB_USER and MONGODB_PASSWORD on Render.`);
              }
              
              const savedToken = await WorkspaceToken.findOneAndUpdate(
                { team_id: teamId },
                {
                  team_id: teamId,
                  team_name: teamName || 'Unknown Workspace',
                  access_token: accessToken,
                  bot_user_id: botUserId,
                  last_used: new Date()
                },
                { upsert: true, new: true }
              );
              console.log('[OAuth] ✅ Token saved to database for team:', teamId);
              console.log('[OAuth] Saved token record:', {
                team_id: savedToken.team_id,
                team_name: savedToken.team_name,
                bot_user_id: savedToken.bot_user_id
              });
            } catch (dbError) {
              console.error('[OAuth] ❌ CRITICAL: Failed to save token to database:', dbError.message);
              console.error('[OAuth] Error details:', dbError);
              // Don't continue - we need to save the token for multi-workspace support
              return res.status(500).send(`
                <html>
                  <head><title>Authorization Error</title></head>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>❌ Authorization Failed</h1>
                    <p>The app received your authorization, but failed to save it.</p>
                    <p><strong>Error: ${dbError.message}</strong></p>
                    <p><strong>Troubleshooting:</strong></p>
                    <ul style="text-align: left; display: inline-block;">
                      <li>Check that MONGODB_USER and MONGODB_PASSWORD are set in Render environment variables</li>
                      <li>Verify MongoDB Atlas is accessible from Render's IP</li>
                      <li>Check that the IP whitelist includes Render's dynamic IPs (or allow 0.0.0.0/0)</li>
                    </ul>
                    <p>Please try again or contact support.</p>
                  </body>
                </html>
              `);
            }
          } else {
            console.warn('[OAuth] ❌ Missing teamId or accessToken - cannot proceed');
            return res.status(400).send(`
              <html>
                <head><title>Authorization Error</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1>❌ Authorization Failed</h1>
                  <p>Slack did not provide required workspace information.</p>
                  <p>Please try again.</p>
                </body>
              </html>
            `);
          }
          
          // Success response
          res.status(200).send(`
            <html>
              <head><title>Slack Authorization</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>✅ Success!</h1>
                <p>You have successfully authorized the Slack app.</p>
                <p>Team: <strong>${teamName || 'Your Workspace'}</strong> (ID: ${teamId || 'Unknown'})</p>
                <p>The bot is now ready to use in your workspace!</p>
              </body>
            </html>
          `);
        } catch (error) {
          console.error('[OAuth] Error exchanging code:', error.message);
          res.status(500).send(`Error: ${error.message}`);
        }
      });
      
      // Start the Express server
      // ExpressReceiver already added /slack/events route to expressApp
      expressApp.listen(port, '0.0.0.0', () => {
        console.log('⚡️ Slack Bot is running in HTTP Mode!');
        console.log(`📡 Listening on 0.0.0.0:${port}`);
        console.log(`📨 Slack events: POST /slack/events (auto-configured by ExpressReceiver)`);
        console.log(`� OAuth redirect: GET /slack/oauth_redirect`);
        console.log(`�🔗 Health: GET /health`);
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