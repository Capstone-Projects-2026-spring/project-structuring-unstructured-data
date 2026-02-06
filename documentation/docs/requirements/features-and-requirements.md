---
sidebar_position: 4
---

# Features and Requirements

## Functional Requirements
1. The system must support extracting all data from Slack messages and user information.
2. The system must analyze whether messages have been added, edited, removed, or were manually selected/de-selected by the user for structuring context.
3. The system must dynamically derive context from relevant chat data in channels/conversations and direct messages.
4. The system must compose a consistent data model for collections of message data based of the unique context.
5. The system must store both raw data and structured data with context in a persistent knowledge storage.
6. The system's features must be interacted with via a user-facing design (chatbot interface, dashboard, or both) that integrates directly into Slack conversations.

## Nonfunctional Requirements
1. The system shall ensure that consent / proper privacy configurations are made by all users before performing data collection.
2. The system shall securely store, access, and distribute all user and message data retrieved from the communication platform.
3. The system shall be modular enough to allow future support for other platforms like Discord.
