const axios = require('axios');
const config = require('./config');
const { buildChannelKey, normalizeChannelName } = require('../shared-utils/channelUtils');

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
});

function isSlackChannelId(value) {
  return typeof value === 'string' && /^[CGD][A-Z0-9]+$/.test(value);
}


//Retrieves messages from a channel, filters for type, user, text, and timestamp, and returns cleaned messages
async function getConversationHistory(channelName, options = {}) {
  try {
    if (!channelName) {
      throw new Error('channelName is required to fetch conversation history');
    }

    const client = options.client;
    if (!client) {
      throw new Error('Slack workspace client is required to fetch conversation history');
    }

    const channelId = await channelNameToID(channelName.trim(), client);
    console.log(`Searching for messages at channel id: ${channelId}.`);
    if (!channelId) {
      throw new Error(`Channel ID not found for channel name: ${channelName}`);
    }
    
    const result = await client.conversations.history({
      channel: channelId,
      // limit = 1000 per call
    });

    console.log(`✅ Success! Found ${result.messages.length} messages at channel id: ${channelId}.`);

    return result.messages;
  } catch (error) {
    const errCode = error.data?.error;

    //Conditional for channels the bot isn't a member of 
    if (errCode === "not_in_channel") {
      //console.log(`Skipping ${channelId} — bot is not a member of this channel`);
      return []; 
    }

    console.error("Extraction Error:", error.data ? error.data.error : error.message);
    throw error;
  }
}

// Inserts message model data to the database via API
async function insertMessageModels(channelName, options = {}) {
    try {
        if (!channelName) {
          throw new Error('channelName is required to insert messages');
        }

        const channelId = await channelNameToID(channelName, options.client);
        const channelKey = buildChannelKey(channelName, channelId);
        const history = await getConversationHistory(channelName, { client: options.client });
        console.log(`History: ${history.length}.`);
        if (!history || history.length === 0) {
          return;
        }

        const response = await apiClient.post(`/api/messages/${encodeURIComponent(channelKey)}`, history);
        console.log(response.data.message || `Messages from channel ${channelName} successfully posted to API.`);
    } catch (error) {
        console.error("API connection error:", error);
        throw error;
    }
}

// New function to insert a single message to the database via API
async function insertSingleMessageToDB(channelName, messageData, options = {}) {
    try {
        if (!channelName && !options.channelId) {
          throw new Error('channelName or channelId is required to insert a message');
        }

        if (!messageData || typeof messageData !== 'object') {
          throw new Error('messageData must be a non-null object');
        }

        const providedChannelId = options.channelId;
        let channelId = providedChannelId || (isSlackChannelId(channelName) ? channelName : null);
        let resolvedChannelName = options.channelName || channelName;

        if (!channelId && resolvedChannelName) {
          channelId = await channelNameToID(resolvedChannelName, options.client);
        }

        if (!channelId) {
          throw new Error(`Channel ID not found for channel reference: ${channelName}`);
        }

        // If channel name is unavailable (e.g. channel_not_found), use channel ID as a stable fallback label.
        if (!resolvedChannelName || isSlackChannelId(resolvedChannelName)) {
          resolvedChannelName = channelId;
        }

        const channelKey = buildChannelKey(resolvedChannelName, channelId);
        const response = await apiClient.post(`/api/messages/${encodeURIComponent(channelKey)}`, messageData);
        return response.data;
    } catch (error) {
        console.error("API insertion error:", error.response?.data || error.message);
        throw error;
    }
}

// Retrieves list of member ids from a specified channel
async function getMembersData(channelId, options = {}) {
  try {
    if (!options.client) {
      throw new Error('Slack workspace client is required to fetch channel members');
    }

    const resolvedChannelId = await channelNameToID(channelId, options.client);
    console.log(`Searching for messages at channel id: ${resolvedChannelId}.`);
    if (!resolvedChannelId) {
      throw new Error(`Channel ID not found for channel name: ${channelId}`);
    }

    const membersResult = await options.client.conversations.members({
      channel: resolvedChannelId,
    });

    const fullMemberData = [];

    for (const memberId of membersResult.members) {
      const userInfoResult = await options.client.users.info({
        user: memberId,
      });
      fullMemberData.push(userInfoResult.user);
    }

    return fullMemberData;
    
  } catch (error) {
    console.error("Member ID Retrieval Error:", error.data ? error.data.error : error.message);
    throw error;
  }
}

// Inserts message model data to the database via API
async function insertUserModels(channelName, options = {}) {
    try {
    const members = await getMembersData(channelName, { client: options.client });
        if (!members || members.length === 0) {
          return;
        }

        // Map Slack's 'id' field to 'member_id' for MongoDB schema
        const transformedMembers = members.map(member => ({
          ...member,
          member_id: member.id
        }));

  const channelId = await channelNameToID(channelName, options.client);
        const channelKey = buildChannelKey(channelName, channelId);

        const response = await apiClient.post(`/api/users/${encodeURIComponent(channelKey)}`, transformedMembers);
        console.log(response.data.message || `Member data from channel ${channelName} successfully posted to API.`);
    } catch (error) {
        console.error("Database connection error:", error);
        throw error;
    }
}

// Converts channel name to channel ID using conversations.list API method
async function channelNameToID(channelName, client) {
    if (!client) {
      throw new Error('Slack workspace client is required to resolve channel IDs');
    }

    try {
    if (isSlackChannelId(channelName)) {
      return channelName;
    }

    const channelList = await client.conversations.list({
      types: "public_channel,private_channel"
        });
    const channel = channelList?.channels?.find(c => c.name === channelName);

    return channel ? channel.id : null;
    } catch (error) {
        console.error("Channel List Retrieval Error:", error.data ? error.data.error : error.message);
        throw error;
    }
  }

// Converts user ID to user name using users.info API method
async function userIDToName(userId, client) {
    try {
    if (!client) {
      throw new Error('Slack workspace client is required to resolve user names');
    }

    const userInfo = await client.users.info({
            user: userId
        });
        return userInfo?.user?.real_name || null;
    } catch (error) {
        console.error("User Info Retrieval Error:", error.data ? error.data.error : error.message);
        throw error;
    }
}

module.exports = { 
  insertMessageModels, 
  insertSingleMessageToDB, 
  insertUserModels, 
  buildChannelKey: async (channelName, options = {}) => {
    // Wrapper function to maintain backward compatibility with async API
    const channelId = await channelNameToID(channelName, options.client);
    if (!channelId) {
      throw new Error(`Channel ID not found for channel name: ${channelName}`);
    }
    return buildChannelKey(channelName, channelId);
  },
  channelNameToID, 
  userIDToName,
  normalizeChannelName 
};