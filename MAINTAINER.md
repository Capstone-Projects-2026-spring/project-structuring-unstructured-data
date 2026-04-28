# For the Maintainer

This section contains operational guidelines for maintaining, configuring, and supporting the application in production environments.

## Configuration

### Single-User vs Multi-User Setup

#### Single-User Configuration
For development or single-team deployments:

```env
# Single workspace token (default behavior)
SLACK_BOT_TOKEN=xoxb-your-single-workspace-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_TEAM_ID=T0XXXXX  # Optional: specify your workspace ID

# MongoDB (single database for all users)
MONGODB_USER=local_user
MONGODB_PASSWORD=secure_password_here
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_LOCAL=false  # Set to false for Atlas
```

- **User Role:** All Slack users in the workspace have equal access to store and retrieve messages
- **Database:** Single MongoDB database shared across all workspace users
- **Scalability:** Suitable for teams up to 100 active users

#### Multi-User/Multi-Workspace Configuration
For multiple Slack workspaces (SaaS-style deployment):

```env
# Default workspace fallback
SLACK_BOT_TOKEN=xoxb-default-workspace-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Database (multi-tenant approach)
MONGODB_USER=sudbud_multi_user
MONGODB_PASSWORD=asX0X92RZJn8Bk09
MONGODB_HOST=atlas-cluster-url
MONGODB_PORT=27017
MONGODB_LOCAL=false  # Must use Atlas for multi-workspace

# Workspace token storage
WORKSPACE_TOKEN_TABLE=workspace_tokens  # Table name in DB for storing per-workspace tokens
```

- **Additional Workspaces:** Install the Slack app in each workspace
- **Token Storage:** Each workspace's Bot Token is stored in `workspace_tokens` collection in MongoDB
- **Database Isolation:** Optional database per workspace (requires separate MongoDB instances)
- **Scalability:** Supports unlimited workspaces, each with independent user bases

**To add a new workspace to multi-user setup:**
1. Create a new Slack app in the target workspace using manifest file
2. Use one-click OAuth link to authorize
3. Bot automatically stores workspace token in `workspace_tokens` MongoDB collection
4. Subsequent requests from that workspace use cached token

### Network Configuration

#### Port Configuration
```env
SLACK_BOT_PORT=3000          # Port for Slack bot (Express app)
DB_PORT=5000                 # Port for MongoDB API service
REQUEST_BODY_LIMIT=25mb      # Max request size for bulk message storage
MONGO_INSERT_BATCH_BYTES=12mb # Max bytes per batch insert to MongoDB
MONGO_INSERT_BATCH_COUNT=500  # Max documents per batch insert
```

#### Remote Deployment (e.g., Render, Heroku)
```env
API_URL=https://your-deployed-api.onrender.com  # Replace localhost with public URL
NODE_ENV=production
LOG_LEVEL=info  # Reduce verbose logging in production
```

### Resource Configuration

**Environment Variables for Resource Management:**
```env
NODE_OPTIONS=--max_old_space_size=2048  # Node.js memory limit (MB)
REQUEST_BODY_LIMIT=25mb                 # Adjust based on available memory
MONGO_INSERT_BATCH_BYTES=12mb           # Reduce if memory-constrained
MONGO_INSERT_BATCH_COUNT=500            # Reduce if experiencing timeouts
```

**Recommended Sizing:**

| Deployment | RAM | Storage | Users | Messages/Month |
|------------|-----|---------|-------|-----------------|
| Development (Local) | 4 GB | 10 GB | 1-5 | <100K |
| Small Team (Docker) | 8 GB | 50 GB | 5-50 | 100K-1M |
| Production (Atlas) | 16+ GB | 500+ GB | 50+ | 1M+ |

### Automation Setup

**Auto-save Configuration:**
The bot can be configured to automatically save messages without user prompts.

```javascript
// In bolt_slack/app.js - user preference storage
const userAutoSavePreference = new Map();  // Currently in-memory; persists to DB for production

// Enable auto-save for a user:
userAutoSavePreference.set(userId, { autoSave: true, batchInterval: 3600000 }); // Every hour
```

**Scheduling Message Saves (Cron Job Example):**
```bash
# Add to system crontab (Windows Task Scheduler or Linux cron)
0 2 * * * cd /path/to/app && npm run batch:save-messages  # Daily at 2 AM

# Or use node-cron package (add to app.js):
const cron = require('node-cron');
cron.schedule('0 2 * * *', async () => {
  await storeAllActiveChannelMessages();
});
```

---

## Security

### Password and Credential Management

#### Environment Variable Protection
```bash
# DO NOT commit .env to version control
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore

# Permissions: Only owner can read
chmod 600 .env  # Linux/macOS
# Windows: Right-click .env → Properties → Security → Edit → Remove "Users" group
```

#### Slack Token Security
- **Bot Token** (`SLACK_BOT_TOKEN`): Starts with `xoxb-`, grants bot permissions
- **Signing Secret** (`SLACK_SIGNING_SECRET`): Validates requests from Slack
- **App Token** (`SLACK_APP_TOKEN`): Starts with `xapp-`, required for Socket Mode
- **Rotation:** Regenerate tokens every 90 days
  1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Your App → Install App
  2. Click "Regenerate" next to Bot User OAuth Token
  3. Update `.env` with new token
  4. Restart bot service

#### MongoDB Credentials
```env
# Atlas-specific security
MONGODB_USER=sudbud_test_user    # NOT your Atlas account email
MONGODB_PASSWORD=clpuZVnfycvRk8v3  # Min 12 chars, include symbols
MONGODB_HOST=cluster0.xxxxx.mongodb.net
MONGODB_PORT=27017
MONGODB_SSL=true  # Always true for Atlas
MONGODB_AUTH_SOURCE=admin  # Atlas uses "admin" database

# Password requirements:
# - Minimum 12 characters
# - Must include uppercase, lowercase, numbers, symbols
# - Never share or log to console
# - Rotate quarterly in production
```

**MongoDB Atlas IP Whitelist:**
- Go to Cluster → Network Access
- Add only necessary IPs (never 0.0.0.0/0 in production)
- For Render deployments, whitelist Render IP ranges or use VPN

#### API Key Management (if external APIs used)
```env
# Google Gemini API Key (for NLP summarization)
GEMINI_API_KEY=your-key-here
GEMINI_API_TIMEOUT=30000  # 30 seconds

# Keep API keys separate from code
# Rotate if ever exposed
# Use API key restrictions (limit to your app/IP)
```

### Database Access Control

**MongoDB RBAC (Role-Based Access Control):**
```javascript
// For each database user, specify roles:
// readWrite - Full read/write to assigned database
// admin - Only for production admins (minimum)

// Create a service user (not admin):
// In Atlas → Database Access → Add Database User
// - Username: app_service_user
// - Password: (auto-generated, copy to .env)
// - Roles: readWrite on "slack_data" database
// - Assign IP whitelist
```

#### Logging and Monitoring Access
```env
# Enable detailed logging
LOG_LEVEL=debug  # For development only
# Production: LOG_LEVEL=warn

# Log file location
LOG_FILE=/var/log/slack-bot/app.log
LOG_RETENTION_DAYS=30  # Auto-delete logs older than 30 days
```

---

## Database Installation and Maintenance

### Installation Verification

```powershell
# Verify MongoDB connection
cd mongo_storage
node -e "require('./db-connection').connectToDatabase().then(() => console.log('✓ Connected')).catch(e => console.log('✗ Error:', e.message))"
```

### Database Schema / Collections

The application uses these MongoDB collections:

**1. messages**
- Stores Slack messages with metadata
- Fields: `_id`, `slack_id`, `channel`, `user`, `text`, `timestamp`, `reactions`, `thread_id`
- Index: `{ slack_id: 1, channel: 1 }` (unique composite index for deduplication)
- Size estimate: ~1-2 KB per message

**2. users**
- Stores Slack user profiles
- Fields: `_id`, `slack_user_id`, `name`, `email`, `is_bot`, `avatar_url`, `last_synced`
- Index: `{ slack_user_id: 1 }` (unique)
- Size estimate: ~2-5 KB per user

**3. channels**
- Stores Slack channel metadata
- Fields: `_id`, `slack_channel_id`, `name`, `description`, `created_at`, `is_private`
- Index: `{ slack_channel_id: 1 }` (unique)
- Size estimate: ~1-2 KB per channel

**4. workspace_tokens** (Multi-workspace only)
- Stores OAuth tokens for each workspace
- Fields: `_id`, `team_id`, `team_name`, `bot_token`, `signing_secret`, `installed_at`, `expires_at`
- Index: `{ team_id: 1 }` (unique)
- TTL Index: Automatically delete expired tokens after 90 days

### Regular Maintenance Tasks

**Daily Maintenance:**
```powershell
# Check MongoDB health
curl http://localhost:5000/health
# Expected response: { "status": "ok", "timestamp": "..." }

# Monitor disk usage
df -h  # Linux/macOS
Get-Volume  # PowerShell Windows

# Monitor logs for errors
tail -f /var/log/slack-bot/app.log
```

**Weekly Maintenance:**
```powershell
# Create database backup
npm run db:backup  # Backs up to ./backups/ directory

# Verify backup integrity
mongorestore --uri "mongodb://user:pass@localhost:27017" --dryRun ./backups/slack_data

# Check for duplicate messages (deduplication)
npm run deduplicate:messages
```

**Monthly Maintenance:**
```powershell
# Remove old/expired data
npm run cleanup:old-messages --days=90  # Delete messages older than 90 days

# Database maintenance
npm run optimize:indexes  # Rebuild indexes for performance
npm run analyze:storage   # Analyze storage usage by collection

# Token rotation
npm run rotate:tokens     # Regenerate Slack tokens
```

**Quarterly Maintenance:**
```powershell
# Full database backup (different location)
npm run db:backup:full --location=/backup-drive/quarterly-backup-2026-Q1

# Database health check
npm run db:validate
# Checks:
# - All collections have required indexes
# - No corrupted documents
# - Replication lag (if replica set)
# - TTL index cleanup working
```

### Backup and Recovery

**Automated Backup Setup:**
```powershell
# Using MongoDB Atlas (recommended)
1. Enable automatic backups in Atlas console
   - Settings → Backup & Restore
   - Retention: 30 days
   - Frequency: Daily snapshots

# Using Local MongoDB with Docker
2. Create backup script (backup.sh):
   ```bash
   #!/bin/bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   docker exec suds-local-mongodb mongodump \
     --out /backup/mongodb-backup-${TIMESTAMP}
   ```

# Using Manual Backup (Local)
3. mongodump command:
   ```powershell
   mongodump --uri "mongodb://testuser:testpass@localhost:27017/slack_data" \
             --out ./backups/slack_data_backup_$(Get-Date -Format yyyyMMdd_HHmmss)
   ```
```

**Backup Retention Policy:**
```
Daily backups: Retain 7 days
Weekly backups: Retain 8 weeks
Monthly backups: Retain 1 year
Disaster recovery: At least 2 geographically separate locations
```

**Recovery Procedures:**

*Scenario A: Single Document Recovery*
```powershell
# Restore a single message document from backup
mongorestore --uri "mongodb://user:pass@localhost:27017" \
  --nsInclude="slack_data.messages" \
  --nsFrom="slack_data.messages" \
  --nsTo="slack_data.messages_temp" \
  ./backups/slack_data/slack_data/messages.bson

# Copy restored document back to main collection
# Verify integrity, then delete from temp collection
```

*Scenario B: Full Database Recovery*
```powershell
# Stop the application
Stop-Process -Name "node" -Force

# Restore from backup
mongorestore --uri "mongodb://user:pass@localhost:27017" \
  --drop \  # Replace existing database
  ./backups/slack_data_backup_20260101_120000/

# Restart services
npm start
```

*Scenario C: Point-in-Time Recovery (Atlas only)*
```
1. Go to Atlas console → Backups
2. Select the backup snapshot closest to desired time
3. Click "Restore" → "Restore to a new cluster"
4. Wait for restore to complete
5. Verify data integrity
6. Update MongoDB connection string in .env
7. Restart application
```

---

## Application Functions

### Slash Commands (Bot Features)

#### 1. `/store-messages`
**Purpose:** Save all messages in current channel to database

**Usage:**
```
/store-messages
```

**System Flow:**
1. Slack bot receives command
2. Fetches all messages from channel history (API limit: 1000/request)
3. Extracts user and channel metadata
4. Sends to MongoDB API in batches (12 MB max per batch, 500 docs per batch)
5. Returns confirmation with count of stored messages

**Response Example:**
```
✅ Stored 847 messages from #general
Database Status: Connected
API Response: Success
```

**Error Handling:**
- If channel not found: "❌ Channel not accessible. Please ensure bot is invited."
- If API unreachable: "❌ Database API is offline. Contact administrator."
- If batch size exceeded: "⚠️ Some messages couldn't be stored (too large). Admin notified."

#### 2. `/messages`
**Purpose:** Retrieve recent stored messages from current channel

**Usage:**
```
/messages [count]  # Default: 10 messages, max: 100
```

**System Flow:**
1. Query MongoDB for channel's most recent 10 messages
2. Format with sender name, timestamp, reactions
3. Display in Slack thread

**Response Example:**
```
Recent messages from #general:

@Wyatt (2 hours ago): "Let's discuss the NLP model"
@John (1 hour ago): "I've updated the config"
...
```

#### 3. `/channel-info`
**Purpose:** Display metadata about current channel

**Usage:**
```
/channel-info
```

**Returns:**
- Channel name, description, creation date
- Member count
- Total stored messages
- Last updated timestamp
- Privacy status (public/private)

#### 4. `/store-members`
**Purpose:** Sync all channel members to database

**Usage:**
```
/store-members
```

**System Flow:**
1. Fetch all users in workspace
2. For each member in channel: extract profile (name, email, avatar)
3. Store/update in `users` collection
4. Return confirmation

**Response Example:**
```
✅ Synced 23 members to database
New members: 3
Updated members: 8
```

#### 5. `/summarize-week`
**Purpose:** Generate NLP-powered summary of week's messages

**Usage:**
```
/summarize-week
```

**System Flow:**
1. Query messages from past 7 days in channel
2. Send to Google Gemini API with "summarize key topics" prompt
3. Extract topics, decisions, action items
4. Post formatted summary to channel

**Response Example:**
```
📊 **Week Summary (#general)**

**Key Topics:**
- NLP Model Performance Improvements
- Database Optimization
- Team Onboarding

**Decisions Made:**
✓ Migrate to MongoDB Atlas
✓ Use Gemini API for summarization

**Action Items:**
→ @Keith: Update configuration docs (Due: Friday)
→ @John: Performance testing (Due: Monday)
```

### Home Dashboard

**Access:** Click app name in Slack sidebar → "Home"

**Features:**
- Select channel to view statistics
- Quick links to recent summaries
- Admin panel (for workspace admins only)
- Settings for auto-save preferences

**Admin Functions (Admins Only):**
- Store all members in workspace
- View unsaved channels
- Bulk sync all channels
- Download data exports

---

## Error Messages and Recovery Actions

| Error | Cause | User Action | Admin Action |
|-------|-------|------------|--------------|
| "❌ Channel not accessible" | Bot not invited to channel | `/invite @SUD Bud` to channel | Verify bot has permissions |
| "❌ Database API is offline" | MongoDB API service crashed | Contact admin | Restart `mongo_storage` service |
| "⚠️ Request payload is too large" | Message data exceeds 25 MB | Split into smaller requests | Increase `REQUEST_BODY_LIMIT` in `.env` |
| "❌ Slack API rate limit" | Too many requests to Slack | Wait 60 seconds, retry | Implement request queuing (see config) |
| "MONGODB_USER not found" | Credentials incorrect | Verify `.env` file | Reset MongoDB password in Atlas |
| "Socket connection timeout" | Network issue or Socket Mode disabled | Check internet, restart bot | Verify `SLACK_APP_TOKEN` and Socket Mode enabled |
| "Cannot resolve hostname" | DNS failure or no internet | Check network connectivity | Restart network services, check firewall |
| "Duplicate key error" | Message already stored | Continue - system handles deduplication | Check indexes on messages collection |
| "TTL index deleted documents before backup" | Backup timing conflict | Restore from scheduled backup | Adjust cleanup schedule, increase retention |

**Standard Recovery Workflow:**
1. **Identify Error:** Check logs with `npm run logs:view`
2. **Diagnose:** Run health check `curl http://localhost:5000/health`
3. **Remediate:** Follow action in table above
4. **Verify:** Retry failed operation
5. **Document:** Log incident in Jira with timestamp and resolution

---

## Troubleshooting (Application Level)

### Bot Not Responding to Messages

**Diagnostic Steps:**
```powershell
# 1. Verify bot is running
ps aux | grep "npm start" | grep bolt_slack

# 2. Check Socket Mode connection
grep "Socket Mode" ./logs/app.log

# 3. Verify bot is in channel
# In Slack, type: /invite @SUD Bud

# 4. Test bot directly
# Send a direct message to the bot - should echo response

# 5. Check for errors
tail -20 ./logs/app.log
```

**Resolution:**
- If bot not running: `cd bolt_slack && npm start`
- If Socket Mode down: Restart bot and verify `SLACK_APP_TOKEN` in `.env`
- If not invited: Have workspace admin run `/invite @SUD Bud` in target channel

### Messages Not Saving to Database

**Diagnostic Steps:**
```powershell
# 1. Verify MongoDB API is running
curl http://localhost:5000/health

# 2. Check MongoDB connection
npm run db:test-connection

# 3. Verify credentials
echo $env:MONGODB_USER  # Should match database user

# 4. Check storage quota
npm run db:storage-stats
```

**Resolution:**
- If API offline: Restart `mongo_storage` service: `npm start` from `mongo_storage/` directory
- If auth error: Verify MongoDB user exists and password matches (case-sensitive)
- If storage full: Contact admin to archive old data or expand storage

### High Latency / Slow Responses

**Diagnostic Steps:**
```powershell
# 1. Check batch size configuration
echo $env:MONGO_INSERT_BATCH_BYTES  # Should be ~12 MB

# 2. Monitor memory usage
Get-Process node | Select-Object ProcessName, WorkingSet

# 3. Check database query performance
npm run db:slow-queries  # Queries taking >1 second

# 4. Check network latency to MongoDB
ping cluster0.xxxxx.mongodb.net
```

**Resolution:**
- If memory > 80% of available: Reduce `MONGO_INSERT_BATCH_BYTES` to 8 MB
- If slow queries: Run `npm run optimize:indexes`
- If high latency: Use closer MongoDB region or deploy app closer to database

### Slack Token Expired or Invalid

**Symptoms:**
- "Invalid Token" errors in logs
- `/store-messages` command fails

**Resolution:**
```powershell
# 1. Go to https://api.slack.com/apps → Your App
# 2. Click "Install App"
# 3. Click "Regenerate" next to Bot Token
# 4. Copy new token (xoxb-...)
# 5. Update .env: SLACK_BOT_TOKEN=xoxb-new-token
# 6. Restart bot: npm start
# 7. Verify: Send test message to bot
```

---

## Support

### Contact Information

**Technical Support Channels:**

| Issue Type | Contact | Response Time | Availability |
|-----------|---------|---------------|--------------| 
| Bug Report | [Jira Issues](https://temple-cis-projects-in-cs.atlassian.net/jira/software/c/projects/DT/issues) | 24-48 hours | Business days |
| Urgent Outage | [GitHub Issues](https://github.com/Capstone-Projects-2026-spring/capstone-projects-2026-spring-classroom-373a75-project-tu-cis-4398-docs-template-1/issues) | 1-2 hours | 24/7 |
| Feature Request | GitHub Discussions | 1 week | Business days |
| Security Vulnerability | [Email Security Report](mailto:capstone-projects-2026-spring@temple.edu) | 24 hours | 24/7 |

### Team Contacts

**Development Team:**
- Wyatt Zantua (Backend/Database): [GitHub](https://github.com/zantuaw09)
- John Currie (Backend/Deployment): [GitHub](https://github.com/John-C-Currie)
- Keith Winter (Database): [GitHub](https://github.com/KeWinter)
- Donte' Harmon (Frontend): [GitHub](https://github.com/dontetu)
- Fares Hagos (Frontend): [GitHub](https://github.com/FaresHagostu)

### Support Service Levels (SLA)

**Production Environment:**
- **P1 (Critical):** System down, no users can save messages
  - Resolution target: 4 hours
  - Escalation: All hands on deck
  
- **P2 (High):** Limited functionality, workarounds available
  - Resolution target: 8 hours
  - Escalation: Senior engineer within 2 hours
  
- **P3 (Medium):** Minor functionality impact
  - Resolution target: 24 hours
  - Escalation: Assigned engineer
  
- **P4 (Low):** Cosmetic or documentation issues
  - Resolution target: 1 week
  - Escalation: Backlog prioritization

**Issue Reporting Format:**
```
Title: [COMPONENT] Brief description

Environment:
- Deployment: (local/render/production)
- Node.js version: (output of `node --version`)
- MongoDB: (local/atlas, version)

Steps to Reproduce:
1. ...
2. ...

Expected Behavior:
...

Actual Behavior:
...

Logs/Screenshots:
[Attach relevant logs or error screenshots]

Timestamp:
[When the issue occurred]
```

---

## Missing Documentation Requiring Completion

The following sections require additional information to fully complete this guide. **Owner** indicates who should provide the details:

1. **Screenshots & UI Walkthrough** (Owner: Donte' Harmon)
   - Home dashboard interface
   - Command response examples
   - Error message examples
   - Admin panel features

2. **Performance Benchmarks** (Owner: Keith Winter)
   - Message storage throughput (messages/second)
   - Query response times by collection size
   - Memory usage under load
   - Database growth projections

3. **Disaster Recovery Plan** (Owner: Wyatt Zantua)
   - RTO (Recovery Time Objective) targets
   - RPO (Recovery Point Objective) targets
   - Failover procedures
   - Backup schedule details

4. **NLP Model Documentation** (Owner: Fares Hagos)
   - Model architecture and accuracy metrics
   - Retraining procedures
   - Configuration parameters
   - Supported languages

5. **API Documentation** (Owner: John Currie)
   - REST endpoint specifications
   - Request/response examples
   - Rate limiting details
   - Authentication methods

6. **Monitoring & Alerting Setup** (Owner: Team)
   - Datadog/New Relic configuration
   - Alert thresholds
   - Dashboard definitions
   - On-call rotation schedule

7. **Deployment Procedures** (Owner: Wyatt Zantua)
   - CI/CD pipeline configuration
   - Blue-green deployment strategy
   - Rollback procedures
   - Environment promotion workflow

8. **Compliance & Audit Logging** (Owner: Team)
   - Data retention policies per regulatory requirement
   - User data deletion procedures (GDPR right to be forgotten)
   - Access audit logs
   - Change audit trails
