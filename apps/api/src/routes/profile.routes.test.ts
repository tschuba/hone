import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createProfileRoutes } from "./profile.routes";

function createTestApp(storage: {
  findUserById(userId: string): Promise<{
    constraints: { impactFilter: boolean };
    goals: Array<{ scope: "profile"; value: string }>;
  } | null>;
  updateUser(input: {
    constraints: { impactFilter: boolean };
    goals: Array<{ scope: "profile"; value: string }>;
    userId: string;
  }): Promise<{
    constraints: { impactFilter: boolean };
    goals: Array<{ scope: "profile"; value: string }>;
  }>;
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/users",
    createProfileRoutes({
      authGuard: async (c, next) => {
        c.set("sessionId", "session-1");
        c.set("userId", "user-1");
        await next();
      },
      storage,
    }),
  );

  return app;
}

describe("profile routes", () => {
  it("returns the authenticated profile", async () => {
    const app = createTestApp({
      async findUserById() {
        return {
          constraints: { impactFilter: true },
          goals: [{ scope: "profile", value: "Build consistency" }],
        };
      },
      async updateUser() {
        return {
          constraints: { impactFilter: false },
          goals: [],
        };
      },
    });

    const response = await app.request("http://hone.test/api/v1/users/me");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      constraints: { impactFilter: true },
      goals: [{ scope: "profile", value: "Build consistency" }],
    });
  });

  it("updates goals and constraints", async () => {
    let updatedInput:
      | {
          constraints: { impactFilter: boolean };
          goals: Array<{ scope: "profile"; value: string }>;
          userId: string;
        }
      | undefined;

    const app = createTestApp({
      async findUserById() {
        return {
          constraints: { impactFilter: false },
          goals: [],
        };
      },
      async updateUser(input) {
        updatedInput = input;
        return {
          constraints: input.constraints,
          goals: input.goals,
        };
      },
    });

    const response = await app.request("http://hone.test/api/v1/users/me", {
      body: JSON.stringify({
        constraints: { impactFilter: true },
        goals: [{ scope: "profile", value: "Reduce knee pain" }],
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });

    expect(response.status).toBe(200);
    expect(updatedInput).toEqual({
      constraints: { impactFilter: true },
      goals: [{ scope: "profile", value: "Reduce knee pain" }],
      userId: "user-1",
    });
  });
});
