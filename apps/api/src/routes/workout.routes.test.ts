import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import {
  type WorkoutTodayResponse,
  createWorkoutRoutes,
} from "./workout.routes";

function createTestApp(storage: {
  findActiveSession(userId: string): Promise<WorkoutTodayResponse | null>;
  findPlannedWorkout(userId: string): Promise<WorkoutTodayResponse | null>;
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/workout",
    createWorkoutRoutes({
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

describe("workout routes", () => {
  it("returns the active workout session when one exists", async () => {
    const app = createTestApp({
      async findActiveSession() {
        return {
          exercises: [
            {
              completedSets: 1,
              durationSecs: null,
              exerciseId: "exercise-1",
              exerciseLogId: "exercise-log-1",
              imageAltText: "Push-up demonstration",
              imageUrl: null,
              name: "Push-up",
              position: 1,
              reps: 10,
              restSecs: 45,
              sets: 3,
              substitutedForExerciseId: null,
              substitutedForName: null,
            },
          ],
          mesocyclusId: "meso-1",
          sessionId: "session-1",
          status: "active_session",
          templateId: "template-a",
          templateLabel: "A",
          templateTitle: "Workout A",
        };
      },
      async findPlannedWorkout() {
        throw new Error("findPlannedWorkout should not be called");
      },
    });

    const response = await app.request("http://hone.test/api/v1/workout/today");

    expect(response.status).toBe(200);
    const body = (await response.json()) as Extract<
      WorkoutTodayResponse,
      { status: "active_session" }
    >;
    expect(body.status).toBe("active_session");
    expect(body.sessionId).toBe("session-1");
  });

  it("falls back to the next planned workout when no active session exists", async () => {
    const app = createTestApp({
      async findActiveSession() {
        return null;
      },
      async findPlannedWorkout() {
        return {
          exercises: [
            {
              completedSets: 0,
              durationSecs: null,
              exerciseId: "exercise-2",
              exerciseLogId: null,
              imageAltText: "Bodyweight squat demonstration",
              imageUrl: null,
              name: "Squat",
              position: 1,
              reps: 12,
              restSecs: 60,
              sets: 3,
              substitutedForExerciseId: null,
              substitutedForName: null,
            },
          ],
          mesocyclusId: "meso-1",
          sessionId: null,
          status: "planned",
          templateId: "template-b",
          templateLabel: "B",
          templateTitle: "Workout B",
        };
      },
    });

    const response = await app.request("http://hone.test/api/v1/workout/today");

    expect(response.status).toBe(200);
    const body = (await response.json()) as Extract<
      WorkoutTodayResponse,
      { status: "planned" }
    >;
    expect(body.status).toBe("planned");
    expect(body.templateId).toBe("template-b");
  });
});
