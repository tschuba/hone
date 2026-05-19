import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import {
  authRateLimitMiddleware,
  authenticatedRateLimitMiddleware,
  rateLimitMiddleware,
} from "./rate-limit";

describe("rate limit middleware", () => {
  it("applies the stricter auth limit with rate limit headers", async () => {
    const app = new Hono();

    app.use("*", authRateLimitMiddleware);
    app.post("/login", (c) => c.json({ ok: true }, 200));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await app.request("http://hone.test/login", {
        headers: {
          "x-real-ip": "203.0.113.10",
        },
        method: "POST",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("x-ratelimit-limit")).toBe("10");
    }

    const limitedResponse = await app.request("http://hone.test/login", {
      headers: {
        "x-real-ip": "203.0.113.10",
      },
      method: "POST",
    });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get("x-ratelimit-limit")).toBe("10");
    expect(limitedResponse.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(limitedResponse.headers.get("retry-after")).not.toBeNull();
  });

  it("keeps counters separate per real ip", async () => {
    const app = new Hono();

    app.use("*", authRateLimitMiddleware);
    app.post("/register", (c) => c.json({ ok: true }, 200));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await app.request("http://hone.test/register", {
        headers: {
          "x-real-ip": "203.0.113.11",
        },
        method: "POST",
      });
    }

    const response = await app.request("http://hone.test/register", {
      headers: {
        "x-real-ip": "203.0.113.12",
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-limit")).toBe("10");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("9");
  });

  it("applies the broader app limit independently from the auth limiter", async () => {
    const app = new Hono();

    app.use("*", rateLimitMiddleware);
    app.get("/health", (c) => c.json({ ok: true }, 200));

    const response = await app.request("http://hone.test/health", {
      headers: {
        "x-real-ip": "203.0.113.13",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-limit")).toBe("100");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("99");
  });

  it("applies authenticated rate limits per user id", async () => {
    const app = new Hono<{ Variables: { userId: string } }>();

    app.use("*", async (c, next) => {
      c.set("userId", c.req.header("x-user-id") ?? "anonymous-user");
      await next();
    });
    app.use("*", authenticatedRateLimitMiddleware);
    app.get("/me", (c) => c.json({ userId: c.get("userId") }, 200));

    const firstUserResponse = await app.request("http://hone.test/me", {
      headers: {
        "x-user-id": "user-1",
      },
    });
    const secondUserResponse = await app.request("http://hone.test/me", {
      headers: {
        "x-user-id": "user-2",
      },
    });

    expect(firstUserResponse.status).toBe(200);
    expect(firstUserResponse.headers.get("x-ratelimit-limit")).toBe("100");
    expect(firstUserResponse.headers.get("x-ratelimit-remaining")).toBe("99");
    expect(secondUserResponse.status).toBe(200);
    expect(secondUserResponse.headers.get("x-ratelimit-remaining")).toBe("99");
  });
});
