// Initialize all imports
const mongoose = require('mongoose');
const { Schema, model } = require("mongoose");
const { App } = require('@slack/bolt');
require('dotenv').config({ path: './.env' });



const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const msgSchema = new Schema({
    user: String,
    type: String,
    text: String,
    ts: String
});

const createMessageModel = (channelName) => {
  // Checks if the models for the collection exists
  if (mongoose.models[channelName]) {
    return mongoose.models[channelName];
  }

  const model = mongoose.model(channelName, msgSchema, channelName);
  return model;
};



//Retrieves messages from a channel, filters for type, user, text, and timestamp, and returns cleaned messages
async function getConversationHistory(channelName) {
  try {
    
    const channelId = await channelNameToID(channelName);
    console.log(channelId);
    if (!channelId) {
      throw new Error(`Channel ID not found for channel name: ${channelName}`);
    }
    
    const result = await app.client.conversations.history({
      channel: channelId,
      // limit = 1000 per call
    });
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

//Inserts all messages from all available channels into MongoDB
async function insertModelsToDB() {
    try {
        
        const channelNames = await channelList();
        //console.log(channelNames);

        for(const name of channelNames){
          //console.log(name);
          const history = await getConversationHistory(name);
          const MessageModel = createMessageModel(name);
          await MessageModel.insertMany(history);

        }
        
    } catch (error) {
        console.error("Database connection error:", error);
        throw error;
    }
}

//Returns the ID of a channel in a workspace
async function channelNameToID(channelName) {
    try {
        const channelList = await app.client.conversations.list({
        });

        const channels = channelList.channels;

        for(const channel in channels){
          //console.log(channel)
          //console.log(channels[channel].name)
          if(channelName == channels[channel].name){
            return channels[channel].id;
          }
        }
        //const channel = channelList.channels.find(c => c.name === channelName);

        return null;
    } catch (error) {
        console.error("Channel List Retrieval Error:", error.data ? error.data.error : error.message);
        throw error;
    }
  }


  //Returns list of channel names within a slack workspace
  async function channelList(){
    try{
      const slack_channels = await app.client.conversations.list();

      const channels = slack_channels.channels;

      const channelNames = channels.map(channel => channel.name)
      //console.log(channelNames);

      return channelNames;

    } catch (error){
        console.error("Channel List Retrieval Error:", error.data ? error.data.error : error.message);
    }
  }
module.exports = { insertModelsToDB };