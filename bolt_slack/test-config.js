/**
 * Basic configuration test for Slack Bot
 * Run with: node test-config.js
 */

require('dotenv').config(); // Loads .env from current directory

const requiredEnvVars = {
  'SLACK_BOT_TOKEN': process.env.SLACK_BOT_TOKEN,
  'SLACK_SIGNING_SECRET': process.env.SLACK_SIGNING_SECRET,
  'API_BASE_URL': process.env.API_BASE_URL || 'http://localhost:3000',
  'PORT': process.env.PORT || '3000'
};

const optionalEnvVars = {
  'SLACK_BOT_USER_ID': process.env.SLACK_BOT_USER_ID,
  'SLACK_APP_TOKEN': process.env.SLACK_APP_TOKEN,
  'MONGODB_USER': process.env.MONGODB_USER,
  'MONGODB_PASSWORD': process.env.MONGODB_PASSWORD
};

console.log('🔍 Checking Slack Bot Configuration...\n');

let hasErrors = false;

// Check required variables
console.log('📋 Required Configuration:');
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (value && value.trim() !== '') {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
    hasErrors = true;
  }
}

console.log('\n📋 Optional Configuration:');
for (const [key, value] of Object.entries(optionalEnvVars)) {
  if (value && value.trim() !== '') {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`⚠️  ${key}: NOT SET (optional)`);
  }
}

console.log('\n📦 Package Dependencies:');
try {
  const packageJson = require('./package.json');
  const requiredDeps = ['@slack/bolt', 'axios', 'dotenv'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep}: NOT INSTALLED`);
      hasErrors = true;
    }
  });
} catch (error) {
  console.log(`❌ Error reading package.json: ${error.message}`);
  hasErrors = true;
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('\n❌ Configuration has errors! Please fix them before starting the bot.');
  console.log('\n📖 See QUICKSTART.md for setup instructions.');
  process.exit(1);
} else {
  console.log('\n✅ Configuration looks good!');
  console.log('\n🚀 Next steps:');
  console.log('   1. Make sure your Slack App is configured (see QUICKSTART.md)');
  console.log('   2. Start the bot: npm start');
  console.log('   3. Add bot to a channel: /invite @YourBotName');
  console.log('   4. Test with: /channel-info');
}
