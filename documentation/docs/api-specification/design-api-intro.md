---
sidebar_position: 1
description: API reference for implemented message routes.
---

# Backend API


## Message Endpoints

Base route prefix: `/api/messages`

---

## `GET /api/messages/:collectionName`

<details>
  <summary>Details</summary>
  - Retrieves all documents from the MongoDB collection identified by `collectionName` and returns them as an array. This endpoint is used to fetch a full conversation history that has already been stored.
  - **Path Parameters:** 
      - `collectionName` (`string`, required): Name of the MongoDB collection to query.
  - **Success response:**
    - Status: `200 OK`
    - Body: `Array<object>` containing all documents from the target collection.
    - Typical document fields include:
        - `user` (`string`)
        - `type` (`string`)
        - `text` (`string`)
        - `ts` (`string`)
        - Additional fields may appear because the message schema is non-strict.
- **Error response:**
    - Status: `500 Internal Server Error`
    - Body: plain text string: `"Server Error"`

Example `200` response:

```json
[
	{
		"_id": "67d6f4e6f12a9a71a51d0001",
		"user": "U12345678",
		"type": "message",
		"text": "Hello from Slack",
		"ts": "1712312345.678900"
	}
]
```
</details>

---

## `POST /api/messages/:channelName`

<details>
  <summary>Details</summary>
  - Pulls messages from the Slack channel identified by `channelName` and inserts them into MongoDB under a collection with the same name.
  - **Path Parameters:** 
      - `channelName` (`string`, required): Slack channel name used both for Slack retrieval and for selecting the MongoDB collection name.
  - **Success response:**
    - Status: `200 OK`
    - Body:
    ```json
    {
        "message": "Messages from channel <channelName> inserted into the database successfully."
    }
    ```

- **Error response:**
    - Status: `400 Bad Request`
    - Body:
    ```json
    {
        "error": "<error message>"
    }
    ```
</details>

