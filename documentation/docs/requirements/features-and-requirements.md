---
sidebar_position: 4
---

# Features and Requirements

## Functional Requirements
1. The system must support extracting all data from the target communication platform's messages and user information.
2. The system must dynamically derive context about discussion topics, key terminology, and roles of participating users from given chat data in channels/conversations and direct messages.
3. The system must compose a consistent data model for collections of message data based of the unique context, containing attributes such as topics, key words, and user descriptions that are relevant across all work conversations regardless of specific subjects.
4. The system must store both raw data and structured data with context in a persistent storage that can be only managed by select users with admin priviledges.
5. The system must ensure that consent (through custom privacy configurations settings in the system) are made by all users before performing data collection.
6. The system must detect when messages have edited, deleted, or were manually deselected by the user to be included in a conversation summary to provide accurate data about a collection of messages.
7. The system must construct a structured summary / visualizer (such as a dashboard or statisitc tracker) of a conversation based on its contextualized message data when prompted by the user.
8. The system's features of marking messages being used for context and outputting contextualized data must be accessible directly within the target communication platform (chatbot interface, dashboard, or both).

## Nonfunctional Requirements
1. The system shall securely store, access, and distribute all user and message data retrieved from the communication platform.
2. The system shall include multiple points for privacy enforcement, allowing message data to be omitted or anonymized if a user(s) opt out of data collection or declare certain messages as private.
3. The system shall design data retrival and structuring functions modular enough to allow seamless implementation into other platforms' APIs such as Discord.
4. The system shall implement API endpoint design best practices to ensure data transfer between the target communication platform, the knowledge storage containers, and the custom built contextualization model can be performed in reasonable time constraints.
5. The system shall be built to reliably perform collection and processing of all historical data from multiple conversations/DMs as necessary within a single organization of users.