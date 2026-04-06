const HOME_CHANNEL_SELECT_ACTION_ID = 'home_channel_select';
const HOME_REFRESH_ACTION_ID = 'home_refresh_button';
const HOME_SUMMARY_WEEK_SELECT_ACTION_ID = 'home_summary_week_select';
const HOME_ADMIN_STORE_MEMBERS = 'home_admin_store_members';
const MAX_SUMMARY_TEXT_LENGTH = 750;
const CHANNEL_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_STATIC_SELECT_OPTIONS = 100;

const channelCache = {
  channels: null,
  expiresAt: 0
};

async function checkIfUserIsAdmin(client, userId) {
  console.log('ADMIN_OVERRIDE value:', process.env.ADMIN_OVERRIDE);
  
  if (process.env.ADMIN_OVERRIDE === 'true') {
    console.log('Admin override is active!');
    return true;
  }

  const result = await client.users.info({ user: userId });
  console.log('Slack admin check result:', result.user.is_admin, result.user.is_owner);
  return result.user.is_admin || result.user.is_owner;
}

function formatSummaryTimestamp(ts) {
  if (!ts) {
    return 'unknown time';
  }

  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) {
    return 'unknown time';
  }

  return new Date(parsed).toLocaleString();
}

function truncateText(text, maxLength) {
  const normalizedText = String(text || '').trim();

  if (!normalizedText) {
    return '(no summary text)';
  }

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function encodeDashboardState({ channelName, selectedWeek }) {
  const normalizedSelectedWeek = Number.parseInt(selectedWeek, 10);

  return JSON.stringify({
    channelName: channelName || '',
    selectedWeek: Number.isFinite(normalizedSelectedWeek) ? normalizedSelectedWeek : null
  });
}

function getAvailableWeeks(summaries) {
  const uniqueWeeks = new Set();

  for (const summary of summaries) {
    const week = Number(summary && summary.week_of);
    if (Number.isFinite(week)) {
      uniqueWeeks.add(week);
    }
  }

  return Array.from(uniqueWeeks).sort((left, right) => right - left);
}

function buildWeekOptions(availableWeeks) {
  return availableWeeks.slice(0, MAX_STATIC_SELECT_OPTIONS).map((week) => ({
    text: {
      type: 'plain_text',
      text: `Week ${week}`
    },
    value: String(week)
  }));
}

function buildChannelOptions(channels) {
  return channels.slice(0, MAX_STATIC_SELECT_OPTIONS).map((channel) => ({
    text: {
      type: 'plain_text',
      text: `#${channel.name}`
    },
    value: channel.name
  }));
}

function getCachedChannels() {
  if (channelCache.channels && Date.now() < channelCache.expiresAt) {
    return channelCache.channels;
  }
  return null;
}

function setCachedChannels(channels) {
  channelCache.channels = channels;
  channelCache.expiresAt = Date.now() + CHANNEL_CACHE_TTL_MS;
}

async function getBotChannels(client) {
  const cachedChannels = getCachedChannels();
  if (cachedChannels) {
    return cachedChannels;
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

    const pageChannels = Array.isArray(response.channels) ? response.channels : [];
    for (const channel of pageChannels) {
      if (channel && channel.id && channel.name) {
        channels.push({ id: channel.id, name: channel.name });
      }
    }

    cursor = response.response_metadata && response.response_metadata.next_cursor;
  } while (cursor);

  channels.sort((a, b) => a.name.localeCompare(b.name));
  setCachedChannels(channels);
  return channels;
}

async function fetchWeeklySummariesForChannel({ apiClient, channelName, logger }) {
  if (!channelName) {
    return {
      apiStatus: 'No channel selected',
      dbName: '',
      summaries: [],
      availableWeeks: [],
      summaryRecords: 0,
      messagesSummarized: 0,
      errorMessage: ''
    };
  }
  try {
    const response = await apiClient.get(`/api/summaries/${encodeURIComponent(channelName)}`);
    const summaries = response.data && Array.isArray(response.data.summaries)
      ? response.data.summaries
      : [];

    const messagesSummarized = summaries.reduce((sum, summary) => {
      const count = Number(summary && summary.message_count);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
    const availableWeeks = getAvailableWeeks(summaries);

    return {
      apiStatus: 'Online',
      dbName: response.data && typeof response.data.dbName === 'string' ? response.data.dbName : '',
      summaries,
      availableWeeks,
      summaryRecords: summaries.length,
      messagesSummarized,
      errorMessage: ''
    };
  } catch (error) {
    if (logger) {
      logger.error('Error fetching weekly summaries for Home tab:', error);
    } else {
      console.error('Error fetching weekly summaries for Home tab:', error);
    }

    return {
      apiStatus: 'Offline',
      dbName: '',
      summaries: [],
      availableWeeks: [],
      summaryRecords: 0,
      messagesSummarized: 0,
      errorMessage: error.message || 'Unknown API error'
    };
  }
}

async function getUnstoredMessages(client, apiClient, channelName, channelId) {
  try {
    const slackResult = await client.conversations.history({
      channel: channelId,
      limit: 1000
    });
    const slackMessages = slackResult.messages || [];

    const response = await apiClient.get(`/api/messages/${channelName}`);
    const storedMessages = response.data || [];

    const storedTimestamps = new Set(storedMessages.map(msg => msg.ts));
    const unstoredCount = slackMessages.filter(msg => !storedTimestamps.has(msg.ts)).length;

    return {
      channelName,
      total: slackMessages.length,
      stored: storedMessages.length,
      unstored: unstoredCount
    };
  } catch (error) {
    return {
      channelName,
      total: 'N/A',
      stored: 'N/A',
      unstored: 'N/A',
      notInChannel: error.data?.error === 'not_in_channel'
    };
  }
}

function buildSummaryDetailsMarkdown(summary) {
  const weekOf = summary.week_of != null ? summary.week_of : 'n/a';
  const messageCount = summary.message_count != null ? summary.message_count : 'n/a';
  const distinctUsers = summary.distinct_users != null ? summary.distinct_users : 'n/a';
  const generatedAt = formatSummaryTimestamp(summary.generated_at_utc);

  return [
    {
      type: 'mrkdwn',
      text: `*Week*\n${weekOf}`
    },
    {
      type: 'mrkdwn',
      text: `*Messages*\n${messageCount}`
    },
    {
      type: 'mrkdwn',
      text: `*Distinct users*\n${distinctUsers}`
    },
    {
      type: 'mrkdwn',
      text: `*Generated*\n${generatedAt}`
    }
  ];
}

function buildWeeklySummaryBlocks({ selectedChannelName, dbName, summaries, selectedWeek }) {
  if (!selectedChannelName) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Select a channel above to load its weekly summaries.'
        }
      }
    ];
  }

  if (!summaries.length) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `No weekly summaries found yet for *#${selectedChannelName}*.`
        }
      }
    ];
  }

  const sortedSummaries = summaries
    .slice()
    .sort((left, right) => Date.parse(right.generated_at_utc || '') - Date.parse(left.generated_at_utc || ''));

  const availableWeeks = getAvailableWeeks(sortedSummaries);
  const parsedSelectedWeek = Number.parseInt(selectedWeek, 10);
  const resolvedSelectedWeek = availableWeeks.includes(parsedSelectedWeek)
    ? parsedSelectedWeek
    : (availableWeeks[0] || null);

  const weekOptions = buildWeekOptions(availableWeeks);
  const selectedWeekOption = resolvedSelectedWeek == null
    ? null
    : weekOptions.find((option) => option.value === String(resolvedSelectedWeek));
  const visibleSummaries = resolvedSelectedWeek == null
    ? sortedSummaries
    : sortedSummaries.filter((summary) => Number(summary && summary.week_of) === resolvedSelectedWeek);
  const blocks = [];

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Weekly Summaries'
    },
    level: 2

  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Latest summaries for *#${selectedChannelName}*`
    },
    accessory: {
      type: 'static_select',
      placeholder: {
        type: 'plain_text',
        text: 'Select week'
      },
      action_id: HOME_SUMMARY_WEEK_SELECT_ACTION_ID,
      options: weekOptions,
      ...(selectedWeekOption ? { initial_option: selectedWeekOption } : {})
    }
  });

  blocks.push({ type: 'divider' });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: resolvedSelectedWeek == null
          ? `Showing all ${visibleSummaries.length} daily updates.`
          : `Showing ${visibleSummaries.length} daily updates for *Week ${resolvedSelectedWeek}*.`
      }
    ]
  });

  for (const [index, summary] of visibleSummaries.entries()) {
    const summaryTitle = `${summary.day_name || 'Unknown day'} · Week ${summary.week_of != null ? summary.week_of : 'n/a'}`;
    const summaryText = truncateText(summary.summary_text, MAX_SUMMARY_TEXT_LENGTH);
    const cardNumber = index + 1;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:bookmark_tabs: *Summary ${cardNumber}*\n*${summaryTitle}*\n${summaryText}`
      }
    });

    blocks.push({
      type: 'section',
      fields: buildSummaryDetailsMarkdown(summary)
    });
    

    if (index < visibleSummaries.length - 1) {
      blocks.push({ type: 'divider' });
    }
  }

  return blocks;
}

function buildSampleHomeView({
  userId,
  channelOptions,
  selectedChannelName,
  selectedWeek,
  activeChannels,
  selectableChannels,
  summaryRecords,
  messagesSummarized,
  apiStatus,
  dbName,
  summaries,
  errorMessage,
  isAdmin,
  channelStorageStats=[]
}) {
  const generatedAt = new Date().toLocaleString();
  const selectedOption = channelOptions.find((option) => option.value === selectedChannelName);

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'SUD Dashboard'
      },
      level: 1
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
          value: encodeDashboardState({
            channelName: selectedChannelName,
            selectedWeek
          })
        }
      ]
    },
    {
      type: 'header',
        text: {
          type: 'plain_text',        
          text: 'Channel Overview'
      },
      level: 2
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Select a channel to view its analytics and weekly summaries:`
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
          text: `*Summary Records*\n${summaryRecords}`
        },
        {
          type: 'mrkdwn',
          text: `*Messages Summarized*\n${messagesSummarized}`
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
    }
  ];

  blocks.push(...buildWeeklySummaryBlocks({
    selectedChannelName,
    dbName,
    summaries,
    selectedWeek
  }));

  if (activeChannels > selectableChannels) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Showing ${selectableChannels} of ${activeChannels} channels in selector for faster loading.`
        }
      ]
    });
  }

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

  if (isAdmin) {
    blocks.splice(3,0, {
      type: 'divider'
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔑 Admin Controls'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Store Members In All Channels',
            emoji: true
          },
          style: 'primary',
          action_id: HOME_ADMIN_STORE_MEMBERS
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Channel Storage Overview*'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: channelStorageStats.length === 0
          ? '_No channel data available._'
          : channelStorageStats.map(ch => {
              const allStored = ch.unstored === 0;
              const status = allStored ? '✅' : `*${ch.unstored} unstored*`;
              return `*#${ch.channelName}*   ${ch.total} in Slack · ${ch.stored} stored · ${status}`;
            }).join('\n')
      }
    },
    {
      type: 'divider'
    }
  )
  }

  return {
    type: 'home',
    callback_id: 'home_dashboard_v1',
    blocks
  };
}

async function publishHomeTab({ client, userId, logger, apiClient, selectedChannelName, selectedWeek = null }) {
  try {
    const channels = await getBotChannels(client);
    const channelOptions = buildChannelOptions(channels);

    const resolvedChannelName = selectedChannelName || (channels[0] && channels[0].name) || '';

    const isAdmin = await checkIfUserIsAdmin(client, userId);
    let channelStorageStats = [];
    if (isAdmin) {
      channelStorageStats = await Promise.all(
        channels.slice(0, 10).map(channel =>
          getUnstoredMessages(client, apiClient, channel.name, channel.id)
        )
      );
    }

    const {
      apiStatus,
      dbName,
      summaries,
      availableWeeks,
      summaryRecords,
      messagesSummarized,
      errorMessage
    } = await fetchWeeklySummariesForChannel({
      apiClient,
      channelName: resolvedChannelName,
      logger
    });

    const viewPayload = buildSampleHomeView({
      userId,
      channelOptions,
      selectedChannelName: resolvedChannelName,
      selectedWeek: availableWeeks.includes(Number(selectedWeek)) ? Number(selectedWeek) : availableWeeks[0],
      activeChannels: channels.length,
      selectableChannels: channelOptions.length,
      summaryRecords,
      messagesSummarized,
      apiStatus,
      dbName,
      summaries,
      errorMessage,
      isAdmin,
      channelStorageStats
    });

    await client.views.publish({
      user_id: userId,
      view: viewPayload
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
  HOME_SUMMARY_WEEK_SELECT_ACTION_ID,
  HOME_ADMIN_STORE_MEMBERS,
  buildSampleHomeView,
  publishHomeTab,
  encodeDashboardState,
  checkIfUserIsAdmin
};
