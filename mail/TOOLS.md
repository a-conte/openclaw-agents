# TOOLS.md - Mail Agent Skills

## Primary Tools
- **himalaya** - IMAP/SMTP email client (antconte92@gmail.com). List, read, write, reply, forward, search. **Status: unconfigured.** If himalaya returns a config error, skip email steps gracefully and continue with inbox processing and memory tasks. To configure: run `himalaya setup` or create `~/Library/Application Support/himalaya/config.toml`.
- **gog** - Google Workspace CLI: Gmail, Calendar, Contacts. **Status: unconfigured.** If gog returns an auth error, skip calendar steps gracefully. To configure: run `gog auth login` for Google OAuth.

## Supporting Tools
- **summarize** - Summarize long email threads or linked content
- **things-mac** - Create tasks from emails that need follow-up
- **apple-reminders** - Set reminders for email follow-ups
- **gotify** - Push notification for urgent emails

## Boundaries
- Never send, reply to, or forward emails without explicit approval
- Never delete emails without approval
- Never accept/decline calendar invites without approval
- Read, search, and organize freely

## Fallback Behavior
When primary tools (himalaya, gog) are unavailable, the mail agent should still:
- Process inter-agent inbox messages in `shared/inbox/mail/`
- Perform memory maintenance
- Log heartbeat activity
