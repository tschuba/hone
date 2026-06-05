#!/usr/bin/env bash
set -euo pipefail

cp -n .env.example .env || true
docker compose -f docker-compose.dev.yml up -d
bun install
bunx prisma generate --schema apps/api/prisma/schema.prisma
bunx prisma migrate dev --schema apps/api/prisma/schema.prisma --name init

echo "✓ Dev stack ready."
echo ""
echo "Next steps:"
echo "  1. bun run dev:api          # start the API"
echo "  2. bun run dev:web          # start the web app"
echo "  3. bun run cli seed-exercises --fixture-only  # seed exercise data (requires API running)"