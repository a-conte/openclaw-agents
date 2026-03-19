# Apple Shortcuts Recipes

Use the dashboard as the Apple-facing control surface. Shortcuts should call the
dashboard-hosted `/api/shortcuts/*` routes, not `listen` directly.

Base URL examples:

- local Mac: `http://127.0.0.1:3000`
- another device on LAN: `http://<your-mac-lan-ip>:3000`

## Compact Summary

Shortcut action:

- `Get Contents of URL`

Settings:

- method: `GET`
- URL: `http://<dashboard-host>:3000/api/shortcuts/summary`

## Latest Failed Job

Shortcut action:

- `Get Contents of URL`

Settings:

- method: `GET`
- URL: `http://<dashboard-host>:3000/api/shortcuts/latest-failed`

Useful fields:

- `job.id`
- `job.summary`
- `job.templateId`
- `job.status`

## List Templates

Shortcut action:

- `Get Contents of URL`

Settings:

- method: `GET`
- URL: `http://<dashboard-host>:3000/api/shortcuts/templates`

## Run Template

Shortcut action:

- `Get Contents of URL`

Settings:

- method: `POST`
- request body: JSON
- URL: `http://<dashboard-host>:3000/api/shortcuts/run-template`

Sample payload:

- [`docs/apple-shortcuts/run-template.json`](/Users/a_conte/dev/openclaw-agents/docs/apple-shortcuts/run-template.json)

## Retry Latest Failed

Shortcut action:

- `Get Contents of URL`

Settings:

- method: `POST`
- request body: JSON
- URL: `http://<dashboard-host>:3000/api/shortcuts/retry-latest-failed`

Sample payload:

- [`docs/apple-shortcuts/retry-latest-failed.json`](/Users/a_conte/dev/openclaw-agents/docs/apple-shortcuts/retry-latest-failed.json)

## First Recommended Shortcuts

- `Mission Control Summary`
- `Run Open Command Page`
- `Retry Latest Failed Job`
- `List Recommended Templates`

## Notes

- keep `listen` loopback-only
- expose only the dashboard to other devices
- keep the dashboard as primary Mission Control and the iPad as supplemental
