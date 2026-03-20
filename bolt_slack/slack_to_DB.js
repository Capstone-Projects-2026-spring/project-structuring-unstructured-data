const axios = require('axios');
const app = require('./boltApp');
const config = require('./config');

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
});

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


async function insertModelsToDB(channelName) {
    try {
        if (!channelName) {
          throw new Error('channelName is required to insert messages');
        }

        const history = await getConversationHistory(channelName);
        console.log(`History: ${history.length}.`);
        if (!history || history.length === 0) {
          return;
        }

        const response = await apiClient.post(`/api/messages/${channelName}`, history);
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

        const response = await apiClient.post(`/api/messages/${channelName}`, messageData);
        return response.data;
    } catch (error) {
        console.error("API insertion error:", error.response?.data || error.message);
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

module.exports = { insertModelsToDB, insertSingleMessageToDB };
