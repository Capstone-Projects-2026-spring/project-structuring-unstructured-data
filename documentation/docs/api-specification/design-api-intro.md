---
sidebar_position: 1
description: API reference for implemented message routes.
---

# Backend API


## Message Endpoints

Base route prefix: `/api/messages`

---

## `GET /api/messages/:channelName`

<details>
  <summary>Details</summary>
  - Retrieves all documents from the MongoDB collection identified by `channelName` and returns them as an array. This endpoint is used to fetch a full conversation history that has already been stored.
  - **Path Parameters:** 
      - `channelName` (`string`, required): Name of the MongoDB collection to query.
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

---

## User Endpoints

Base route prefix: `/api/users`

---

## `GET /api/users/:collectionName`

<details>
    <summary>Details</summary>
    - Retrieves all user/member documents from the MongoDB collection identified by `channelName` and returns them as an array.
    - **Path Parameters:**
            - `channelName` (`string`, required): Name/key used to resolve the target user collection.
    - **Success response:**
        - Status: `200 OK`
        - Body: `Array<object>` containing all user documents from the target collection.
        - Typical document fields include:
                - `team_id` (`string`)
                - `name` (`string`)
                - `real_name` (`string`)
                - `is_admin` (`boolean`)
                - `is_owner` (`boolean`)
                - `is_bot` (`boolean`)
                - Additional fields may appear because the user schema is non-strict.
- **Error response:**
        - Status: `500 Internal Server Error`
        - Body: plain text string: `"Server Error"`

Example `200` response:

```json
[
    {
        "_id": "67d6f4e6f12a9a71a51d0010",
        "team_id": "T12345",
        "name": "jane.doe",
        "real_name": "Jane Doe",
        "is_admin": true,
        "is_owner": false,
        "is_bot": false
    }
]
```
</details>

---

## `POST /api/users/:channelName`

<details>
    <summary>Details</summary>
    - Inserts all channel members from the request body into MongoDB for the channel identified by `channelName`.
    - **Path Parameters:**
            - `channelName` (`string`, required): Channel name/key used to resolve where members are stored.
    - **Request Body:**
        - `Array<object>` of member records.
    - **Success response:**
        - Status: `200 OK`
        - Body:
        ```json
        {
                "message": "Members from channel <channelName> inserted into the database successfully."
        }
        ```

- **Error responses:**
        - Status: `400 Bad Request`
        - Body:
        ```json
        {
                "error": "<error message>"
        }
        ```
        - Possible error case: missing/blank `channelName` path parameter.
</details>

