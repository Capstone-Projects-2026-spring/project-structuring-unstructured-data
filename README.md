<div align="center">

# Structuring Unstructured Data
[![Report Issue on Jira](https://img.shields.io/badge/Report%20Issues-Jira-0052CC?style=flat&logo=jira-software)](https://temple-cis-projects-in-cs.atlassian.net/jira/software/c/projects/DT/issues)
[![Deploy Docs](https://github.com/ApplebaumIan/tu-cis-4398-docs-template/actions/workflows/deploy.yml/badge.svg)](https://github.com/ApplebaumIan/tu-cis-4398-docs-template/actions/workflows/deploy.yml)
[![Documentation Website Link](https://img.shields.io/badge/-Documentation%20Website-brightgreen)](https://applebaumian.github.io/tu-cis-4398-docs-template/)


</div>

## Keywords

**Section 001, Slack API, JavaScript, Bolt, Node.js Python, MongoDB, Google Gemini, Generative AI, Render**.

## Project Abstract

This project aims to develop a novel application capable of collecting and organizing message data contained in company communication platforms such as Slack. The application will be able to structure any message data across different channels and users into a consistent data model once it is granted proper permissions to access a channel or user direct messaging. The resulting organized data can then be used in multiple workplace tasks such as automating regularly performed actions or summarizing projects for newly onboarded team members.


## High Level Requirement

The application will primarily function as a tool compatible with Slack that can extract context from direct messages (DMs) between users and channels/conversations between multiple users. The tool operates within Slack's interface through a bot or similar automation, meaning that users will adjust the application's settings or control whether they consent to their messages being collected through the application directly. When a user begins a DM or enters a conversation where the bot is configured, the user is prompted to give permission for all message data to be collected (either via an opt-in or hybrid approval). If active, the tool marks whenever a new message within the DM or conversation has been stored in memory for contextualization. When the user wishes to retrieve their structured message data, they can prompt the tool within Slack, which will result in the application displaying a basic data model of all included messages in a digestable format, which can be directly downloaded or accessed for the use of context-based automation at a larger scale, such as for summarizing entire channel's worth of information.

## Conceptual Design

For the scope of our project, our application's design will utilize the Slack API to access all user, message, and channel data, but development of a codebase compatible with multiple communication platforms is anticipated. For the best compatibility with the existing Web API that communication platforms generally provide, the application will integrate with the target platform using routes composed in JavaScript and Node.js; this version of the app specifically will leverege the Bolt for JavaScript open-source framework in the backend designed directly for Slack, allowing both the access of Slack data and interaction with Slack's UI. The tool's backend also will have the ability to extract context and structure data into meaningful units, accomplished through a custom built LLM or similar NLP model designed for organizing data based on learned language patterns. The tools used to implement this may shift as the project scope is fully defined, but possible services include the LangChain framework for Python or JavaScript or the LangExtract Python library. All instances of raw user and message data, as well as all the resulting strucutred conversation data will be placed in a persistent storage source such as MongoDB or NoSQL.

## Background

Communication platforms like Slack are being increasingly normalized in various workplace environments to discuss projects, schedule meetings, and many other interactions relevant to the specific work the business does. Often, this increased use in messaging applications results in signficant information being buried deep in Slack channel discussions or previous direct messages; the further back a conversation may be, the more context may be necessary for a user to get a proper understanding of the subjects being discussed, making it difficult to fully process information being covered in a conversation's history. Several custom bots and pre-built automation features exist for Slack that can summarize individual messages or perform actions within Slack when an expected message type is sent, but few technologies currently exist that can organize a collection of message data from a conversation into a standardized data model that fully addresses the possible context that can exist and change every time a user sends a new message. By developing a Slack bot with these features in mind, the use cases for structured message data are greatly expanded.

## Required Resources

This project requires significant backround research on existing LLMs that develop context for extensive collections of data, especially from diverse text sources such as documents or verbal conversations, as understanding the current developments of applications that perform a similar structuring task can help discover applicable tools or well-tested data extraction/processing methods. Reviewing existing automations within Slack and other communication platforms will also be useful for the modeling places where the user interacts directly with the interface to ensure the essential features of the tool are fully and securely realized.

## Collaborators

<div align="center">

[//]: # (Replace with your collaborators)
[Wyatt Zantua](https://github.com/zantuaw09)

[John Currie](https://github.com/John-C-Currie)

[Keith Winter](https://github.com/KeWinter)

[Donte' Harmon](https://github.com/dontetu)

[Fares Hagos](https://github.com/FaresHagostu)
</div>

---

# For the User

This section contains everything you need to install, configure, and use the application. If you're looking for information about development or maintenance, see "For the Maintainer" below.

## Quick Start Guide

### One-Click Add (Cloud Hosted - Easiest)
To add SUD Bud directly to your Slack workspace, click this button  
<a href="https://slack.com/oauth/v2/authorize?client_id=10472452206738.10715593272068&scope=reactions:write,app_mentions:read,channels:history,channels:read,chat:write,commands,im:history,im:read,im:write,reactions:read,users:read,groups:read,mpim:read&user_scope="><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>

Or click this link!
[Click Here](https://slack.com/oauth/v2/authorize?client_id=10472452206738.10715593272068&scope=reactions:write,app_mentions:read,channels:history,channels:read,chat:write,commands,im:history,im:read,im:write,reactions:read,users:read,groups:read,mpim:read&user_scope=)




## Setup For Experienced Users

If you've deployed Node.js + MongoDB apps before:

1. **Clone/download** the repository
2. **Set up a Slack app** at [api.slack.com/apps](https://api.slack.com/apps) (or use manifest file in `bolt_slack/slack-app-manifest.json`)
3. **Create `.env`** in repo root with tokens from Slack + MongoDB credentials
4. **Run setup:** `npm install` (both `bolt_slack/` and `mongo_storage/`)
5. **Start services:**
   ```powershell
   # Terminal 1: MongoDB API
   cd mongo_storage && node server.js
   
   # Terminal 2: Slack Bot
   cd bolt_slack && npm start
   ```
6. **Invite bot** to your Slack channels: `/invite @YourBotName`
7. **Done!** Use `/store-messages`, `/messages`, `/channel-info` in Slack

## System Requirements

Before installing, ensure your system meets these minimum requirements:

### Required Software
- **Node.js:** 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm:** 9.0.0 or higher (bundled with Node.js)
- **MongoDB:** One of the following:
  - MongoDB Atlas account (cloud-hosted, no local install needed), OR
  - Docker Desktop 4.0+ (for local MongoDB container), OR
  - MongoDB Community Edition 5.0+ (for local installation)
- **Git:** For cloning the repository (optional, can download as ZIP)

### Recommended Hardware
- **RAM:** 4 GB minimum (8 GB recommended)
- **Disk Space:** 2 GB free space
- **Processor:** Dual-core processor minimum

### Network Requirements
- Stable internet connection for Slack API communication
- Ability to reach `slack.com` and `api.slack.com`
- If using MongoDB Atlas: ability to reach Atlas cluster endpoint (firewall/proxy compatible)
- Ports available: 3000 (Slack bot), 5000 (MongoDB API) must not be in use

### Slack App Requirements
- Slack workspace where you have app installation permissions
- Ability to create/configure Slack apps (Admin access recommended)

#### Quick Configuration Checklist
- [ ] Node.js 18+ installed
- [ ] MongoDB credentials ready (Atlas or Docker)
- [ ] Slack App tokens created (Bot Token, App Token, Signing Secret)
- [ ] `.env` file populated with credentials
- [ ] Dependencies installed
- [ ] Both services running on ports 3000 & 5000
- [ ] Bot invited to at least one Slack channel

## Manual Installation

### Network Considerations

Before installing, ensure your network configuration supports the application:

#### Local Network Setup
- **Port 3000:** Must be available for the Slack bot service (Node.js app)
- **Port 5000:** Must be available for the MongoDB API service (Node.js app)
- **Firewall:** Both ports must not be blocked by local firewall (Windows Defender, third-party firewalls)
- **Localhost:** Application assumes `localhost` (127.0.0.1) for local development

#### MongoDB Atlas Setup (If Using Cloud Database)
- **Network Access:** Your machine's public IP must be whitelisted in MongoDB Atlas
  - Go to: Cluster → Network Access → Add IP Address
  - Recommended: Add your IP or "Allow access from anywhere" (0.0.0.0/0) for development
- **Connection String:** Atlas provides a connection string; store securely in `.env`
- **Username/Password:** Create MongoDB database user in Atlas (not your account password)

#### Slack API Network Requirements
- **Outbound HTTPS (443):** Required for Slack API calls
- **WebSocket (Port 443):** Required for Socket Mode (bot event streaming)
- **DNS Resolution:** Must be able to reach `slack.com`, `api.slack.com`, `hooks.slack.com`

### Detailed Manual Setup

Follow these steps to install dependencies, configure environment variables, and run both services locally. Commands are PowerShell-friendly for Windows.

### 1) Prerequisites

- Node.js 18+ installed
- MongoDB Atlas credentials (user/password) with your IP whitelisted
- A Slack App with the **Socket Mode** and **Bots** features enabled, and the following tokens/secrets:
	- Bot Token (xoxb-*)
	- Signing Secret
	- App Token (xapp-*, required for Socket Mode)

### 2) Environment variables

Create a `.env` file in the repo root (same level as `bolt_slack/` and `mongo_storage/`).

```
# Slack Bot
SLACK_BOT_TOKEN=your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=your-app-level-token
SLACK_BOT_USER_ID=your-bot-user-id
SLACK_SOCKET_MODE=true
SLACK_BOT_PORT=3000

# Mongo Storage API
API_URL=http://localhost:5000
DB_PORT=5000
MONGODB_USER=sudbud_test_user
MONGODB_PASSWORD=8zAk8e6DRunJk9kF
```

> Keep secrets out of version control. The services now read from this shared root `.env`.

### 3) Install dependencies

```powershell
cd c:\project-structuring-unstructured-data\bolt_slack
npm install

cd ..\mongo_storage
npm install
```

### 4) Run the services (two terminals)

**Terminal A – Mongo storage API**

```powershell
cd c:\project-structuring-unstructured-data\mongo_storage
node server.js
```

Expected log: `App is listening on port 5000`

Health check: http://localhost:5000/health

**Terminal B – Slack bot (Socket Mode)**

```powershell
cd c:\project-structuring-unstructured-data\bolt_slack
npm start
```

Expected log: `⚡️ Slack Bot is running!` and DB API URL printed.

### 5) Set up the Slack Bot

There are two ways to configure your Slack bot: using a manifest file (recommended) or manual setup.

#### Option A: Quick Setup Using Manifest File (Recommended) ⭐

The manifest file (`bolt_slack/slack-app-manifest.json`) automatically configures all permissions, scopes, and event subscriptions.

**Steps:**

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From an app manifest"
3. Choose your workspace
4. Copy the contents of `bolt_slack/slack-app-manifest.json` from this repository
5. Paste it into the manifest editor
6. Click "Create" → "Install to Workspace"
7. Review permissions and click "Allow"
8. Copy your **Bot User OAuth Token** (starts with `xoxb-` found in the "OAuth & Permissions" tab) and **Signing Secret** (found in the "Basic Information" tab)
9. Add these to your `.env` file under `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` respectively (should already be there from step 2)
10. If necessary, create an app-level token for your bot under the general app credentials section. Name the token however you choose and select the `connections:write` scope
11. Copy the app-level token to your `.env` file under `SLACK_APP_TOKEN`
12. Find your bot's member ID directly in your Slack workspace by right-clicking the app from the "Apps" tab and selecting "view app details". Copy the value named "Member ID" into `SLACK_BOT_USER_ID`
13. Invite the bot to channels: in Slack, run `/invite @YourBotName` in each channel

#### Option B: Manual Setup

If you prefer to manually configure the bot:

1. In Slack API settings for your app, enable **Socket Mode** and copy the App Token (xapp-*).
2. Add required OAuth scopes for the bot:
   - `app_mentions:read`, `chat:write`, `commands`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - Plus for interactive features: `reactions:read`, `reactions:write`, `users:read`
3. Install the app to your workspace to generate the **Bot Token (xoxb-*)**
4. Configure event subscriptions:
   - `app_mention`, `member_joined_channel`, `message.channels`, `message.im`, `reaction_added`
5. Create slash commands in Slack:
   - `/messages` - Retrieve recent messages from this channel
   - `/store-messages` - Store channel messages to database
   - `/channel-info` - Get channel information
6. Invite the bot to channels: in Slack, run `/invite @YourBotName` in each channel

### 6) Usage checklist

- Bot replies to channel messages with ephemeral “Save to DB?” buttons (Socket Mode events).
- `/store-messages` bulk-saves the channel to Mongo via API.
- `/messages` reads back the most recent saved messages.
- `/channel-info` returns channel metadata.

### 7) Local MongoDB Setup for Testing

Testers can easily set up a local MongoDB database for development and testing without needing MongoDB Atlas. Two methods are supported: **Docker** (recommended) or **local MongoDB installation**.

#### Quick Start

```powershell
cd c:\project-structuring-unstructured-data\mongo_storage
npm run db:setup
```

This interactive script will:
1. Ask you to choose between Docker (recommended) or Local MongoDB
2. Validate prerequisites
3. Automatically configure `.env` with connection details
4. Start MongoDB and prepare it for testing

#### Setup Methods

**Option A: Docker (Recommended) ⭐**

Prerequisites: Docker Desktop installed and running

```powershell
npm run db:setup:docker
```

What it does:
- Creates a MongoDB 7.0 container named `suds-local-mongodb`
- Automatically sets up credentials (testuser/testpass)
- Configures `.env` with local connection details
- Container persists data in a Docker volume

**Option B: Local MongoDB Installation**

Prerequisites: MongoDB Community Edition installed and in PATH

```powershell
npm run db:setup:local
```

You'll be prompted to enter:
- MongoDB host (default: `localhost`)
- MongoDB port (default: `27017`)
- Username (default: `testuser`)
- Password (default: `testpass`)

Then ensure MongoDB is running:
- **Windows:** Run `mongod` in a separate terminal
- **macOS:** `brew services start mongodb-community`
- **Linux:** `sudo systemctl start mongod`

#### Database Management Commands

```powershell
# Start MongoDB container (Docker only)
npm run db:start

# Stop MongoDB container (Docker only)
npm run db:stop

# View MongoDB logs
npm run db:logs
```

#### Default Connection Details

After setup, MongoDB is accessible at:
- **Host:** localhost
- **Port:** 27017
- **Username:** testuser
- **Password:** testpass

These are automatically added to your `.env` file as:
```
MONGODB_USER=testuser
MONGODB_PASSWORD=testpass
MONGODB_LOCAL=true
MONGODB_HOST=localhost
MONGODB_PORT=27017
```

### 8) Tests

**Run all tests (root, both projects):**

```powershell
cd c:\project-structuring-unstructured-data
npm test
```

What it does:
- Runs `bolt_slack` tests with `--passWithNoTests` (ok if none present).
- Runs `mongo_storage` tests with `--passWithNoTests` (unit tests pass without MongoDB).

**Mongo API unit tests only (no DB required):**

```powershell
cd c:\project-structuring-unstructured-data
npm test -- --testPathPatterns=mongo_storage/routes/__tests__/messages.route.test.js --runInBand
```

**Mongo API integration tests** (requires Atlas creds + IP whitelist):

```powershell
cd c:\project-structuring-unstructured-data
npm test -- --testPathPatterns=mongo_storage/routes/__tests__/messages.integration.test.js --runInBand
```

Notes:
- Integration tests auto-skip with a warning if MongoDB is unreachable (e.g., IP not whitelisted).
- Ensure `.env` contains `MONGODB_USER` and `MONGODB_PASSWORD` before running integration tests.

#### Running Tests with Local MongoDB

After setup, run tests from the `mongo_storage` directory:

```powershell
# All tests
npm test

# Unit tests only (no database required)
npm run test:unit

# Integration tests (requires MongoDB running)
npm run test:integration

# Watch mode (re-run on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### 9) Troubleshooting

- **Cannot find module / missing deps:** Run `npm install` in both `bolt_slack` and `mongo_storage`.
- **MongoDB auth/connection errors:** Verify `MONGODB_USER/PASSWORD`, IP whitelist, and `DB_PORT` in `.env`.
- **Bot not responding:** Confirm the bot is invited to the channel and Socket Mode tokens are correct; restart `npm start`.
- **API health:** Check http://localhost:5000/health.

## Uninstall & Cleanup

If you need to remove the application or reset your installation, follow these steps:

### Remove Services & Data

```powershell
# Stop running services (close Terminal windows or press Ctrl+C)

# Option A: Keep the code, remove only node_modules
cd c:\project-structuring-unstructured-data\bolt_slack
rm -Recurse node_modules
cd ..\mongo_storage
rm -Recurse node_modules

# Option B: Complete uninstall (remove everything except .env and docs)
cd c:\project-structuring-unstructured-data
rm -Recurse bolt_slack/node_modules
rm -Recurse mongo_storage/node_modules
```

### Remove MongoDB (Local Setup Only)

**If using Docker:**
```powershell
cd c:\project-structuring-unstructured-data\mongo_storage

# Stop MongoDB container
npm run db:stop

# Remove container and data volume
docker rm suds-local-mongodb
docker volume rm suds-mongodb-volume
```

**If using local MongoDB installation:**
```powershell
# Stop MongoDB
# Windows: Close the mongod terminal window, or:
taskkill /IM mongod.exe /F

# Uninstall MongoDB (Windows Add/Remove Programs or):
# - Download MongoDB uninstaller
# - Delete default data directory: C:\Program Files\MongoDB\Server\[version]\data
```

### Remove Slack App (Optional)

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your app
3. Click "Settings" → scroll to bottom
4. Click "Delete this app"
5. Confirm deletion

### Clean Environment Variables

Delete or clear the `.env` file in the repository root if you don't plan to reinstall:

```powershell
rm .env
```

**⚠️ Warning:** Only delete `.env` after stopping all services. It contains tokens and credentials.

### Full Repository Reset

To start completely fresh:

```powershell
# Delete everything except .git (if version controlled)
cd c:\project-structuring-unstructured-data
rm -Recurse -Force bolt_slack/node_modules, mongo_storage/node_modules
rm .env
rm .env.local

# Re-run installation from "Manual Setup" section above
```

---

# For the Maintainer

(This section is reserved for development, contribution, and maintenance guidelines. Please download [maintainer documentation](https://github.com/user-attachments/files/27175924/MAINTAINER.md) or view `MAINTAINER.md` in the repository files for detailed contributor instructions.)
