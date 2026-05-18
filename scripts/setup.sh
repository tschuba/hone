#!/usr/bin/env bash
set -euo pipefail

cp -n .env.example .env || true
docker compose -f docker-compose.dev.yml up -d
bun install
bunx prisma generate --schema apps/api/prisma/schema.prisma
bunx prisma migrate dev --schema apps/api/prisma/schema.prisma --name init

echo "✓ Dev stack ready. Run: bun run dev:api and bun run dev:web"