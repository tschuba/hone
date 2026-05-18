#!/usr/bin/env bash
set -euo pipefail

cp -n .env.example .env || true
docker compose -f docker-compose.dev.yml up -d
bun install
cd apps/api
bunx prisma generate
bunx prisma migrate dev --name init
cd ../..

echo "✓ Dev stack ready. Run: bun run dev:api and bun run dev:web"