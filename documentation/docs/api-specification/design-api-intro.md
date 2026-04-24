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
  - Retrieves messages from the MongoDB collection identified by `channelName` and returns them as an array. This endpoint is used to fetch a conversation history that has already been stored.
  - **Path Parameters:** 
      - `channelName` (`string`, required): Name of the MongoDB collection to query.
  - **Query Parameters:**
      - `limit` (`integer`, optional): Maximum number of messages to return. When provided, returns newest messages first (sorted by timestamp descending). If not provided, returns all messages in insertion order.
  - **Success response:**
    - Status: `200 OK`
    - Body: `Array<object>` containing message documents from the target collection.
    - Response headers include `X-Total-Count` (when limit is specified) showing the total number of documents in the collection.
    - Typical document fields include:
        - `_id` (`string`): MongoDB document ID
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
  - Inserts messages into the MongoDB collection for the specified `channelName`. Supports both single message objects and arrays of messages, with comprehensive batch processing and validation.
  - **Path Parameters:** 
      - `channelName` (`string`, required): Slack channel name used to select the MongoDB collection.
  - **Request Body:**
    - Can be either a single message object or an array of message objects.
    - Each message should contain:
        - `user` (`string`): User ID
        - `ts` (`string`): Timestamp
        - `type` (`string`, optional): Message type (defaults to "message")
        - `text` (`string`): Message content
    - Array payloads are processed in batches to handle large volumes (configurable limits via `MONGO_INSERT_BATCH_BYTES` and `MONGO_INSERT_BATCH_COUNT` environment variables).
  - **Success response:**
    - Status: `200 OK`
    - Body for array payload:
    ```json
    {
        "message": "Messages from channel <channelName> inserted into the database successfully.",
        "insertedCount": 150,
        "skippedCount": 2,
        "oversizedDocuments": [],
        "writeFailures": [],
        "maxBsonDocumentBytes": 16777216,
        "maxBatchBytes": 12582912,
        "maxBatchCount": 500
    }
    ```
    - Body for single message object:
    ```json
    {
        "message": "Message stored successfully",
        "duplicate": false
    }
    ```
    - Note: Single messages are checked for duplicates using `user` + `ts` combination.

- **Error responses:**
    - Status: `400 Bad Request`
    - Body:
    ```json
    {
        "error": "<error message>"
    }
    ```
    - Possible error cases: missing/blank `channelName`, invalid request body format.
    - Status: `413 Payload Too Large`
    - Body:
    ```json
    {
        "error": "No documents were inserted from array payload",
        "insertedCount": 0,
        "oversizedDocuments": [...],
        "writeFailures": [...],
        "maxBsonDocumentBytes": 16777216,
        "maxBatchBytes": 12582912,
        "maxBatchCount": 500
    }
    ```
</details>

---

## `DELETE /api/messages/:channelName/:ts`

<details>
  <summary>Details</summary>
  - Removes a single message from the collection by its timestamp.
  - **Path Parameters:** 
      - `channelName` (`string`, required): Name of the MongoDB collection.
      - `ts` (`string`, required): Timestamp of the message to delete.
  - **Success response:**
    - Status: `200 OK`
    - Body:
    ```json
    {
        "message": "Message deleted successfully"
    }
    ```

- **Error responses:**
    - Status: `404 Not Found`
    - Body:
    ```json
    {
        "error": "Message not found"
    }
    ```
    - Status: `500 Internal Server Error`
    - Body:
    ```json
    {
        "error": "<error message>"
    }
    ```
</details>

---

## Summary Endpoints

Base route prefix: `/api/summaries`

---

## `GET /api/summaries/all`

<details>
  <summary>Details</summary>
  - Retrieves all summary documents across all summary databases in the system.
  - **Query Parameters:** None
  - **Success response:**
    - Status: `200 OK`
    - Body: Object mapping database names to collections, which map to arrays of summary documents.
    ```json
    {
        "channelA_cw": {
            "summaries": [
                {
                    "_id": "67d6f4e6f12a9a71a51d0001",
                    "channel": "channelA",
                    "summary_day_utc": "2026-04-05T00:00:00Z",
                    "summary": "Summary content here"
                }
            ]
        },
        "channelB_pw": {
            "summaries": [...]
        }
    }
    ```
    - Note: Database names ending in `_cw` are weekly summaries; `_pw` are periodic/custom summaries.

- **Error response:**
    - Status: `500 Internal Server Error`
    - Body:
    ```json
    {
        "error": "<error message>"
    }
    ```
</details>

---

## `GET /api/summaries/:databaseKey`

<details>
  <summary>Details</summary>
  - Retrieves summary documents from a specific channel database. Supports filtering by week.
  - **Path Parameters:**
      - `databaseKey` (`string`, required): Channel database key in format `<channelName>_<channelId>` (e.g., `myChannel_C123`).
  - **Query Parameters:**
      - `weekStart` (`string`, optional): ISO date or timestamp to retrieve summaries for a specific week. The value is normalized to UTC Sunday 00:00:00Z and used as a 7-day range query on `summary_day_utc`. Examples: `2026-04-05` or `2026-04-05T00:00:00Z`.
  - **Success response:**
    - Status: `200 OK`
    - Body:
    ```json
    {
        "dbName": "myChannel_C123",
        "weekStart": "2026-04-05T00:00:00Z",
        "summaries": [
            {
                "_id": "67d6f4e6f12a9a71a51d0001",
                "channel": "myChannel",
                "summary_day_utc": "2026-04-05T00:00:00Z",
                "summary": "Week of April 5th summary..."
            }
        ]
    }
    ```

- **Error responses:**
    - Status: `404 Not Found`
    - Body:
    ```json
    {
        "error": "No database found for channelKey: <databaseKey>"
    }
    ```
    - Status: `400 Bad Request`
    - Body:
    ```json
    {
        "error": "weekStart must be a valid date or ISO timestamp."
    }
    ```
    - Status: `500 Internal Server Error`
    - Body:
    ```json
    {
        "error": "<error message>"
    }
    ```
</details>

---

## `POST /api/summaries/:databaseKey`

<details>
  <summary>Details</summary>
  - Generates and inserts summary documents for a channel using the Gemini AI model. Can target a specific week or let the system infer the latest available week.
  - **Path Parameters:**
      - `databaseKey` (`string`, required): Channel database key in format `<channelName>_<channelId>`.
  - **Query Parameters:**
      - `week` (`integer`, optional): Week number (0-53) to generate summaries for. If provided, summaries are generated from messages matching this week.
      - `weekStart` (`string`, optional): ISO date or timestamp. Converted to its UTC Sunday week start to target the week containing that date.
      - **Rules:** If neither `week` nor `weekStart` is provided, the model infers and processes the latest available week. Providing both parameters returns a `400` error.
  - **Success response:**
    - Status: `200 OK`
    - Body:
    ```json
    {
        "message": "Summary processing completed successfully",
        "requestedWeek": 14,
        "requestedWeekStart": "2026-04-05T00:00:00Z",
        "savedCount": 1,
        "modelMetadata": {
            "model": "gemini-2.0-flash",
            "timestamp": "2026-04-24T12:34:56Z"
        },
        "modelResults": [
            {
                "summary_day_utc": "2026-04-05T00:00:00Z",
                "summary": "Generated summary content from AI model..."
            }
        ]
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
    - Possible error cases: invalid `week` value, invalid `weekStart` format, both `week` and `weekStart` provided.
    - Status: `500 Internal Server Error`
    - Body:
    ```json
    {
        "error": "<error message>",
        "details": "<detailed error information>"
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

