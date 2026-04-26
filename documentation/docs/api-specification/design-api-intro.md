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

## `DELETE /api/messages/:channelName/:ts`

<details>
  <summary>Details</summary>
  - Removes a single message document from the MongoDB collection identified by `channelName` using its timestamp.
  - **Path Parameters:**
      - `channelName` (`string`, required): Slack channel name used to resolve the target MongoDB collection.
      - `ts` (`string`, required): Timestamp of the message to delete.
  - **Request Body:**
      - None.
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

---

## Summary Endpoints

Base route prefix: `/api/summaries`

---

## `GET /api/summaries/all`

<details>
    <summary>Details</summary>
    - Retrieves summary documents from all databases whose names end with `_cw` or `_pw`.
    - **Path Parameters:**
            - None.
    - **Success response:**
        - Status: `200 OK`
        - Body: `object` keyed by database name, then collection name, containing arrays of summary documents.

Example `200` response:

```json
{
    "engineering_cw": {
        "summaries": [
            {
                "summary_day_utc": "2026-04-19T00:00:00Z",
                "generated_at_utc": "2026-04-25T13:22:11.104Z",
                "message_count": 57,
                "summary_text": "Weekly summary text..."
            }
        ]
    },
    "engineering_pw": {
        "summaries": []
    }
}
```

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
    - Retrieves all summary documents from a specific channel summary database.
    - Supports optional filtering by week start via query parameter.
    - **Path Parameters:**
            - `databaseKey` (`string`, required): Exact database name to query (for example, `myChannel_C123`).
    - **Query Parameters:**
            - `weekStart` (`string`, optional): Date/ISO timestamp normalized to UTC Sunday start and used as a 7-day filter.
    - **Request Body:**
            - None.
    - **Success response:**
        - Status: `200 OK`
        - Body:
        ```json
        {
            "dbName": "<databaseKey>",
            "weekStart": "<resolved week start or null>",
            "summaries": [
                {
                    "summary_day_utc": "2026-04-19T00:00:00Z",
                    "generated_at_utc": "2026-04-25T13:22:11.104Z",
                    "message_count": 57,
                    "summary_text": "Weekly summary text..."
                }
            ]
        }
        ```

- **Error responses:**
        - Status: `400 Bad Request`
        - Body:
        ```json
        {
            "error": "weekStart must be a valid date or ISO timestamp."
        }
        ```
        - Status: `404 Not Found`
        - Body:
        ```json
        {
            "error": "No database found for channelKey: <databaseKey>"
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
    - Runs the weekly summary model for the specified channel database.
    - Optionally targets a specific week using either `week` or `weekStart`.
    - **Path Parameters:**
            - `databaseKey` (`string`, required): Exact database name to process.
    - **Query Parameters:**
            - `week` (`integer`, optional): Week number in range `0..53`.
            - `weekStart` (`string`, optional): Date/ISO timestamp normalized to UTC Sunday start.
    - **Request Body:**
            - None.
    - **Success response:**
        - Status: `200 OK`
        - Body:
        ```json
        {
            "message": "Summary processing completed successfully",
            "requestedWeek": 14,
            "requestedWeekStart": null,
            "savedCount": 7,
            "modelMetadata": {
                "saved_count": 7
            },
            "modelResults": ["<model output lines>"]
        }
        ```

- **Error responses:**
        - Status: `400 Bad Request`
        - Body:
        ```json
        {
            "error": "Use either week or weekStart, not both."
        }
        ```
        - Status: `500 Internal Server Error`
        - Body:
        ```json
        {
            "error": "<error message>",
            "details": "<model error details if available>"
        }
        ```
</details>

---

## User Summary Endpoints

Base route prefix: `/api/user_summaries`

---

## `GET /api/user_summaries/:databaseKey/:userId?`

<details>
    <summary>Details</summary>
    - Retrieves user summary data from a specific channel database.
    - If `userId` is provided (route or query), returns one summary object or `null`.
    - If `userId` is not provided, returns all user summaries in that database.
    - **Path Parameters:**
            - `databaseKey` (`string`, required): Exact database name to query.
            - `userId` (`string`, optional): Slack user ID for single-summary lookup.
    - **Query Parameters:**
            - `userId` (`string`, optional): Alternative to route param for single-summary lookup.
    - **Request Body:**
            - None.
    - **Success responses:**
        - Status: `200 OK` (single user)
        - Body:
        ```json
        {
            "dbName": "<databaseKey>",
            "userSummary": {
                "user_id": "U12345678",
                "real_name": "Jane Doe",
                "generated_at_utc": "2026-04-25T13:41:22.221Z",
                "message_count": 32,
                "summary_text": "User summary text...",
                "status": "ok"
            }
        }
        ```
        - Status: `200 OK` (all users)
        - Body:
        ```json
        {
            "dbName": "<databaseKey>",
            "userSummaries": [
                {
                    "user_id": "U12345678",
                    "real_name": "Jane Doe",
                    "generated_at_utc": "2026-04-25T13:41:22.221Z",
                    "message_count": 32,
                    "summary_text": "User summary text...",
                    "status": "ok"
                }
            ]
        }
        ```

Example `200` response when the user has no summary yet:

```json
{
    "dbName": "<databaseKey>",
    "userSummary": null
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
        - Status: `500 Internal Server Error`
        - Body:
        ```json
        {
            "error": "<error message>"
        }
        ```
</details>

---

## `POST /api/user_summaries/:databaseKey`

<details>
    <summary>Details</summary>
    - Runs user summary generation for a channel database.
    - If `userId` is provided, generates a summary for that user only.
    - If `userId` is omitted, generates summaries for all users.
    - **Path Parameters:**
            - `databaseKey` (`string`, required): Exact database name to process.
    - **Query Parameters:**
            - `userId` (`string`, optional): Slack user ID to generate one user summary.
    - **Request Body:**
            - Optional object. `userId` may also be provided in body:
            ```json
            {
                "userId": "U12345678"
            }
            ```
    - **Success response:**
        - Status: `200 OK`
        - Body:
        ```json
        {
            "message": "User summary processed successfully for userId U12345678",
            "databaseKey": "<databaseKey>",
            "userId": "U12345678",
            "modelMetadata": {
                "saved_count": 1
            },
            "modelResults": ["<model output lines>"]
        }
        ```

Example `200` response when generating all users:

```json
{
    "message": "User summaries processed successfully",
    "databaseKey": "<databaseKey>",
    "userId": null,
    "modelMetadata": {
        "saved_count": 12
    },
    "modelResults": ["<model output lines>"]
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
        - Status: `500 Internal Server Error`
        - Body:
        ```json
        {
            "error": "<error message>",
            "details": "<model error details if available>"
        }
        ```
</details>

