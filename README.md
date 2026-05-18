# Hone

Hone is a self-hosted fitness PWA with AI-assisted workout generation. This repository is currently in the MVP build-out phase, with the architecture and execution plan defined in the project docs.

## Project Docs

- Architecture and requirements: `ARCHITECTURE.md`
- MVP implementation plan: `docs/implementation/MVP_IMPLEMENTATION_PLAN.md`

## Current Repository State

The repository currently contains the Sprint 0 foundation scaffold:

- Bun workspace root
- API app in `apps/api`
- Web app in `apps/web`
- Shared package in `packages/shared`
- Dev infrastructure in `docker-compose.dev.yml`
- One-command setup script in `scripts/setup.sh`

## Requirements

Before working on the project, install:

- Docker Desktop or Colima
- Bun >= 1.1
- Node.js >= 20
- Git
- VS Code with Svelte and Prisma extensions recommended

## Install Bun

Hone uses Bun as the primary package manager and task runner. The repo scripts assume `bun`, `bun run`, and `bunx` are available.

### macOS/Linux

```bash
curl -fsSL https://bun.sh/install | bash
exec /bin/zsh
bun --version
```

If `bun` is still not available after installation, add it to your shell path and reload the shell:

```bash
export PATH="$HOME/.bun/bin:$PATH"
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
exec /bin/zsh
bun --version
```

The root `package.json` declares Bun as the package manager:

```json
"packageManager": "bun@1.2.15"
```

## Environment Setup

Start from the example environment file:

```bash
cp .env.example .env
```

Important variables in `.env`:

- `DATABASE_URL` points to the local PostgreSQL instance from `docker-compose.dev.yml`
- `SESSION_SECRET` and `CSRF_SECRET` must be set to real values for non-local usage
- Set `USE_LOCAL_AUTH_ONLY=true` if you do not have OIDC ready yet
- `AI_BASE_URL` defaults to the local Ollama container

## Quick Start

For the current scaffold, the fastest setup path is:

```bash
./scripts/setup.sh
```

That script currently does the following:

- creates `.env` from `.env.example` if missing
- starts the local dev services with `docker compose -f docker-compose.dev.yml up -d`
- installs dependencies with `bun install`
- generates the Prisma client
- runs the initial Prisma development migration

After setup, start the apps with:

```bash
bun run dev:api
bun run dev:web
```

## Manual Startup

If you want to run the steps individually instead of using the setup script:

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun install
cd apps/api && bunx prisma generate && bunx prisma migrate dev --name init
```

Then run:

```bash
bun run dev:api
bun run dev:web
```

## Useful Commands

From the repository root:

```bash
bun run lint
bun run format
bun run typecheck
bun run test
```

## Dev Services

The local development stack defined in `docker-compose.dev.yml` includes:

- PostgreSQL with pgvector on `localhost:5432`
- MinIO on `localhost:9000` with console on `localhost:9001`
- Ollama on `localhost:11434`

## Repository Layout

```text
hone/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   └── shared/
├── docs/
├── scripts/
├── docker-compose.dev.yml
├── ARCHITECTURE.md
└── README.md
```

## Notes

- Bun is required even if some fallback validation was previously done with Node.js tooling.
- The implementation plan in `docs/implementation/MVP_IMPLEMENTATION_PLAN.md` remains the execution source of truth.
