import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createFeedbackRoutes } from "./feedback.routes";

function createTestApp(options: {
  aiRateLimiter: {
    checkAndRecord(
      userId: string,
      input?: unknown,
      priority?: "FEEDBACK" | "NORMAL",
      type?: "FEEDBACK" | "MESOCYCLUS",
    ): Promise<{ id: string }>;
  };
  notifier?: {
    notify(jobId: string): Promise<void>;
  };
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/feedback",
    createFeedbackRoutes({
      aiRateLimiter: options.aiRateLimiter,
      authGuard: async (c, next) => {
        c.set("sessionId", "session-1");
        c.set("userId", "user-1");
        await next();
      },
      notifier: options.notifier,
    }),
  );

  return app;
}

describe("feedback routes", () => {
  it("stores weekly feedback and queues new ai plan job", async () => {
    let receivedInput:
      | {
          input?: unknown;
          priority?: "FEEDBACK" | "NORMAL";
          type?: "FEEDBACK" | "MESOCYCLUS";
          userId: string;
        }
      | undefined;
    let notifiedJobId: string | undefined;

    const app = createTestApp({
      aiRateLimiter: {
        async checkAndRecord(userId, input, priority, type) {
          receivedInput = { input, priority, type, userId };
          return { id: "job-1" };
        },
      },
      notifier: {
        async notify(jobId) {
          notifiedJobId = jobId;
        },
      },
    });

    const response = await app.request("http://hone.test/api/v1/feedback", {
      body: JSON.stringify({
        difficulty: "hard",
        mesocyclusId: "m1",
        variety: "good",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(receivedInput).toEqual({
      input: {
        difficulty: "hard",
        mesocyclusId: "m1",
        type: "feedback",
        variety: "good",
      },
      priority: "FEEDBACK",
      type: "FEEDBACK",
      userId: "user-1",
    });
    expect(notifiedJobId).toBe("job-1");
  });

  it("returns a 400 when feedback cannot be queued", async () => {
    const app = createTestApp({
      aiRateLimiter: {
        async checkAndRecord() {
          throw new Error("Job already in progress");
        },
      },
    });

    const response = await app.request("http://hone.test/api/v1/feedback", {
      body: JSON.stringify({
        difficulty: "hard",
        mesocyclusId: "m1",
        variety: "good",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: 400,
      title: "Job already in progress",
    });
  });
});
