FROM oven/bun:1.3 AS base
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Copy shared source before install so bun populates the nested workspace link correctly
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

RUN bun install --frozen-lockfile

# Generate Prisma client (requires schema before sources)
COPY apps/api/prisma ./apps/api/prisma
RUN cd apps/api && bunx prisma generate
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/entrypoint.sh ./apps/api/
RUN chmod +x /app/apps/api/entrypoint.sh

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["/app/apps/api/entrypoint.sh"]
