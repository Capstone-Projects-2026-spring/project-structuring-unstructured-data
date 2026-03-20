const axios = require('axios');
const app = require('./boltApp');
const config = require('./config');

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
});

const normalizeChannelName = (channelName) => {
  const sanitized = String(channelName || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized) {
    throw new Error('A valid channel name is required');
  }

  return sanitized;
};

async function buildChannelKey(channelName) {
  const normalizedName = normalizeChannelName(channelName);
  const channelId = await channelNameToID(channelName);

  if (!channelId) {
    throw new Error(`Channel ID not found for channel name: ${channelName}`);
  }

  return `${normalizedName}_${channelId}`;
}


//Retrieves messages from a channel, filters for type, user, text, and timestamp, and returns cleaned messages
async function getConversationHistory(channelName) {
  try {
    if (!channelName) {
      throw new Error('channelName is required to fetch conversation history');
    }

    const channelId = await channelNameToID(channelName.trim());
    console.log(`Searching for messages at channel id: ${channelId}.`);
    if (!channelId) {
      throw new Error(`Channel ID not found for channel name: ${channelName}`);
    }
    
    const result = await app.client.conversations.history({
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


async function insertMessageModels(channelName) {
    try {
        if (!channelName) {
          throw new Error('channelName is required to insert messages');
        }

        const channelKey = await buildChannelKey(channelName);
        const history = await getConversationHistory(channelName);
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
async function insertSingleMessageToDB(channelName, messageData) {
    try {
        if (!channelName) {
          throw new Error('channelName is required to insert a message');
        }

        if (!messageData || typeof messageData !== 'object') {
          throw new Error('messageData must be a non-null object');
        }

        const channelKey = await buildChannelKey(channelName);
        const response = await apiClient.post(`/api/messages/${encodeURIComponent(channelKey)}`, messageData);
        return response.data;
    } catch (error) {
        console.error("API insertion error:", error.response?.data || error.message);
        throw error;
    }
}

// Retrieves list of member ids from a specified channel
async function getMembersData(channelId) {
  try {
    const resolvedChannelId = await channelNameToID(channelId);
    console.log(`Searching for messages at channel id: ${resolvedChannelId}.`);
    if (!resolvedChannelId) {
      throw new Error(`Channel ID not found for channel name: ${channelId}`);
    }

    const membersResult = await app.client.conversations.members({
      channel: resolvedChannelId,
    });

    const fullMemberData = [];

    for (const memberId of membersResult.members) {
      const userInfoResult = await app.client.users.info({
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

async function insertUserModels(channelName) {
    try {
        const members = await getMembersData(channelName);
        if (!members || members.length === 0) {
          return;
        }

        const channelKey = await buildChannelKey(channelName);

        const response = await apiClient.post(`/api/users/${encodeURIComponent(channelKey)}`, members);
        console.log(response.data.message || `Member data from channel ${channelName} successfully posted to API.`);
    } catch (error) {
        console.error("Database connection error:", error);
        throw error;
    }
}

async function channelNameToID(channelName) {
    try {
        const channelList = await app.client.conversations.list({
            types: "public_channel"
        });
    const channel = channelList?.channels?.find(c => c.name === channelName);

    return channel ? channel.id : null;
    } catch (error) {
        console.error("Channel List Retrieval Error:", error.data ? error.data.error : error.message);
        throw error;
    }
  }

module.exports = { insertMessageModels, insertSingleMessageToDB, insertUserModels, buildChannelKey, channelNameToID };