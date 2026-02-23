const { App } = require('@slack/bolt');
require('dotenv').config();

// Initialize app w/ secrets
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// GET select number of messages via conversations.history
async function getConversationHistory(channelId) {
  try {
    console.log(`🚀 Attempting to pull messages from: ${channelId}`);
    
    const result = await app.client.conversations.history({
      channel: channelId,
      // limit = 1000 per call
    });

    console.log(`✅ Success! Found ${result.messages.length} messages.`);
    console.log(JSON.stringify(result.messages, null, 2));
  } catch (error) {
    console.error("❌ Extraction Error:", error.data ? error.data.error : error.message);
  }
}

// GET info about channel via conversations.info
async function getConversationInfo(channelId) {
  try {  
    const result = await app.client.conversations.info({
      channel: channelId,
    });

    console.log(`✅ Success! Found data for conversation ${result.channel.name}!!`);
    console.log(JSON.stringify(result.channel, null, 2));
  } catch (error) {
    console.error("❌ Retrieval Error:", error.data ? error.data.error : error.message);
  }
}

// App start
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');

  const targetChannel = "C0ADQ1YAK7D"; 
    
  // Initial fetch
  getConversationHistory(targetChannel);
  getConversationInfo(targetChannel);

  // Set up 5-minute interval (300,000 milliseconds)
  setInterval(() => {
    fetchHistory(targetChannel);
  }, 5 * 60 * 1000); // 5 minutes
})();