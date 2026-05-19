import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createPlanRoutes } from "./plan.routes";

function createTestApp(options: {
  aiRateLimiter: {
    checkAndRecord(userId: string, input?: unknown): Promise<{ id: string }>;
  };
  notifier?: {
    notify(jobId: string): Promise<void>;
  };
  ruleEngine: {
    generate(input: {
      equipmentTags: string[];
      excludeModifiers?: string[];
      sessionMinutes: number;
      userId: string;
      weeksCount: number;
    }): Promise<{
      durationWeeks: number;
      workouts: Array<{
        estimatedDurationMinutes: number;
        exercises: Array<{
          durationSecs?: number;
          exerciseId: string;
          position: number;
          reps?: number;
          restSecsOverride?: number;
          sets: number;
        }>;
        label: "A" | "B" | "C";
        position: number;
      }>;
      workoutsPerWeek: number;
    }>;
  };
  storage: {
    createMesocyclus(input: {
      plan: {
        durationWeeks: number;
        workouts: Array<{
          estimatedDurationMinutes: number;
          exercises: Array<{
            durationSecs?: number;
            exerciseId: string;
            position: number;
            reps?: number;
            restSecsOverride?: number;
            sets: number;
          }>;
          label: "A" | "B" | "C";
          position: number;
        }>;
        workoutsPerWeek: number;
      };
      userId: string;
    }): Promise<{ id: string }>;
    getPlanContext(input: {
      equipmentPoolId?: string;
      userId: string;
    }): Promise<{
      constraints: { impactFilter: boolean };
      equipmentPool: { id: string; name: string; tags: string[] };
      goals: Array<{ scope: "profile"; value: string }>;
    } | null>;
  };
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/plans",
    createPlanRoutes({
      aiRateLimiter: options.aiRateLimiter,
      authGuard: async (c, next) => {
        c.set("sessionId", "session-1");
        c.set("userId", "user-1");
        await next();
      },
      notifier: options.notifier,
      ruleEngine: options.ruleEngine,
      storage: options.storage,
    }),
  );

  return app;
}

describe("plan routes", () => {
  it("creates a rule-based mesocyclus and queues an ai job", async () => {
    let generatedInput:
      | {
          equipmentTags: string[];
          excludeModifiers?: string[];
          sessionMinutes: number;
          userId: string;
          weeksCount: number;
        }
      | undefined;
    let queuedInput: unknown;
    let notifiedJobId: string | undefined;

    const app = createTestApp({
      aiRateLimiter: {
        async checkAndRecord(_userId, input) {
          queuedInput = input;
          return { id: "job-1" };
        },
      },
      notifier: {
        async notify(jobId) {
          notifiedJobId = jobId;
        },
      },
      ruleEngine: {
        async generate(input) {
          generatedInput = input;
          return {
            durationWeeks: 4,
            workouts: [
              {
                estimatedDurationMinutes: 30,
                exercises: [
                  {
                    durationSecs: 180,
                    exerciseId: "warmup-a",
                    position: 1,
                    sets: 1,
                  },
                  {
                    exerciseId: "main-a",
                    position: 2,
                    reps: 10,
                    sets: 3,
                  },
                ],
                label: "A",
                position: 1,
              },
              {
                estimatedDurationMinutes: 30,
                exercises: [
                  {
                    durationSecs: 180,
                    exerciseId: "warmup-b",
                    position: 1,
                    sets: 1,
                  },
                  {
                    exerciseId: "main-b",
                    position: 2,
                    reps: 10,
                    sets: 3,
                  },
                ],
                label: "B",
                position: 2,
              },
              {
                estimatedDurationMinutes: 30,
                exercises: [
                  {
                    durationSecs: 180,
                    exerciseId: "warmup-c",
                    position: 1,
                    sets: 1,
                  },
                  {
                    exerciseId: "main-c",
                    position: 2,
                    reps: 10,
                    sets: 3,
                  },
                ],
                label: "C",
                position: 3,
              },
            ],
            workoutsPerWeek: 3,
          };
        },
      },
      storage: {
        async createMesocyclus() {
          return { id: "meso-1" };
        },
        async getPlanContext() {
          return {
            constraints: { impactFilter: true },
            equipmentPool: {
              id: "pool-1",
              name: "Home",
              tags: ["bodyweight"],
            },
            goals: [{ scope: "profile", value: "Build consistency" }],
          };
        },
      },
    });

    const response = await app.request("http://hone.test/api/v1/plans", {
      body: JSON.stringify({ sessionMinutes: 30, weeksCount: 4 }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(generatedInput).toEqual({
      equipmentTags: ["bodyweight"],
      excludeModifiers: ["back_load", "knee_load"],
      sessionMinutes: 30,
      userId: "user-1",
      weeksCount: 4,
    });
    expect(queuedInput).toEqual({
      currentWeek: 1,
      durationWeeks: 4,
      equipmentPoolId: "pool-1",
      equipmentTags: ["bodyweight"],
      excludeModifiers: ["back_load", "knee_load"],
      mesocyclusId: "meso-1",
      profile: {
        constraints: { impactFilter: true },
        goals: [{ scope: "profile", value: "Build consistency" }],
      },
      sessionMinutes: 30,
      type: "mesocyclus",
    });
    expect(notifiedJobId).toBe("job-1");
    expect(await response.json()).toEqual({
      jobId: "job-1",
      mesocyclusId: "meso-1",
      planSource: "rule_based",
      status: "queued",
    });
  });

  it("returns 404 when no equipment pool is available", async () => {
    const app = createTestApp({
      aiRateLimiter: {
        async checkAndRecord() {
          return { id: "job-1" };
        },
      },
      ruleEngine: {
        async generate() {
          throw new Error("generate should not be called");
        },
      },
      storage: {
        async createMesocyclus() {
          throw new Error("createMesocyclus should not be called");
        },
        async getPlanContext() {
          return null;
        },
      },
    });

    const response = await app.request("http://hone.test/api/v1/plans", {
      body: JSON.stringify({}),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(404);
  });
});