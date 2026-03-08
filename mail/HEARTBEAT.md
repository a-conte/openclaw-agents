# HEARTBEAT.md - Mail Agent Periodic Tasks

1. **Check inbox** - Run `himalaya list -s unseen` for unread messages. Flag anything urgent (time-sensitive, from known important contacts).
2. **Calendar preview** - Check today's upcoming events via `gog cal today`. Alert if anything in the next 2 hours.
3. **Draft review** - Check for any pending drafts that may need sending.
4. **Check inbox** - Read all `*.json` files in `shared/inbox/mail/`. Process unread messages (e.g., newsletter draft requests from Main). Update status to `"read"` or `"actioned"`. See `shared/PROTOCOL.md`.
5. **Urgent email escalation** - If an urgent unread email is found, send a message to `shared/inbox/main/` with subject "Urgent Email", priority "high", and a summary of the email.
6. **Memory maintenance** - Consolidate useful patterns into MEMORY.md.
