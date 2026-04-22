const { channelNameToID } = require('./slack_to_DB');
const { buildChannelKey } = require('../shared-utils/channelUtils');


const HOME_CHANNEL_SELECT_ACTION_ID = 'home_channel_select';
const HOME_REFRESH_ACTION_ID = 'home_refresh_button';
const HOME_SUMMARY_WEEK_SELECT_ACTION_ID = 'home_summary_week_select';
const HOME_USER_SUMMARY_SELECT_ACTION_ID = 'home_user_summary_select';
const HOME_ADMIN_STORE_MEMBERS = 'home_admin_store_members';
const HOME_ADMIN_VIEW_UNSTORED = 'home_admin_view_unstored';
const MAX_SUMMARY_TEXT_LENGTH = 750;
const CHANNEL_CACHE_TTL_MS = 30 * 60 * 1000; // Increased from 5 to 30 minutes to reduce API calls
const MAX_STATIC_SELECT_OPTIONS = 100;
const MAX_DISTINCT_USER_MENTIONS_DISPLAY = 8;

const channelCacheByWorkspace = new Map();

function getWorkspaceCacheKey(teamId) {
  return typeof teamId === 'string' && teamId.trim() ? teamId.trim() : null;
}

async function resolveWorkspaceContext({ client, teamId, workspaceName, logger }) {
  const normalizedTeamId = typeof teamId === 'string' ? teamId.trim() : '';
  const normalizedWorkspaceName = typeof workspaceName === 'string' ? workspaceName.trim() : '';

  if (normalizedTeamId && normalizedWorkspaceName) {
    return {
      teamId: normalizedTeamId,
      workspaceName: normalizedWorkspaceName
    };
  }

  try {
    const authInfo = await client.auth.test();
    return {
      teamId: normalizedTeamId || authInfo?.team_id || '',
      workspaceName: normalizedWorkspaceName || authInfo?.team || ''
    };
  } catch (error) {
    if (logger) {
      logger.warn('[resolveWorkspaceContext] auth.test failed; using payload workspace context when available.', error);
    } else {
      console.warn('[resolveWorkspaceContext] auth.test failed; using payload workspace context when available.', error);
    }

    return {
      teamId: normalizedTeamId,
      workspaceName: normalizedWorkspaceName
    };
  }
}

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

  return new Date(parsed).toLocaleString('en-US', { timeZone: 'America/New_York' });
}

function formatSummaryDate(ts, fallback = 'Unknown date') {
  if (!ts) {
    return fallback;
  }

  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function normalizeToUtcSundayStartIso(inputTs) {
  if (!inputTs) {
    return '';
  }

  const parsed = new Date(inputTs);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const utcDateOnly = new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0,
    0,
    0,
    0
  ));

  const daysSinceSunday = utcDateOnly.getUTCDay();
  utcDateOnly.setUTCDate(utcDateOnly.getUTCDate() - daysSinceSunday);
  return utcDateOnly.toISOString().replace('.000Z', 'Z');
}

function formatWeekRangeLabel(weekStartIso) {
  const start = new Date(weekStartIso);
  if (Number.isNaN(start.getTime())) {
    return '';
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startText = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const endText = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return `${startText} - ${endText}`;
}

function getWeekInfo(summary) {
  const explicitWeekStart = normalizeToUtcSundayStartIso(summary && summary.week_start_utc);
  if (explicitWeekStart) {
    const rangeLabel = formatWeekRangeLabel(explicitWeekStart);
    return {
      key: `ws:${explicitWeekStart}`,
      weekStartIso: explicitWeekStart,
      label: rangeLabel || explicitWeekStart,
      kind: 'week-start'
    };
  }

  return {
    key: 'unknown',
    weekStartIso: '',
    label: 'Unknown week',
    kind: 'unknown'
  };
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

function encodeDashboardState({ channelName, selectedWeek, selectedUser }) {
  const normalizedSelectedWeek = typeof selectedWeek === 'string' && selectedWeek.trim()
    ? selectedWeek.trim()
    : null;
  const normalizedSelectedUser = typeof selectedUser === 'string' && selectedUser.trim()
    ? selectedUser.trim()
    : null;

  return JSON.stringify({
    channelName: channelName || '',
    selectedWeek: normalizedSelectedWeek,
    selectedUser: normalizedSelectedUser
  });
}

function getAvailableWeeks(summaries) {
  const bucketsByKey = new Map();

  for (const summary of summaries) {
    const weekInfo = getWeekInfo(summary);
    if (weekInfo.key === 'unknown') {
      continue;
    }

    const sortValue = weekInfo.weekStartIso
      ? Date.parse(weekInfo.weekStartIso)
      : Number((summary && summary.week_of) || 0);

    if (!bucketsByKey.has(weekInfo.key)) {
      bucketsByKey.set(weekInfo.key, {
        ...weekInfo,
        sortValue: Number.isFinite(sortValue) ? sortValue : 0
      });
    }
  }

  return Array.from(bucketsByKey.values())
    .sort((left, right) => right.sortValue - left.sortValue)
    .map((bucket) => bucket.key);
}

function buildWeekOptions(availableWeeks) {
  return availableWeeks.slice(0, MAX_STATIC_SELECT_OPTIONS).map((weekKey) => {
    const weekInfo = getWeekInfo({
      week_start_utc: weekKey.startsWith('ws:') ? weekKey.slice(3) : null,
      week_of: weekKey.startsWith('wk:') ? weekKey.slice(3) : null
    });

    return {
      text: {
        type: 'plain_text',
        text: weekInfo.kind === 'week-start'
          ? `${weekInfo.label}`
          : weekInfo.label
      },
      value: weekKey
    };
  });
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

function getCachedChannels(teamId) {
  const cacheKey = getWorkspaceCacheKey(teamId);
  if (!cacheKey) {
    return null;
  }

  const cachedEntry = channelCacheByWorkspace.get(cacheKey);

  if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
    return cachedEntry.channels;
  }

  if (cachedEntry) {
    channelCacheByWorkspace.delete(cacheKey);
  }

  return null;
}

function setCachedChannels(teamId, channels) {
  const cacheKey = getWorkspaceCacheKey(teamId);
  if (!cacheKey) {
    return;
  }

  channelCacheByWorkspace.set(cacheKey, {
    channels,
    expiresAt: Date.now() + CHANNEL_CACHE_TTL_MS
  });
}

async function getBotChannels(client, teamId) {
  const cachedChannels = getCachedChannels(teamId);
  if (cachedChannels) {
    const first3 = cachedChannels.slice(0, 3).map(c => c.name).join(', ');
    console.log(`[getBotChannels] Using cached channels for teamId=${teamId}. Count: ${cachedChannels.length}, First 3: [${first3}]`);
    return cachedChannels;
  }

  const channels = [];
  let cursor;
  let pageCount = 0;
  const maxPages = 2; // Limit to 2 pages (400 channels) for performance

  console.log(`[getBotChannels] Fetching fresh channels from Slack for teamId=${teamId}...`);

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
    pageCount++;
    
    // Stop paginating after maxPages to improve performance
    if (pageCount >= maxPages) {
      if (cursor) {
        console.log(`[getBotChannels] Stopped after ${pageCount} pages (${channels.length} channels fetched). More channels exist but not fetched for performance.`);
      }
      break;
    }
  } while (cursor);

  channels.sort((a, b) => a.name.localeCompare(b.name));
  const first3 = channels.slice(0, 3).map(c => c.name).join(', ');
  console.log(`[getBotChannels] Fresh fetch complete for teamId=${teamId}. Total: ${channels.length}, First 3: [${first3}]`);
  setCachedChannels(teamId, channels);
  return channels;
}

async function fetchWeeklySummariesForChannel({ apiClient, channelName, client, logger }) {
  if (!channelName) {
    if (logger) {
      logger.warn('[fetchWeeklySummariesForChannel] No channel name provided');
    } else {
      console.warn('[fetchWeeklySummariesForChannel] No channel name provided');
    }
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
    if (logger) {
      logger.info(`[fetchWeeklySummariesForChannel] Starting for channel: ${channelName}`);
    } else {
      console.log(`[fetchWeeklySummariesForChannel] Starting for channel: ${channelName}`);
    }

    const channelId = await channelNameToID(channelName, client);
    if (!channelId) {
      if (logger) {
        logger.warn(`[fetchWeeklySummariesForChannel] Channel ID not found for: ${channelName}`);
      } else {
        console.warn(`[fetchWeeklySummariesForChannel] Channel ID not found for: ${channelName}`);
      }
      return {
        apiStatus: 'Channel not found',
        dbName: '',
        summaries: [],
        availableWeeks: [],
        summaryRecords: 0,
        messagesSummarized: 0,
        errorMessage: `Channel ID not found for channel name: ${channelName}`
      };
    }

    const databaseKey = buildChannelKey(channelName, channelId);
    if (logger) {
      logger.info(`[fetchWeeklySummariesForChannel] Built database key: ${databaseKey}`);
    } else {
      console.log(`[fetchWeeklySummariesForChannel] Built database key: ${databaseKey}`);
    }

    // Always fetch all summaries so the week dropdown can show every available
    // week option. Week-specific filtering is applied in the Home view renderer.
    const response = await apiClient.get(`/api/summaries/${encodeURIComponent(databaseKey)}`);
    const summaries = response.data && Array.isArray(response.data.summaries)
      ? response.data.summaries
      : [];

    if (logger) {
      logger.info(`[fetchWeeklySummariesForChannel] API Response received. Summaries count: ${summaries.length}`);
    } else {
      console.log(`[fetchWeeklySummariesForChannel] API Response received. Summaries count: ${summaries.length}`);
    }

    const messagesSummarized = summaries.reduce((sum, summary) => {
      const count = Number(summary && summary.message_count);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
    const availableWeeks = getAvailableWeeks(summaries);

    if (logger) {
      logger.info(`[fetchWeeklySummariesForChannel] Processed summaries - Records: ${summaries.length}, Messages: ${messagesSummarized}`);
    } else {
      console.log(`[fetchWeeklySummariesForChannel] Processed summaries - Records: ${summaries.length}, Messages: ${messagesSummarized}`);
    }

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
    const connectionRefused = error && (error.code === 'ECONNREFUSED' || (error.cause && error.cause.code === 'ECONNREFUSED'));
    const requestBaseUrl = error && error.config && error.config.baseURL ? error.config.baseURL : 'unknown';
    const requestUrl = error && error.config && error.config.url ? error.config.url : 'unknown';

    if (logger) {
      logger.error('Error fetching weekly summaries for Home tab:', error);
      if (connectionRefused) {
        logger.error(`[fetchWeeklySummariesForChannel] Connection refused for ${requestBaseUrl}${requestUrl}. Ensure mongo_storage API server is running.`);
      }
    } else {
      console.error('Error fetching weekly summaries for Home tab:', error);
      if (connectionRefused) {
        console.error(`[fetchWeeklySummariesForChannel] Connection refused for ${requestBaseUrl}${requestUrl}. Ensure mongo_storage API server is running.`);
      }
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

async function fetchUserSummariesForChannel({ apiClient, channelName, client, logger }) {
  if (!channelName) {
    return {
      userSummaries: [],
      userSummaryRecords: 0,
      errorMessage: ''
    };
  }

  try {
    const channelId = await channelNameToID(channelName, client);
    if (!channelId) {
      return {
        userSummaries: [],
        userSummaryRecords: 0,
        errorMessage: `Channel ID not found for channel name: ${channelName}`
      };
    }

    const databaseKey = buildChannelKey(channelName, channelId);
    const response = await apiClient.get(`/api/user_summaries/${encodeURIComponent(databaseKey)}`);
    const userSummaries = response.data && Array.isArray(response.data.userSummaries)
      ? response.data.userSummaries
      : [];

    return {
      userSummaries,
      userSummaryRecords: userSummaries.length,
      errorMessage: ''
    };
  } catch (error) {
    if (logger) {
      logger.error('Error fetching user summaries for Home tab:', error);
    } else {
      console.error('Error fetching user summaries for Home tab:', error);
    }

    return {
      userSummaries: [],
      userSummaryRecords: 0,
      errorMessage: error.message || 'Unknown API error'
    };
  }
}

async function getUnstoredMembers(client, apiClient, channelName, channelId) {
  try {
    const channelKey = buildChannelKey(channelName, channelId);

    const membersResult = await client.conversations.members({ channel: channelId });
    const slackMemberIds = membersResult.members || [];

    const response = await apiClient.get(`/api/users/${encodeURIComponent(channelKey)}`);
    const storedMembers = response.data || [];
    const storedMemberIds = new Set(storedMembers.map(m => m.member_id || m.id));

    const unstoredCount = slackMemberIds.filter(id => !storedMemberIds.has(id)).length;
    return { channelName, total: slackMemberIds.length, stored: storedMembers.length, unstored: unstoredCount };
  } catch (error) {
    return { channelName, total: 'N/A', stored: 'N/A', unstored: 'N/A', notInChannel: error.data?.error === 'not_in_channel' };
  }
}

async function getUnstoredMessages(client, apiClient, channelName, channelId) {
  try {
    const slackResult = await client.conversations.history({
      channel: channelId,
      limit: 1000
    });
    const isHumanMessage = (msg) => !msg.bot_id && msg.subtype !== 'bot_message';

    const slackMessages = (slackResult.messages || []).filter(isHumanMessage);

    const channelKey = buildChannelKey(channelName, channelId);
    const response = await apiClient.get(`/api/messages/${encodeURIComponent(channelKey)}`);
    const storedMessages = (response.data || []).filter(isHumanMessage);

    const storedTimestamps = new Set(storedMessages.map(msg => msg.ts));
    const unstoredCount = slackMessages.filter(msg => !storedTimestamps.has(msg.ts)).length;

    return {
      channelName,
      channelId,
      channelKey,
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
  const weekInfo = getWeekInfo(summary);
  const messageCount = summary.message_count != null ? summary.message_count : 'n/a';
  const distinctUserIds = Array.isArray(summary.distinct_users)
    ? Array.from(new Set(
      summary.distinct_users
        .map((value) => String(value || '').trim())
        .map((value) => {
          const mentionMatch = value.match(/^<@([A-Za-z0-9]+)>!?$/);
          return mentionMatch ? mentionMatch[1] : value;
        })
        .filter((value) => value.length > 0)
    ))
    : [];

  const displayMentions = distinctUserIds
    .slice(0, MAX_DISTINCT_USER_MENTIONS_DISPLAY)
    .map((userId) => `<@${userId}>`);
  const hiddenUserCount = Math.max(0, distinctUserIds.length - displayMentions.length);

  const distinctUsers = displayMentions.length
    ? `${displayMentions.join(' ')}${hiddenUserCount > 0 ? ` + ${hiddenUserCount} more` : ''}`
    : (summary.distinct_users != null ? String(summary.distinct_users) : 'n/a');
  const generatedAt = formatSummaryTimestamp(summary.generated_at_utc);

  return [
    {
      type: 'mrkdwn',
      text: `*Week Range*\n${weekInfo.label}`
    },
    {
      type: 'mrkdwn',
      text: `*Messages*\n${messageCount}`
    },
    {
      type: 'mrkdwn',
      text: `*Distinct users (${distinctUserIds.length || 'n/a'})*\n${distinctUsers}`
    },
    {
      type: 'mrkdwn',
      text: `*Generated*\n${generatedAt}`
    }
  ];
}

function truncateOptionLabel(label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) {
    return 'Unknown user';
  }

  if (trimmed.length <= 75) {
    return trimmed;
  }

  return `${trimmed.slice(0, 74).trimEnd()}…`;
}

function buildUserSummaryBuckets(userSummaries) {
  const buckets = new Map();

  for (const summary of userSummaries) {
    const userId = String(summary && summary.user_id ? summary.user_id : '').trim();
    if (!userId) {
      continue;
    }

    const realName = String(summary && summary.real_name ? summary.real_name : '').trim();
    const label = realName ? realName : `<@${userId}>`;
    const generatedAt = Date.parse(summary && summary.generated_at_utc ? summary.generated_at_utc : '');

    if (!buckets.has(userId)) {
      buckets.set(userId, {
        userId,
        label,
        latestSummary: summary,
        sortValue: Number.isFinite(generatedAt) ? generatedAt : 0
      });
      continue;
    }

    const existing = buckets.get(userId);
    const summarySortValue = Number.isFinite(generatedAt) ? generatedAt : 0;
    if (summarySortValue >= existing.sortValue) {
      existing.latestSummary = summary;
      existing.sortValue = summarySortValue;
    }
  }

  return Array.from(buckets.values()).sort((left, right) => right.sortValue - left.sortValue);
}

function buildUserSummaryBlocks({ selectedChannelName, userSummaries, selectedUser }) {
  if (!selectedChannelName) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Select a channel above to load individual user summaries.'
        }
      }
    ];
  }

  if (!userSummaries.length) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `No user summaries found yet for *#${selectedChannelName}*.`
        }
      }
    ];
  }

  const userBuckets = buildUserSummaryBuckets(userSummaries);
  const userOptions = userBuckets.slice(0, MAX_STATIC_SELECT_OPTIONS).map((bucket) => ({
    text: {
      type: 'plain_text',
      text: truncateOptionLabel(bucket.label)
    },
    value: bucket.userId
  }));

  const selectedUserId = typeof selectedUser === 'string' ? selectedUser.trim() : '';
  const resolvedSelectedUserId = userOptions.some((option) => option.value === selectedUserId)
    ? selectedUserId
    : (userOptions[0] ? userOptions[0].value : '');

  const selectedUserOption = userOptions.find((option) => option.value === resolvedSelectedUserId) || null;
  const selectedUserBucket = userBuckets.find((bucket) => bucket.userId === resolvedSelectedUserId) || null;
  const selectedSummary = selectedUserBucket ? selectedUserBucket.latestSummary : null;
  const selectedSummaryText = truncateText(selectedSummary && selectedSummary.summary_text, MAX_SUMMARY_TEXT_LENGTH);
  const selectedGeneratedAt = formatSummaryTimestamp(selectedSummary && selectedSummary.generated_at_utc);
  const selectedMessageCount = selectedSummary && selectedSummary.message_count != null
    ? selectedSummary.message_count
    : 'n/a';
  const selectedUserLabel = selectedUserBucket
    ? selectedUserBucket.label
    : 'Unknown user';

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'User Summaries'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Select a user in *#${selectedChannelName}* to view their latest summary:`
      },
      accessory: {
        type: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select user'
        },
        action_id: HOME_USER_SUMMARY_SELECT_ACTION_ID,
        options: userOptions,
        ...(selectedUserOption ? { initial_option: selectedUserOption } : {})
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Showing latest summary for *${selectedUserLabel}*.`
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:bust_in_silhouette: *<@${resolvedSelectedUserId}>*\n${selectedSummaryText}`
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Messages*\n${selectedMessageCount}`
        },
        {
          type: 'mrkdwn',
          text: `*Generated*\n${selectedGeneratedAt}`
        }
      ]
    },
    {
      type: 'divider'
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
    .sort((left, right) => {
      const leftDate = Date.parse(left.summary_day_utc || left.generated_at_utc || '');
      const rightDate = Date.parse(right.summary_day_utc || right.generated_at_utc || '');
      return rightDate - leftDate;
    });

  const availableWeeks = getAvailableWeeks(sortedSummaries);
  const selectedWeekKey = typeof selectedWeek === 'string' ? selectedWeek : '';
  const resolvedSelectedWeek = availableWeeks.includes(selectedWeekKey)
    ? selectedWeekKey
    : (availableWeeks[0] || null);

  const weekOptions = buildWeekOptions(availableWeeks);
  const selectedWeekOption = resolvedSelectedWeek == null
    ? null
    : weekOptions.find((option) => option.value === resolvedSelectedWeek);
  const visibleSummaries = resolvedSelectedWeek == null
    ? sortedSummaries
    : sortedSummaries.filter((summary) => getWeekInfo(summary).key === resolvedSelectedWeek);
  const blocks = [];

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Weekly Summaries'
    }
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
          : `Showing ${visibleSummaries.length} daily updates for *${(getWeekInfo({
            week_start_utc: resolvedSelectedWeek.startsWith('ws:') ? resolvedSelectedWeek.slice(3) : null,
            week_of: resolvedSelectedWeek.startsWith('wk:') ? resolvedSelectedWeek.slice(3) : null
          }).label)}*.`
      }
    ]
  });

  for (const [index, summary] of visibleSummaries.entries()) {
    const summaryDate = formatSummaryDate(summary.summary_day_utc, 'Unknown date');
    const summaryTitle = summaryDate;
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
  workspaceName,
  channelOptions,
  selectedChannelName,
  selectedWeek,
  selectedUser,
  activeChannels,
  selectableChannels,
  summaryRecords,
  userSummaryRecords,
  messagesSummarized,
  apiStatus,
  dbName,
  summaries,
  userSummaries,
  errorMessage,
  isAdmin,
  channelStorageStats=[],
  memberStats=null
}) {
  const generatedAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
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
        text: `Welcome <@${userId}>! Here you can access and manage summaries and structured data for all the conversations in *${workspaceName || 'this workspace'}*.`
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
            selectedWeek,
            selectedUser
          })
        }
      ]
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Channel Overview'
      }
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
          text: `*User Summaries*\n${userSummaryRecords}`
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

  blocks.push(...buildUserSummaryBlocks({
    selectedChannelName,
    userSummaries,
    selectedUser
  }));

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
    ...(memberStats && memberStats.totalUnsaved > 0
      ? [{
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `:warning: ${memberStats.totalUnsaved} member${memberStats.totalUnsaved !== 1 ? 's' : ''} not saved in ${memberStats.channelsWithUnsaved} channel${memberStats.channelsWithUnsaved !== 1 ? 's' : ''}`
          }]
        }]
      : []
    ),
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Channel Storage Overview',
        emoji: true
      }
    },
    { type: 'divider' },
    ...(channelStorageStats.length === 0
      ? [{
          type: 'section',
          text: { type: 'mrkdwn', text: '_No channel data available._' }
        }]
      : channelStorageStats.map(ch => {
          if (ch.notInChannel || ch.total === 'N/A') {
            return {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*#${ch.channelName}*` },
                { type: 'mrkdwn', text: `⛔ Bot is not in this channel` }
              ]
            };
          }
          if (ch.total === 0) {
            return {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*#${ch.channelName}*` },
                { type: 'mrkdwn', text: `💬 No messages to store yet` }
              ]
            };
          }
          const allStored = ch.unstored === 0;
          const statusIcon = allStored ? '✅' : '⚠️';
          const statusText = allStored ? 'All messages stored' : `${ch.unstored} messages not stored`;
          const block = {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*#${ch.channelName}*` },
              { type: 'mrkdwn', text: `${statusIcon} ${statusText}\n${ch.stored} / ${ch.total} stored` }
            ]
          };
          if (!allStored) {
            block.accessory = {
              type: 'button',
              text: { type: 'plain_text', text: '🔍 View Unstored', emoji: true },
              value: JSON.stringify({ channelId: ch.channelId, channelName: ch.channelName, channelKey: ch.channelKey }),
              action_id: HOME_ADMIN_VIEW_UNSTORED
            };
          }
          return block;
        })
    ),
    {
      type: 'divider'
    }
  )
  }

  const view = {
    type: 'home',
    callback_id: 'home_dashboard_v1',
    blocks
  };

  console.log('[buildSampleHomeView] View payload structure:', {
    type: view.type,
    callback_id: view.callback_id,
    blocksCount: view.blocks.length,
    blockTypes: view.blocks.map(b => b.type)
  });

  return view;
}

async function publishHomeTab({ client, userId, teamId, workspaceName, logger, apiClient, selectedChannelName, selectedWeek = null, selectedUser = null }) {
  try {
    const resolvedWorkspaceContext = await resolveWorkspaceContext({
      client,
      teamId,
      workspaceName,
      logger
    });
    const resolvedTeamId = resolvedWorkspaceContext.teamId || null;
    const resolvedWorkspaceName = resolvedWorkspaceContext.workspaceName || workspaceName;

    console.log(`[publishHomeTab] ========== START HOME PUBLISH ==========`);
    console.log(`[publishHomeTab] User: ${userId} | ResolvedTeamId: ${resolvedTeamId} | Workspace: ${resolvedWorkspaceName}`);
    console.log(`[publishHomeTab] Input teamId: ${teamId || '(none)'} | Input workspaceName: ${workspaceName || '(none)'}`);

    if (logger) {
      logger.info(`[publishHomeTab] Starting for user ${userId} (teamId=${resolvedTeamId || 'unknown'})`);
    } else {
      console.log(`[publishHomeTab] Starting for user ${userId} (teamId=${resolvedTeamId || 'unknown'})`);
    }

    const channels = await getBotChannels(client, resolvedTeamId);
    const channelOptions = buildChannelOptions(channels);
    const first3Channels = channels.slice(0, 3).map(c => `#${c.name}`).join(', ');
    console.log(`[publishHomeTab] Loaded channels for Home dropdown: ${channels.length} total | First 3: ${first3Channels}`);

    const resolvedChannelName = selectedChannelName || (channels[0] && channels[0].name) || '';
    console.log(`[publishHomeTab] Selected channel: ${resolvedChannelName || '(none)'}`);

    if (logger) {
      logger.info(`[publishHomeTab] Fetching summaries for channel: ${resolvedChannelName}`);
    } else {
      console.log(`[publishHomeTab] Fetching summaries for channel: ${resolvedChannelName}`);
    }

    const isAdmin = await checkIfUserIsAdmin(client, userId);
    let channelStorageStats = [];
    let memberStats = null;
    if (isAdmin) {
      const channelsToCheck = channels.slice(0, 10);
      [channelStorageStats] = await Promise.all([
        Promise.all(channelsToCheck.map(channel =>
          getUnstoredMessages(client, apiClient, channel.name, channel.id)
        ))
      ]);
      const memberStatsPerChannel = await Promise.all(
        channelsToCheck.map(channel =>
          getUnstoredMembers(client, apiClient, channel.name, channel.id)
        )
      );
      const totalUnsaved = memberStatsPerChannel.reduce((sum, s) => sum + (typeof s.unstored === 'number' ? s.unstored : 0), 0);
      const channelsWithUnsaved = memberStatsPerChannel.filter(s => typeof s.unstored === 'number' && s.unstored > 0).length;
      memberStats = { totalUnsaved, channelsWithUnsaved };
    }

    const [weeklySummaryResult, userSummaryResult] = await Promise.all([
      fetchWeeklySummariesForChannel({
        apiClient,
        channelName: resolvedChannelName,
        client,
        logger
      }),
      fetchUserSummariesForChannel({
        apiClient,
        channelName: resolvedChannelName,
        client,
        logger
      })
    ]);

    const {
      apiStatus,
      dbName,
      summaries,
      availableWeeks,
      summaryRecords,
      messagesSummarized,
      errorMessage: weeklySummaryErrorMessage
    } = weeklySummaryResult;
    const {
      userSummaries,
      userSummaryRecords,
      errorMessage: userSummaryErrorMessage
    } = userSummaryResult;
    const errorMessage = weeklySummaryErrorMessage || userSummaryErrorMessage;

    if (logger) {
      logger.info(`[publishHomeTab] Summaries fetched - Records: ${summaryRecords}, Messages: ${messagesSummarized}, Status: ${apiStatus}`);
    } else {
      console.log(`[publishHomeTab] Summaries fetched - Records: ${summaryRecords}, Messages: ${messagesSummarized}, Status: ${apiStatus}`);
    }

    const viewPayload = buildSampleHomeView({
      userId,
      workspaceName: resolvedWorkspaceName,
      channelOptions,
      selectedChannelName: resolvedChannelName,
      selectedWeek: availableWeeks.includes(selectedWeek) ? selectedWeek : availableWeeks[0],
      selectedUser,
      activeChannels: channels.length,
      selectableChannels: channelOptions.length,
      summaryRecords,
      userSummaryRecords,
      messagesSummarized,
      apiStatus,
      dbName,
      summaries,
      userSummaries,
      errorMessage,
      isAdmin,
      channelStorageStats,
      memberStats
    });

    if (logger) {
      logger.info(`[publishHomeTab] Publishing view with ${viewPayload.blocks.length} blocks`);
    } else {
      console.log(`[publishHomeTab] Publishing view with ${viewPayload.blocks.length} blocks`);
    }

    try {
      const result = await client.views.publish({
        user_id: userId,
        view: viewPayload
      });
      
      if (logger) {
        logger.info(`[publishHomeTab] View published. Response status: ${result.ok ? 'OK' : 'FAILED'}`);
      } else {
        console.log(`[publishHomeTab] View published. Response: ${JSON.stringify(result)}`);
      }
    } catch (publishError) {
      if (logger) {
        logger.error(`[publishHomeTab] Failed to publish view:`, publishError);
      } else {
        console.error(`[publishHomeTab] Failed to publish view:`, publishError);
      }
      throw publishError;
    }

    if (logger) {
      logger.info(`[publishHomeTab] Home tab published successfully for user ${userId}`);
    } else {
      console.log(`[publishHomeTab] Home tab published successfully for user ${userId}`);
    }
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
  HOME_USER_SUMMARY_SELECT_ACTION_ID,
  HOME_ADMIN_STORE_MEMBERS,
  HOME_ADMIN_VIEW_UNSTORED,
  buildSampleHomeView,
  publishHomeTab,
  encodeDashboardState,
  checkIfUserIsAdmin
};
