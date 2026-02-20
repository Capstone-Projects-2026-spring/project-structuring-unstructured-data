const { App } = require('@slack/bolt');
require('dotenv').config();

// 1. Initialize the App with your secrets
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// 2. The Extraction Function
async function fetchHistory(channelId) {
  try {
    console.log(`🚀 Attempting to pull messages from: ${channelId}`);
    
    const result = await app.client.conversations.history({
      channel: channelId,
    });

    console.log(`✅ Success! Found ${result.messages.length} messages.`);
    console.log(JSON.stringify(result.messages, null, 2)); // Print them nicely
  } catch (error) {
    console.error("❌ Extraction Error:", error.data ? error.data.error : error.message);
  }
}

// 3. Start the App
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');

  // TRIGGER: Replace this with YOUR actual Channel ID (the one starting with C0AE...)
  const targetChannel = "C0AEQNCL30Q"; 
  
  // Initial fetch
  fetchHistory(targetChannel);
  
  // Set up 5-minute interval (300,000 milliseconds)
  setInterval(() => {
    fetchHistory(targetChannel);
  }, 5 * 60 * 1000); // 5 minutes
  
})();