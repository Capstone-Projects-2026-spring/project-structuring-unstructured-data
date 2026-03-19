const { App } = require('@slack/bolt');
const config = require('./config');

const app = new App({
  token: config.slackBotToken,
  signingSecret: config.slackSigningSecret,
});

module.exports = app;
