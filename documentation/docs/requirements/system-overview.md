---
sidebar_position: 1
---

# System Overview

## Project Abstract
Project Structuring Unstructured Data is an application that collects and organizes message data from Slack, a widely used workplace communication platform. Built as a Slack bot named SUD Bud, the application automatically saves messages from channels and direct messages to a structured database, then uses a natural language processing model to generate concise summaries of that data organized by day and by user. The resulting structured data helps team members quickly get up to speed on past conversations, automate context-aware actions, and maintain an organized record of workplace discussions without any manual effort.

## High Level Requirements
SUD Bud operates directly within Slack's interface and automatically collects message data from channels it has been invited to. Users can control whether their messages are saved through slash commands, and can review and remove their saved messages at any time through a private weekly digest. Workspace administrators have additional controls for managing message storage across all channels. When a user wants to retrieve structured information about past conversations, they can access the SUD Bud Home dashboard within Slack, which displays day-by-day and user-by-user summaries of channel activity. The system also supports multiple Slack workspaces, allowing organizations beyond the development team to install and use the bot.

## Conceptual Design
SUD Bud is built on a Node.js backend using the Slack Bolt framework, which handles all communication with the Slack API including message events, slash commands, and interactive UI components. Messages are stored in a MongoDB Atlas database through a REST API built with Express.js. A Python-based NLP model powered by the Gemini API processes stored messages and generates structured summaries, which are surfaced to users through an interactive Slack Home tab dashboard. The application is deployed on Render and supports both Socket Mode and HTTP Mode for receiving Slack events.

## Background
Workplace communication platforms like Slack have become the primary medium for team collaboration, but the volume of messages exchanged daily makes it difficult to retrieve meaningful information after the fact. When a team member misses a week of activity, they are often left scrolling through hundreds of messages with no efficient way to get caught up. Existing Slack tools can summarize individual messages or trigger actions based on specific keywords, but none provide a comprehensive structured data model that captures the full context of ongoing team discussions over time. SUD Bud addresses this gap by continuously collecting and structuring message data in the background, making it instantly accessible and digestible through AI-generated summaries whenever a user needs it.
