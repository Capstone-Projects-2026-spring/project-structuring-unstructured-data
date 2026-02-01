---
sidebar_position: 1
---

# System Overview

## Project Abstract
This project aims to develop a novel application capable of collecting and organizing message data contained in company communication platforms such as Slack. The application will be able to structure any message data across different channels and users into a consistent data model once it is granted proper permissions to access a channel or user direct messaging. The resulting organized data can then be used in multiple workplace tasks such as automating regularly performed actions or summarizing projects for newly onboarded team members.

## High Level Requirements
The application will primarily function as a tool compatible with Slack that can extract context from direct messages (DMs) between users and channels/conversations between multiple users. The tool operates within Slack's interface through a bot or similar automation, meaning that users will adjust the application's settings or control whether they consent to their messages being collected through the application directly. When a user begins a DM or enters a conversation where the bot is configured, the user is prompted to give permission for all message data to be collected (either via an opt-in or hybrid approval). If active, the tool marks whenever a new message within the DM or conversation has been stored in memory for contextualization. When the user wishes to retrieve their structured message data, they can prompt the tool within Slack, which will result in the application displaying a basic data model of all included messages in a digestable format, which can be directly downloaded or accessed for the use of context-based automation at a larger scale, such as for summarizing entire channel's worth of information.

## Conceptual Design
Describe the initial design concept: Hardware/software architecture, programming language, operating system, etc.

## Background
Communication platforms like Slack are being increasingly normalized in various workplace environments to discuss projects, schedule meetings, and many other interactions relevant to the specific work the business does. Often, this increased use in messaging applications results in signficant information being buried deep in Slack channel discussions or previous direct messages; the further back a conversation may be, the more context may be necessary for a user to get a proper understanding of the subjects being discussed, making it difficult to fully process information being covered in a conversation's history. Several custom bots and pre-built automation features exist for Slack that can summarize individual messages or perform actions within Slack when an expected message type is sent, but few technologies currently exist that can organize a collection of message data from a conversation into a standardized data model that fully addresses the possible context that can exist and change every time a user sends a new message. By developing a Slack bot with these features in mind, the use cases for structured message data are greatly expanded.
