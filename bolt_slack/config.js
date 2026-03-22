const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const toBoolean = (value) => String(value).toLowerCase() === 'true';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || `${value}`.trim() === '') {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

const socketMode = toBoolean(process.env.SLACK_SOCKET_MODE);

const config = {
  slackBotToken: requireEnv('SLACK_BOT_TOKEN'),
  slackSigningSecret: requireEnv('SLACK_SIGNING_SECRET'),
  slackAppToken: socketMode ? requireEnv('SLACK_APP_TOKEN') : process.env.SLACK_APP_TOKEN,
  slackBotUserId: process.env.SLACK_BOT_USER_ID,
  socketMode,
  botPort: process.env.SLACK_BOT_PORT || process.env.PORT || 3000,
  apiBaseUrl: process.env.API_URL || process.env.API_BASE_URL || 'http://localhost:5000',
};

module.exports = config;
