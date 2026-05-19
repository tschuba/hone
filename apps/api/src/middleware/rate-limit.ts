import { createMiddleware } from "hono/factory";

import type { AuthVariables } from "./auth";

const WINDOW_MS = 60 * 1000;
const MAX_AUTH_REQUESTS_PER_WINDOW = 10;
const MAX_REQUESTS_PER_WINDOW = 100;

type Counter = {
  count: number;
  resetAt: number;
};

const requestCounts = new Map<string, Counter>();

function getClientKey(ip: string | undefined) {
  return ip ?? "anonymous";
}

function getRequestKey(c: Parameters<ReturnType<typeof createMiddleware>>[0]) {
  const realIp = c.req.header("x-real-ip")?.trim();
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();

  return getClientKey(realIp || forwardedFor || undefined);
}

function applyRateLimitHeaders(
  c: { header(name: string, value: string): void },
  input: { limit: number; remaining: number; resetAt: number },
) {
  c.header("X-RateLimit-Limit", input.limit.toString());
  c.header("X-RateLimit-Remaining", Math.max(0, input.remaining).toString());
  c.header(
    "Retry-After",
    Math.ceil((input.resetAt - Date.now()) / 1000).toString(),
  );
}

function createKeyedRateLimitMiddleware(
  maxRequestsPerWindow: number,
  getKey: (c: Parameters<ReturnType<typeof createMiddleware>>[0]) => string,
) {
  return createMiddleware(async (c, next) => {
    const key = `${maxRequestsPerWindow}:${getKey(c)}`;
    const now = Date.now();
    const current = requestCounts.get(key);

    if (!current || current.resetAt <= now) {
      const nextCounter = {
        count: 1,
        resetAt: now + WINDOW_MS,
      };

      requestCounts.set(key, nextCounter);
      applyRateLimitHeaders(c, {
        limit: maxRequestsPerWindow,
        remaining: maxRequestsPerWindow - 1,
        resetAt: nextCounter.resetAt,
      });
      await next();
      return;
    }

    if (current.count >= maxRequestsPerWindow) {
      applyRateLimitHeaders(c, {
        limit: maxRequestsPerWindow,
        remaining: 0,
        resetAt: current.resetAt,
      });
      return c.json({ status: 429, title: "Too many requests" }, 429);
    }

    current.count += 1;
    requestCounts.set(key, current);
    applyRateLimitHeaders(c, {
      limit: maxRequestsPerWindow,
      remaining: maxRequestsPerWindow - current.count,
      resetAt: current.resetAt,
    });
    await next();
  });
}

function createRateLimitMiddleware(maxRequestsPerWindow: number) {
  return createKeyedRateLimitMiddleware(maxRequestsPerWindow, getRequestKey);
}

export const rateLimitMiddleware = createRateLimitMiddleware(
  MAX_REQUESTS_PER_WINDOW,
);
export const authRateLimitMiddleware = createRateLimitMiddleware(
  MAX_AUTH_REQUESTS_PER_WINDOW,
);
export const authenticatedRateLimitMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const key = `${MAX_REQUESTS_PER_WINDOW}:user:${c.get("userId")}`;
  const now = Date.now();
  const current = requestCounts.get(key);

  if (!current || current.resetAt <= now) {
    const nextCounter = {
      count: 1,
      resetAt: now + WINDOW_MS,
    };

    requestCounts.set(key, nextCounter);
    applyRateLimitHeaders(c, {
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: nextCounter.resetAt,
    });
    await next();
    return;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    applyRateLimitHeaders(c, {
      limit: MAX_REQUESTS_PER_WINDOW,
      remaining: 0,
      resetAt: current.resetAt,
    });
    return c.json({ status: 429, title: "Too many requests" }, 429);
  }

  current.count += 1;
  requestCounts.set(key, current);
  applyRateLimitHeaders(c, {
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: MAX_REQUESTS_PER_WINDOW - current.count,
    resetAt: current.resetAt,
  });
  await next();
});
