/*
This file retrieves messages from channels in the workspace.
Limited by bot membership and permissions.
*/
const { App } = require('@slack/bolt');
require('dotenv').config({ path: './.env' });

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

//Retrieves messages from a channel, filters for type, user, text, and timestamp, and returns cleaned messages
async function getConversationHistory(channelId) {
  try {
    console.log(`Attempting to pull messages from: ${channelId}`);
    
    const result = await app.client.conversations.history({
      channel: channelId,
      // limit = 1000 per call
    });

    // Filters out messages to the user, type, text, and timestamp
    const cleanedMessages = result.messages.map(msg => ({
      user: msg.user,
      type: msg.type,
      text: msg.text,
      ts:   msg.ts
    }));

    console.log(`Message data successfully retrieved from: ${channelId}`);
    return cleanedMessages;
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

// Retrieves list of channels in the workspace. Only permits for public channels
async function getChannelList(){
  try {
    const channelList = await app.client.conversations.list({
      types: "public_channel"
    });
    console.log("Channel list successfully retrieved!");
    return channelList.channels;
  }
  catch (error) {
    console.error("Channel List Retrieval Error:", error.data ? error.data.error : error.message);
  }
}


module.exports = { getConversationHistory, getChannelList };