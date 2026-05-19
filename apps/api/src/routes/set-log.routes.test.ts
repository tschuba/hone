import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createSetLogRoutes } from "./set-log.routes";

function createTestApp(storage: {
  findOpenSession(input: {
    sessionId: string;
    userId: string;
  }): Promise<{ id: string } | null>;
  findSessionExerciseLog(input: {
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }): Promise<{ id: string } | null>;
  upsertSet(input: {
    durationSecs?: number;
    exerciseLogId: string;
    reps?: number;
    setNr: number;
    uuid: string;
  }): Promise<{
    durationSecs: number | null;
    exerciseLogId: string;
    id: string;
    reps: number | null;
    setNr: number;
    uuid: string;
  }>;
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/workout-sessions",
    createSetLogRoutes({
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

describe("set log routes", () => {
  it("returns 200 on duplicate UUID (idempotent)", async () => {
    const storedSets = new Map<
      string,
      {
        durationSecs: number | null;
        exerciseLogId: string;
        id: string;
        reps: number | null;
        setNr: number;
        uuid: string;
      }
    >();
    const app = createTestApp({
      async findOpenSession() {
        return { id: "session-1" };
      },
      async findSessionExerciseLog() {
        return { id: "exercise-log-1" };
      },
      async upsertSet(input) {
        const existing = storedSets.get(input.uuid);

        if (existing) {
          return existing;
        }

        const created = {
          durationSecs: input.durationSecs ?? null,
          exerciseLogId: input.exerciseLogId,
          id: "set-1",
          reps: input.reps ?? null,
          setNr: input.setNr,
          uuid: input.uuid,
        };
        storedSets.set(input.uuid, created);
        return created;
      },
    });

    const payload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "uuid-1",
    };

    const firstResponse = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/sets",
      {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    const secondResponse = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/sets",
      {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual(await firstResponse.json());
  });

  it("returns 404 when the session is owned by another user", async () => {
    const app = createTestApp({
      async findOpenSession() {
        return null;
      },
      async findSessionExerciseLog() {
        throw new Error("findSessionExerciseLog should not be called");
      },
      async upsertSet() {
        throw new Error("upsertSet should not be called");
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/sets",
      {
        body: JSON.stringify({
          exerciseLogId: "exercise-log-1",
          reps: 10,
          setNr: 1,
          uuid: "uuid-1",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the exercise log does not belong to the active session", async () => {
    const app = createTestApp({
      async findOpenSession() {
        return { id: "session-1" };
      },
      async findSessionExerciseLog() {
        return null;
      },
      async upsertSet() {
        throw new Error("upsertSet should not be called");
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/sets",
      {
        body: JSON.stringify({
          exerciseLogId: "exercise-log-999",
          reps: 10,
          setNr: 1,
          uuid: "uuid-1",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(404);
  });
});
