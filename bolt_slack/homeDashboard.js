const HOME_CHANNEL_SELECT_ACTION_ID = 'home_channel_select';
const HOME_REFRESH_ACTION_ID = 'home_refresh_button';
const DEFAULT_RECENT_MESSAGES_LIMIT = 5;

function toTimestampMillis(ts) {
  const parsedTs = Number.parseFloat(ts);
  return Number.isFinite(parsedTs) ? parsedTs * 1000 : 0;
}

function formatMessageTimestamp(ts) {
  const timestamp = toTimestampMillis(ts);
  if (!timestamp) {
    return 'unknown time';
  }

  return new Date(timestamp).toLocaleString();
}

function buildChannelOptions(channels) {
  return channels.map((channel) => ({
    text: {
      type: 'plain_text',
      text: `#${channel.name}`
    },
    value: channel.name
  }));
}

async function getBotChannels(client) {
  const channels = [];
  let cursor;

  do {
    const response = await client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
      cursor
    });

    const pageChannels = Array.isArray(response.channels) ? response.channels : [];
    for (const channel of pageChannels) {
      if (channel && channel.id && channel.name) {
        channels.push({ id: channel.id, name: channel.name });
      }
    }

    cursor = response.response_metadata && response.response_metadata.next_cursor;
  } while (cursor);

  channels.sort((a, b) => a.name.localeCompare(b.name));
  return channels;
}

async function fetchRecentMessagesForChannel({ apiClient, buildChannelKey, channelName, logger }) {
  if (!channelName) {
    return {
      apiStatus: 'No channel selected',
      recentMessages: [],
      messagesStored: 0,
      errorMessage: ''
    };
  }

  try {
    const collectionName = await buildChannelKey(channelName);
    const response = await apiClient.get(`/api/messages/${collectionName}`);
    const messages = Array.isArray(response.data) ? response.data : [];
    const sortedMessages = messages
      .slice()
      .sort((a, b) => toTimestampMillis(b.ts) - toTimestampMillis(a.ts));

    return {
      apiStatus: 'Online',
      recentMessages: sortedMessages.slice(0, DEFAULT_RECENT_MESSAGES_LIMIT),
      messagesStored: messages.length,
      errorMessage: ''
    };
  } catch (error) {
    if (logger) {
      logger.error(`Error fetching dashboard data for channel ${channelName}:`, error);
    }

    return {
      apiStatus: 'Offline',
      recentMessages: [],
      messagesStored: 0,
      errorMessage: error.message || 'Unknown API error'
    };
  }
}

function buildRecentMessagesMarkdown(channelName, recentMessages) {
  if (!channelName) {
    return 'Select a channel from the dropdown above to load messages.';
  }

  if (!recentMessages.length) {
    return `No messages found in the database for *#${channelName}* yet.`;
  }

  return recentMessages
    .map((message, index) => {
      const userLabel = message.user || 'Unknown user';
      const text = message.text || '(no text)';
      const postedAt = formatMessageTimestamp(message.ts);
      return `${index + 1}. *${userLabel}*: ${text} _at ${postedAt}_`;
    })
    .join('\n');
}

function buildSampleHomeView({
  userId,
  channelOptions,
  selectedChannelName,
  activeChannels,
  messagesStored,
  apiStatus,
  recentMessages,
  errorMessage
}) {
  const generatedAt = new Date().toLocaleString();
  const selectedOption = channelOptions.find((option) => option.value === selectedChannelName);

  const blocks = [
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
        text: `Welcome <@${userId}>! Here you can access and manage summaries and structured data for all the conversations in this workspace.`
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Refresh Dashboard',
            emoji: true
          },
          style: 'primary',
          action_id: HOME_REFRESH_ACTION_ID,
          value: selectedChannelName || ''
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '\n*Channel*'
      },
      accessory: {
        type: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select a channel'
        },
        action_id: HOME_CHANNEL_SELECT_ACTION_ID,
        options: channelOptions,
        ...(selectedOption ? { initial_option: selectedOption } : {})
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Messages Stored*\n${messagesStored}`
        },
        {
          type: 'mrkdwn',
          text: `*Active Channels*\n${activeChannels}`
        },
        {
          type: 'mrkdwn',
          text: `*Connected API*\n${apiStatus}`
        },
        {
          type: 'mrkdwn',
          text: `*Last Refresh*\n${generatedAt}`
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Most Recent Messages (${DEFAULT_RECENT_MESSAGES_LIMIT})*\n${buildRecentMessagesMarkdown(selectedChannelName, recentMessages)}`
      }
    }
  ];

  if (errorMessage) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `API error: ${errorMessage}`
        }
      ]
    });
  }

  return {
    type: 'home',
    callback_id: 'home_dashboard_v1',
    blocks
  };
}

async function publishHomeTab({ client, userId, logger, apiClient, buildChannelKey, selectedChannelName }) {
  try {
    const channels = await getBotChannels(client);
    const channelOptions = buildChannelOptions(channels);
    const resolvedChannelName = selectedChannelName || (channels[0] && channels[0].name) || '';

    const {
      apiStatus,
      recentMessages,
      messagesStored,
      errorMessage
    } = await fetchRecentMessagesForChannel({
      apiClient,
      buildChannelKey,
      channelName: resolvedChannelName,
      logger
    });

    await client.views.publish({
      user_id: userId,
      view: buildSampleHomeView({
        userId,
        channelOptions,
        selectedChannelName: resolvedChannelName,
        activeChannels: channels.length,
        messagesStored,
        apiStatus,
        recentMessages,
        errorMessage
      })
    });
  } catch (error) {
    if (logger) {
      logger.error('Error publishing Home tab:', error);
    } else {
      console.error('Error publishing Home tab:', error);
    }
  }
}

module.exports = {
  HOME_CHANNEL_SELECT_ACTION_ID,
  HOME_REFRESH_ACTION_ID,
  buildSampleHomeView,
  publishHomeTab
};
