# Hone — Deployment Guide (Coolify on Raspberry Pi 5)

This guide covers deploying the full Hone stack on a Raspberry Pi 5 managed by Coolify, accessible over HTTPS from a mobile browser outside the home network.

---

## Prerequisites

- Raspberry Pi 5 with Coolify installed and running
- A domain name **or** a Cloudflare account (for tunnels — see [HTTPS Access](#https-access))
- Git repository accessible from the Pi (GitHub, Forgejo, etc.)

---

## Environment Variables

All variables are configured in Coolify per-service. Copy `.env.example` as a reference.

### Required

| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password (compose only — not needed in Coolify managed DB) |
| `DATABASE_URL` | Full Postgres connection string, e.g. `postgresql://hone:pass@db:5432/hone?connection_limit=5&pool_timeout=10` |
| `SESSION_SECRET` | Random string ≥ 32 chars — used to sign session cookies |
| `CSRF_SECRET` | Random string ≥ 32 chars — used for CSRF token HMAC |
| `APP_URL` | Public HTTPS URL of the **web** frontend, e.g. `https://hone.example.com`. **Must match the origin the browser sends.** |
| `NODE_ENV` | Set to `production` |
| `PORT` | API port inside the container — set to `3001` |

> **Note:** `APP_URL` controls the CSRF origin check. If the frontend is served from a different origin than `APP_URL`, all non-GET requests will be rejected with 403. Set this to the exact public domain used by the web app.

### Authentication

Either set `USE_LOCAL_AUTH_ONLY=true` (simple email/password), or configure OIDC:

| Variable | Description |
|---|---|
| `USE_LOCAL_AUTH_ONLY` | `true` to skip OIDC and use local accounts |
| `OIDC_ISSUER` | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `OIDC_ROLE_CLAIM` | JWT claim containing user roles (default: `groups`) |
| `OIDC_ADMIN_VALUE` | Value of role claim that grants admin access (default: `admin`) |

### AI (optional)

| Variable | Description |
|---|---|
| `AI_PROVIDER` | `ollama` (default), `openai`, `anthropic`, or `gemini` |
| `AI_BASE_URL` | Base URL for the AI provider API |
| `AI_MODEL` | Model name (e.g. `llama3.2`) |

### First-boot (optional)

| Variable | Description |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | Email to pre-seed as admin on first start |

---

## HTTPS Access

Choose **one** of the following approaches:

### Option A — Coolify-managed domain (recommended)

1. Register a domain (or use a subdomain of one you own).
2. In Coolify → Settings → Domains, add the domain and generate a Let's Encrypt certificate.
3. Point your domain's DNS A record to the Pi's public IP (requires port 80/443 forwarded on your router).
4. Assign the domain to the web service in Coolify.

### Option B — Cloudflare Tunnel (no open ports required)

1. Create a Cloudflare account and add your domain.
2. In Cloudflare Zero Trust → Networks → Tunnels, create a new tunnel.
3. Install the `cloudflared` daemon on the Pi and authenticate.
4. Configure the tunnel to route `https://hone.example.com` → `http://localhost:3000` (or the Coolify-assigned internal URL of the web service).
5. Cloudflare terminates TLS — no certificate management needed on the Pi.

> Cloudflare Tunnel is preferred if you don't want to open ports on your home router.

---

## Coolify Setup

### 1. Add the repository

In Coolify → Sources, add your Git repository (SSH key or token).

### 2. Create the API application

1. **New Resource → Application → Docker Compose** (or **Dockerfile**)
2. Select repository and branch (`main`)
3. Set **Dockerfile path**: `apps/api/Dockerfile`
4. Set **Docker build context**: `/` (repo root)
5. Set port: `3001`
6. Add all [required environment variables](#required) in the Environment tab
7. Deploy

> Prisma migrations run automatically at startup via `entrypoint.sh`.

### 3. Create the web application

1. **New Resource → Application → Dockerfile**
2. Select repository and branch (`main`)
3. Set **Dockerfile path**: `apps/web/Dockerfile`
4. Set **Docker build context**: `/` (repo root)
5. Set port: `80`
6. Assign your HTTPS domain to this service
7. Deploy

### 4. Create the PostgreSQL database

1. **New Resource → Database → PostgreSQL** (choose `pgvector/pgvector:pg17` for the image)
2. Note the generated connection string
3. Paste the full `DATABASE_URL` into the API service's environment variables

### 5. Prisma migrations

Migrations run automatically on every API container start via `entrypoint.sh`:

```sh
bunx prisma migrate deploy
```

To run migrations manually (e.g. after a schema change):

```sh
# On the Pi, exec into the running API container
docker exec -it hone-api bunx prisma migrate deploy
```

### 6. Ollama (optional)

Deploy Ollama as a separate Coolify application using `ollama/ollama` (Docker image), or run it natively on the Pi. Set `AI_BASE_URL` on the API service to the Ollama URL.

---

## Production Compose (local testing)

To test the production configuration locally before deploying to Coolify:

```sh
# Create a .env.prod with real values (never commit this file)
cp .env.example .env.prod
# Edit .env.prod ...

# Build and start (with Ollama)
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile ai up --build

# Without Ollama
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build
```

---

## Validation Checklist

- [ ] Register account at the public HTTPS URL from a mobile browser
- [ ] Complete onboarding, generate a plan, start and finish a workout
- [ ] Put phone in airplane mode, log a set, reconnect — confirm sync
- [ ] Verify PWA install prompt appears; confirm offline workout loads from cache
