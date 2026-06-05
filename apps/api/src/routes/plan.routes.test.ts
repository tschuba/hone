import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import type { ActivePlanResponse } from "./plan.routes";
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
    archiveActiveMesocyclus(userId: string): Promise<void>;
    createMesocyclus(input: {
      equipmentPoolId: string | null;
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
      sessionMinutes: number;
      userId: string;
    }): Promise<{ id: string }>;
    getActivePlan(userId: string): Promise<ActivePlanResponse | null>;
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

const defaultPlan: ActivePlanResponse = {
  completedSessions: 2,
  cycleCount: 4,
  equipmentPoolId: "pool-1",
  mesocyclusId: "meso-1",
  name: "4-cycle plan",
  sessionMinutes: 30,
  sessions: [
    {
      isNext: false,
      position: 1,
      exercises: [{ durationSecs: null, name: "Pull-up", reps: 8, sets: 3 }],
    },
    {
      isNext: false,
      position: 2,
      exercises: [
        { durationSecs: 60, name: "Plank", reps: null, sets: 3 },
      ],
    },
    {
      isNext: true,
      position: 3,
      exercises: [
        { durationSecs: null, name: "Squat", reps: 10, sets: 3 },
      ],
    },
  ],
  sessionsPerCycle: 3,
  totalSessions: 12,
};

const defaultStorage = {
  async archiveActiveMesocyclus() {},
  async createMesocyclus() {
    return { id: "meso-1" };
  },
  async getActivePlan() {
    return defaultPlan;
  },
  async getPlanContext() {
    return {
      constraints: { impactFilter: false },
      equipmentPool: { id: "pool-1", name: "Home", tags: ["bodyweight"] },
      goals: [],
    };
  },
};

const defaultRuleEngine = {
  async generate() {
    return {
      durationWeeks: 4,
      workouts: [
        {
          estimatedDurationMinutes: 30,
          exercises: [
            { exerciseId: "ex-a", position: 1, reps: 8, sets: 3 },
          ],
          label: "A" as const,
          position: 1,
        },
        {
          estimatedDurationMinutes: 30,
          exercises: [
            { exerciseId: "ex-b", position: 1, reps: 10, sets: 3 },
          ],
          label: "B" as const,
          position: 2,
        },
        {
          estimatedDurationMinutes: 30,
          exercises: [
            { exerciseId: "ex-c", position: 1, reps: 12, sets: 3 },
          ],
          label: "C" as const,
          position: 3,
        },
      ],
      workoutsPerWeek: 3,
    };
  },
};

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
          return defaultRuleEngine.generate();
        },
      },
      storage: defaultStorage,
    });

    const response = await app.request("http://hone.test/api/v1/plans", {
      body: JSON.stringify({ sessionMinutes: 30, cycleCount: 4 }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(generatedInput).toMatchObject({
      equipmentTags: ["bodyweight"],
      sessionMinutes: 30,
      userId: "user-1",
      weeksCount: 4,
    });
    expect(queuedInput).toMatchObject({
      currentWeek: 1,
      durationWeeks: 4,
      equipmentPoolId: "pool-1",
      equipmentTags: ["bodyweight"],
      mesocyclusId: "meso-1",
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
      ruleEngine: defaultRuleEngine,
      storage: {
        ...defaultStorage,
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

  describe("GET /active", () => {
    it("returns the active plan with isNext on the correct session", async () => {
      const app = createTestApp({
        aiRateLimiter: { async checkAndRecord() { return { id: "job-1" }; } },
        ruleEngine: defaultRuleEngine,
        storage: defaultStorage,
      });

      const response = await app.request(
        "http://hone.test/api/v1/plans/active",
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ActivePlanResponse;
      expect(body.mesocyclusId).toBe("meso-1");
      expect(body.cycleCount).toBe(4);
      expect(body.completedSessions).toBe(2);
      expect(body.totalSessions).toBe(12);
      const nextSessions = body.sessions.filter((s) => s.isNext);
      expect(nextSessions).toHaveLength(1);
      expect(nextSessions[0]?.position).toBe(3);
    });

    it("returns 404 when no active plan exists", async () => {
      const app = createTestApp({
        aiRateLimiter: { async checkAndRecord() { return { id: "job-1" }; } },
        ruleEngine: defaultRuleEngine,
        storage: {
          ...defaultStorage,
          async getActivePlan() {
            return null;
          },
        },
      });

      const response = await app.request(
        "http://hone.test/api/v1/plans/active",
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST / archive-on-regenerate", () => {
    it("archives any existing active mesocyclus before creating a new one", async () => {
      const calls: string[] = [];

      const app = createTestApp({
        aiRateLimiter: { async checkAndRecord() { return { id: "job-1" }; } },
        notifier: { async notify() {} },
        ruleEngine: defaultRuleEngine,
        storage: {
          ...defaultStorage,
          async archiveActiveMesocyclus(userId) {
            calls.push(`archive:${userId}`);
          },
          async createMesocyclus() {
            calls.push("create");
            return { id: "meso-new" };
          },
        },
      });

      const response = await app.request("http://hone.test/api/v1/plans", {
        body: JSON.stringify({ cycleCount: 3, sessionMinutes: 45 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      expect(response.status).toBe(201);
      expect(calls[0]).toBe("archive:user-1");
      expect(calls[1]).toBe("create");
    });
  });
});
