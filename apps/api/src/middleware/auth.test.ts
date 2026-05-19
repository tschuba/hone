import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { type AuthVariables, createAuthMiddleware } from "./auth";

function createTestApp(
  validateSession: (
    rawToken: string,
  ) => Promise<{ id: string; user: { id: string } } | null>,
) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.use("*", createAuthMiddleware({ validateSession }));
  app.get("/protected", (c) => {
    return c.json({
      sessionId: c.get("sessionId"),
      userId: c.get("userId"),
    });
  });

  return app;
}

describe("auth middleware", () => {
  it("rejects requests without a session cookie", async () => {
    const app = createTestApp(async () => ({
      id: "session-1",
      user: { id: "user-1" },
    }));

    const response = await app.request("http://hone.test/protected");

    expect(response.status).toBe(401);
  });

  it("rejects requests with an invalid session", async () => {
    const app = createTestApp(async () => null);

    const response = await app.request("http://hone.test/protected", {
      headers: {
        cookie: "hone_session=bad-token",
      },
    });

    expect(response.status).toBe(401);
  });

  it("sets session variables for valid sessions", async () => {
    const app = createTestApp(async (rawToken: string) => {
      if (rawToken !== "valid-token") {
        return null;
      }

      return {
        id: "session-1",
        user: { id: "user-1" },
      };
    });

    const response = await app.request("http://hone.test/protected", {
      headers: {
        cookie: "hone_session=valid-token",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: "session-1",
      userId: "user-1",
    });
  });
});
