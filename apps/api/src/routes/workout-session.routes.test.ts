import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createWorkoutSessionRoutes } from "./workout-session.routes";

function createTestApp(service: {
  completeSession(input: { sessionId: string; userId: string }): Promise<{
    completedAt: Date;
    id: string;
    status: string;
  }>;
  createSession(input: {
    exerciseLogs?: Array<{ exerciseId: string; id: string; position: number }>;
    id?: string;
    templateId: string;
    userId: string;
  }): Promise<{
    exerciseLogs: Array<{
      exerciseId: string;
      id: string;
      position: number;
    }>;
    id: string;
    status: string;
    templateId: string | null;
  }>;
  listHistory(userId: string): Promise<
    Array<{
      completedAt: Date | null;
      id: string;
      startedAt: Date;
      status: string;
      templateId: string | null;
    }>
  >;
  listExerciseSubstitutions(input: {
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }): Promise<
    Array<{
      id: string;
      imageAltText: string;
      imageUrl: string | null;
      name: string;
      tags: string[];
    }>
  >;
  skipSession(input: { mesocyclusId: string; userId: string }): Promise<{
    id: string;
    status: string;
  }>;
  substituteExercise(input: {
    exerciseId: string;
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }): Promise<{
    exerciseId: string;
    exerciseLogId: string;
    imageAltText: string;
    imageUrl: string | null;
    name: string;
    substitutedForExerciseId: string | null;
    substitutedForName: string | null;
  }>;
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/workout-sessions",
    createWorkoutSessionRoutes({
      authGuard: async (c, next) => {
        c.set("sessionId", "session-1");
        c.set("userId", "user-1");
        await next();
      },
      service,
    }),
  );

  return app;
}

describe("workout session routes", () => {
  it("completes the session for the authenticated user", async () => {
    let receivedInput:
      | {
          sessionId: string;
          userId: string;
        }
      | undefined;

    const app = createTestApp({
      async completeSession(input) {
        receivedInput = input;
        return {
          completedAt: new Date("2026-05-19T12:00:00.000Z"),
          id: input.sessionId,
          status: "COMPLETED",
        };
      },
      async createSession() {
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise() {
        return {
          exerciseId: "exercise-2",
          exerciseLogId: "exercise-log-1",
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/complete",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(receivedInput).toEqual({
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("returns 404 when the session does not belong to the authenticated user", async () => {
    const app = createTestApp({
      async completeSession() {
        throw new Error("Session not found");
      },
      async createSession() {
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise() {
        return {
          exerciseId: "exercise-2",
          exerciseLogId: "exercise-log-1",
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/complete",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(404);
  });

  it("skip records an abandoned session and advances rotation", async () => {
    let receivedInput:
      | {
          mesocyclusId: string;
          userId: string;
        }
      | undefined;

    const app = createTestApp({
      async completeSession() {
        return {
          completedAt: new Date("2026-05-19T12:00:00.000Z"),
          id: "session-1",
          status: "COMPLETED",
        };
      },
      async createSession() {
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession(input) {
        receivedInput = input;
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise() {
        return {
          exerciseId: "exercise-2",
          exerciseLogId: "exercise-log-1",
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/skip",
      {
        body: JSON.stringify({ mesocyclusId: "meso-1" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(receivedInput).toEqual({
      mesocyclusId: "meso-1",
      userId: "user-1",
    });
  });

  it("starts a session for a template owned by the user", async () => {
    const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";
    let receivedInput:
      | {
          exerciseLogs?: Array<{
            exerciseId: string;
            id: string;
            position: number;
          }>;
          id?: string;
          templateId: string;
          userId: string;
        }
      | undefined;

    const app = createTestApp({
      async completeSession() {
        return {
          completedAt: new Date("2026-05-19T12:00:00.000Z"),
          id: "session-1",
          status: "COMPLETED",
        };
      },
      async createSession(input) {
        receivedInput = input;
        return {
          exerciseLogs: [
            {
              exerciseId: "exercise-1",
              id: "exercise-log-1",
              position: 1,
            },
          ],
          id: "session-start",
          status: "ACTIVE",
          templateId: TEMPLATE_UUID,
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise() {
        return {
          exerciseId: "exercise-2",
          exerciseLogId: "exercise-log-1",
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions",
      {
        body: JSON.stringify({ templateId: TEMPLATE_UUID }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(201);
    expect(receivedInput).toMatchObject({
      templateId: TEMPLATE_UUID,
      userId: "user-1",
    });

    const body = (await response.json()) as {
      exerciseLogs: Array<{
        exerciseId: string;
        id: string;
        position: number;
      }>;
    };
    expect(body.exerciseLogs).toEqual([
      {
        exerciseId: "exercise-1",
        id: "exercise-log-1",
        position: 1,
      },
    ]);
  });

  it("rejects starting a session with a non-UUID templateId before calling the service", async () => {
    let createSessionCalled = false;

    const app = createTestApp({
      async completeSession() {
        throw new Error("not used");
      },
      async createSession() {
        createSessionCalled = true;
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        throw new Error("not used");
      },
      async substituteExercise() {
        throw new Error("not used");
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions",
      {
        body: JSON.stringify({ templateId: "not-a-uuid" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
    expect(createSessionCalled).toBe(false);
  });

  it("rejects starting a session with a non-UUID client-provided session id", async () => {
    const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";
    let createSessionCalled = false;

    const app = createTestApp({
      async completeSession() {
        throw new Error("not used");
      },
      async createSession() {
        createSessionCalled = true;
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: TEMPLATE_UUID,
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        throw new Error("not used");
      },
      async substituteExercise() {
        throw new Error("not used");
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions",
      {
        body: JSON.stringify({ id: "not-a-uuid", templateId: TEMPLATE_UUID }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
    expect(createSessionCalled).toBe(false);
  });

  it("rejects starting a session with a non-UUID exercise log id", async () => {
    const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";
    const EXERCISE_UUID = "22222222-2222-2222-2222-222222222222";
    let createSessionCalled = false;

    const app = createTestApp({
      async completeSession() {
        throw new Error("not used");
      },
      async createSession() {
        createSessionCalled = true;
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: TEMPLATE_UUID,
        };
      },
      async listHistory() {
        return [];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        throw new Error("not used");
      },
      async substituteExercise() {
        throw new Error("not used");
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions",
      {
        body: JSON.stringify({
          exerciseLogs: [
            { exerciseId: EXERCISE_UUID, id: "not-a-uuid", position: 1 },
          ],
          templateId: TEMPLATE_UUID,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
    expect(createSessionCalled).toBe(false);
  });

  it("lists session history for the owning user", async () => {
    let receivedUserId: string | undefined;

    const app = createTestApp({
      async completeSession() {
        return {
          completedAt: new Date("2026-05-19T12:00:00.000Z"),
          id: "session-1",
          status: "COMPLETED",
        };
      },
      async createSession() {
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listHistory(userId) {
        receivedUserId = userId;
        return [
          {
            completedAt: new Date("2026-05-19T12:45:00.000Z"),
            id: "session-2",
            startedAt: new Date("2026-05-19T12:00:00.000Z"),
            status: "COMPLETED",
            templateId: "template-b",
          },
        ];
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async skipSession() {
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise() {
        return {
          exerciseId: "exercise-2",
          exerciseLogId: "exercise-log-1",
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    expect(receivedUserId).toBe("user-1");

    const body = (await response.json()) as {
      items: Array<{
        id: string;
      }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("session-2");
  });

  it("lists substitution candidates for the current exercise", async () => {
    let receivedInput:
      | {
          exerciseLogId: string;
          sessionId: string;
          userId: string;
        }
      | undefined;

    const app = createTestApp({
      async completeSession() {
        return {
          completedAt: new Date("2026-05-19T12:00:00.000Z"),
          id: "session-1",
          status: "COMPLETED",
        };
      },
      async createSession() {
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listExerciseSubstitutions(input) {
        receivedInput = input;
        return [
          {
            id: "exercise-2",
            imageAltText: "Alt text",
            imageUrl: null,
            name: "Replacement",
            tags: ["bodyweight", "push"],
          },
        ];
      },
      async listHistory() {
        return [];
      },
      async skipSession() {
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise() {
        return {
          exerciseId: "exercise-2",
          exerciseLogId: "exercise-log-1",
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/exercises/exercise-log-1/substitutions",
    );

    expect(response.status).toBe(200);
    expect(receivedInput).toEqual({
      exerciseLogId: "exercise-log-1",
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("substitutes the current exercise within the active session", async () => {
    let receivedInput:
      | {
          exerciseId: string;
          exerciseLogId: string;
          sessionId: string;
          userId: string;
        }
      | undefined;

    const app = createTestApp({
      async completeSession() {
        return {
          completedAt: new Date("2026-05-19T12:00:00.000Z"),
          id: "session-1",
          status: "COMPLETED",
        };
      },
      async createSession() {
        return {
          exerciseLogs: [],
          id: "session-start",
          status: "ACTIVE",
          templateId: "template-a",
        };
      },
      async listExerciseSubstitutions() {
        return [];
      },
      async listHistory() {
        return [];
      },
      async skipSession() {
        return {
          id: "session-skip",
          status: "ABANDONED",
        };
      },
      async substituteExercise(input) {
        receivedInput = input;
        return {
          exerciseId: input.exerciseId,
          exerciseLogId: input.exerciseLogId,
          imageAltText: "Alt text",
          imageUrl: null,
          name: "Replacement",
          substitutedForExerciseId: "exercise-1",
          substitutedForName: "Original",
        };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/workout-sessions/session-1/exercises/exercise-log-1/substitute",
      {
        body: JSON.stringify({ exerciseId: "exercise-2" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(receivedInput).toEqual({
      exerciseId: "exercise-2",
      exerciseLogId: "exercise-log-1",
      sessionId: "session-1",
      userId: "user-1",
    });
  });
});
