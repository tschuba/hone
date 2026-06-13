#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
bunx prisma migrate deploy

echo "[entrypoint] Starting API server..."
exec bun run src/index.ts
