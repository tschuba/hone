## 1. Production Compose Configuration

- [x] 1.1 Create or verify `docker-compose.prod.yml`: API service, SvelteKit static web service, PostgreSQL, Ollama (optional, can be disabled). Confirm health checks, restart policies, and volume mounts.
- [x] 1.2 Confirm all required environment variables are documented: `DATABASE_URL`, `SESSION_SECRET`, `CSRF_SECRET`, `ALLOWED_ORIGINS`, `OLLAMA_BASE_URL`, and any OIDC vars.

## 2. Coolify Setup

- [x] 2.1 Create a Coolify application for the API service pointing at the repo, using the production Dockerfile.
- [x] 2.2 Create a Coolify application for the web service (SvelteKit static build served via a static server or Node adapter).
- [x] 2.3 Configure PostgreSQL as a Coolify-managed database resource; wire `DATABASE_URL` into the API service.
- [x] 2.4 Run Prisma migrations on first deploy via a Coolify deploy command or migration container.

## 3. HTTPS / External Access

- [x] 3.1 Choose access method: Coolify-managed Let's Encrypt domain OR Cloudflare tunnel (no open port required). Document the chosen approach.
- [ ] 3.2 Confirm the app is reachable over HTTPS from a mobile browser outside the home network.
- [x] 3.3 Set `ALLOWED_ORIGINS` and CSRF config to the production domain.

## 4. Validation

- [x] 4.1 Register a new account, complete onboarding, generate a plan, start and complete a workout — full flow from a mobile browser over the public URL.
- [ ] 4.2 Verify PWA install prompt appears on mobile and the installed PWA loads the cached workout offline.
