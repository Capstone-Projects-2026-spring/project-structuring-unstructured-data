---
sidebar_position: 2
---

# System Block Diagram
```mermaid
graph LR
  U[User] --> UI[User Interface]
  ADM[Admin] --> UI

  SLACK[Slack Workspace - public channels only] --> ING[Message Ingestion]
  UI --> ING

  ING --> EX[Context Extraction - opt in]
  EX --> KB[(Organizational Memory Store)]

  KB --> UI

  UI --> ACL[Access Control]
  ACL --> KB
```

The SUD system reads messages from Slack public channels only. Direct messages and private channels are excluded by default. Users can request onboarding summaries or ask questions through a chatbot or web interface. Context is saved only through an opt-in action initiated by the user. Approved context is stored in an organizational memory store and can be retrieved later. Users may delete context they saved, while admins may delete saved context from other users
