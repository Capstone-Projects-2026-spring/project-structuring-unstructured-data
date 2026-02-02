---
sidebar_position: 5
---
# Use-case descriptions

## Grant Context Collection Permissions
#### A new user grants the application to collect and store data from a DM or channel
**Precondition:** Slack bot is active in the workspace
1. The bot detects a new user has joined a DM or channel
2. The bot prompts the user to opt in to message collection
3. The user accepts the permission request
4. Message collection begins/resumes for that DM or channel

**Postcondition:** The user's messages are eligible for collection

## Collect and Store Message Data
#### The system automatically collects messages from authorized DMs and channels
**Precondition:** Slack bot is active in the workspace and has been authorized to collect data
1. A user sends a message
2. The Slack API sends and event to the application
3. The system stores the raw message data (text, sender, time, channel)
4. The system marks the message as unprocessed for contextualization

**Postcondition:** Message data is stored in persistent storage

## Structure Conversation Context
#### The system processes stored messages and organizes them into a structured data model
**Precondition:** Unprocessed messages exist
1. The system detects unprocessed messages
2. Messages are grouped by conversation context
3. The NLP model extracts topics, references, and tasks
4. Structured representations are saved in the database

**Postcondition:** Messages are linked in a coherent data model

## Indicate Message Capture Status
#### The user is informed when a message has been successfully captured
**Precondition:** A message is sent in the DM
1. A message is stored successfully
2. The bot reacts to the message

**Postcondition:** User knows which messages are being captured

## Generate Conversation Summary
#### The user requests a summary of a DM or channel's discussion
1. The user issues a command requesting a summary
2. The system retrieves structured message data
3. The NLP model generates a summary
4. The summary is displayed in chat

**Postcondition:** User gains quick context



