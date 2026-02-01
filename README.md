<div align="center">

# Structuring Unstructured Data
[![Report Issue on Jira](https://img.shields.io/badge/Report%20Issues-Jira-0052CC?style=flat&logo=jira-software)](https://temple-cis-projects-in-cs.atlassian.net/jira/software/c/projects/DT/issues)
[![Deploy Docs](https://github.com/ApplebaumIan/tu-cis-4398-docs-template/actions/workflows/deploy.yml/badge.svg)](https://github.com/ApplebaumIan/tu-cis-4398-docs-template/actions/workflows/deploy.yml)
[![Documentation Website Link](https://img.shields.io/badge/-Documentation%20Website-brightgreen)](https://applebaumian.github.io/tu-cis-4398-docs-template/)


</div>

## Keywords

Section #, as well as any words that quickly give your peers insights into the application like programming language, development platform, type of application, etc.

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
