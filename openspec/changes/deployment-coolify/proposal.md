## Why

The app runs locally in Docker Compose but is not reachable outside the home network. For the app to serve its primary use case — tracking workouts outdoors on a phone — it must be deployed and accessible via HTTPS on a stable URL. The target host is a Raspberry Pi 5 managed by Coolify.

## What Changes

- Define and implement the Coolify deployment configuration for the Hone stack (API, web, PostgreSQL, Ollama).
- Expose the app over HTTPS via a stable domain or Cloudflare tunnel so it is reachable on mobile outside the home network.
- Document the environment variables, secrets, and one-time setup steps required for a clean install.

## Capabilities

### New Capabilities
- `deployment`: Repeatable, documented deployment of the full Hone stack on a Raspberry Pi 5 via Coolify, reachable over HTTPS.

### Modified Capabilities
- None.

## Impact

- Adds Coolify app/service configuration (via Coolify UI or exported config).
- Adds or updates `docker-compose.prod.yml` or equivalent production compose file if needed.
- Adds deployment documentation to the project (env var reference, setup checklist).
- No application code changes expected.
