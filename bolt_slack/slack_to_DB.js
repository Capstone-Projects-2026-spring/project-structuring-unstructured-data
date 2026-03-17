// Initialize imports
const app = require('./boltApp');
const getMessageModel = require('../mongo_storage/models/Message').getMessageModel;

//Retrieves messages from a channel, filters for type, user, text, and timestamp, and returns cleaned messages
async function getConversationHistory(channelName) {
  try {
    
    const channelId = await channelNameToID(channelName);
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
  }
}


async function insertModelsToDB(channelName) {
    try {
        const history = await getConversationHistory(channelName);
        console.log(`History: ${history.length}.`);
        const Message = getMessageModel(channelName);
        if (!history || history.length === 0) {
          return;
        }

    await Message.insertMany(history);
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
        const channel = channelList.channels.find(c => c.name === channelName);

        return channel ? channel.id : null;
    } catch (error) {
        console.error("Channel List Retrieval Error:", error.data ? error.data.error : error.message);
        throw error;
    }
  }

module.exports = { insertModelsToDB };