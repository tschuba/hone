import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { csrfMiddleware } from "./csrf";

function createTestApp() {
  const app = new Hono();

  app.use("*", csrfMiddleware);
  app.post("/protected", (c) => c.json({ ok: true }, 200));

  return app;
}

describe("csrf middleware", () => {
  it("rejects state-changing requests with a missing origin", async () => {
    const app = createTestApp();

    const response = await app.request("http://hone.test/protected", {
      headers: {
        cookie: "csrf_token=test-token",
        "x-csrf-token": "test-token",
      },
      method: "POST",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: 403,
      title: "Invalid request origin",
    });
  });

  it("rejects state-changing requests from a different origin", async () => {
    const app = createTestApp();

    const response = await app.request("http://hone.test/protected", {
      headers: {
        cookie: "csrf_token=test-token",
        origin: "https://evil.example.com",
        "x-csrf-token": "test-token",
      },
      method: "POST",
    });

    expect(response.status).toBe(403);
  });

  it("allows same-origin requests with matching csrf tokens", async () => {
    const app = createTestApp();

    const response = await app.request("http://hone.test/protected", {
      headers: {
        cookie: "csrf_token=test-token",
        origin: "http://localhost:3000",
        "x-csrf-token": "test-token",
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("allows backchannel logout without browser csrf headers", async () => {
    const app = new Hono();

    app.use("*", csrfMiddleware);
    app.post("/api/v1/auth/backchannel-logout", (c) =>
      c.json({ ok: true }, 200),
    );

    const response = await app.request(
      "http://hone.test/api/v1/auth/backchannel-logout",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
  });
});
