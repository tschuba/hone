# Build stage
FROM oven/bun:1.3 AS builder
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
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN bun run build

# Serve stage
FROM nginx:1.27-alpine AS server
COPY --from=builder /app/apps/web/build /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
