#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
bunx prisma migrate deploy

echo "[entrypoint] Seeding exercises..."
bun run src/cli/seed-exercises.ts seed-exercises --fixture-only --no-wait

echo "[entrypoint] Starting API server..."
exec bun run src/index.ts
