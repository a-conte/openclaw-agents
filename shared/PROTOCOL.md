# Inter-Agent Communication Protocol

## Overview

Agents communicate through a file-based message bus at `shared/inbox/`. Each agent has its own inbox folder.

## Message Format

Messages are JSON files placed in the target agent's inbox folder.

**Filename:** `{timestamp}-{from}.json` (e.g., `1709913600-main.json`)

**Schema:**
```json
{
  "from": "main",
  "to": "dev",
  "subject": "CI failure on openclaw-agents",
  "body": "The last GitHub Actions run failed on main branch. Please investigate.",
  "priority": "high",
  "timestamp": "2026-03-08T12:00:00Z",
  "status": "unread",
  "pipeline": null,
  "replyTo": null
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | yes | Sender agent ID |
| `to` | string | yes | Recipient agent ID |
| `subject` | string | yes | Brief summary |
| `body` | string | yes | Full message content |
| `priority` | `"low"` \| `"normal"` \| `"high"` \| `"urgent"` | yes | Message priority |
| `timestamp` | ISO 8601 | yes | When the message was created |
| `status` | `"unread"` \| `"read"` \| `"actioned"` | yes | Processing status |
| `pipeline` | string \| null | no | Pipeline ID if part of a workflow |
| `replyTo` | string \| null | no | Filename of the message being replied to |

## Sending a Message

1. Create a JSON file following the schema above
2. Write it to `shared/inbox/{target-agent}/{timestamp}-{your-id}.json`
3. Use Unix epoch seconds for the timestamp prefix in the filename

Example: Main telling Dev about a CI failure:
```bash
# Write to shared/inbox/dev/1709913600-main.json
```

## Reading Messages

During each heartbeat, check your inbox:

1. List files in `shared/inbox/{your-id}/`
2. Read any files with `"status": "unread"`
3. Process the message based on priority and content
4. Update the file's `status` to `"read"` or `"actioned"`
5. Reply by creating a new message in the sender's inbox (set `replyTo` to original filename)

## Routing Rules

| Event | From | To | Priority |
|-------|------|----|----------|
| CI/build failure | dev | main | high |
| Security incident | security | main + dev | urgent |
| New research finding | research / ai-research | main | normal |
| Article summary for newsletter | research | mail | normal |
| Documentation update needed | any | docs | low |
| Urgent email received | mail | main | high |
| Config integrity issue | security | main | urgent |
| Memory consolidation result | main | target agent | low |

## Priority Handling

- **urgent** — Process immediately, notify human via Telegram
- **high** — Process during current heartbeat
- **normal** — Process during next available heartbeat
- **low** — Process when convenient, can batch

## Cleanup

Messages with `"status": "actioned"` older than 7 days can be deleted during memory maintenance.
