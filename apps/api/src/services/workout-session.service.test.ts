import { describe, expect, it } from "bun:test";
import { Prisma } from "@prisma/client";

import {
  WorkoutSessionService,
  type WorkoutSessionStore,
} from "./workout-session.service";

function createStore(tx: unknown): WorkoutSessionStore {
  return {
    async $transaction<T>(
      callback: Parameters<WorkoutSessionStore["$transaction"]>[0],
    ) {
      return callback(tx as never) as Promise<T>;
    },
  } as WorkoutSessionStore;
}

describe("WorkoutSessionService", () => {
  it("creates a session for a template owned by the user", async () => {
    const service = new WorkoutSessionService(
      createStore({
        workoutTemplate: {
          findFirst: async () => ({
            exercises: [
              { exerciseId: "exercise-1", position: 1 },
              { exerciseId: "exercise-2", position: 2 },
            ],
            id: "template-a",
            mesocyclus: { id: "meso-1" },
            mesocyclusId: "meso-1",
          }),
        },
        workoutSession: {
          create: async ({
            data,
          }: {
            data: {
              exerciseLogs: {
                create: Array<{ exerciseId: string; position: number }>;
              };
              templateId: string;
              userId: string;
            };
          }) => ({
            exerciseLogs: data.exerciseLogs.create.map(
              (exerciseLog, index) => ({
                exerciseId: exerciseLog.exerciseId,
                id: `exercise-log-${index + 1}`,
                position: exerciseLog.position,
              }),
            ),
            id: "session-start",
            status: "ACTIVE",
            templateId: data.templateId,
            userId: data.userId,
          }),
        },
      }),
    );

    const session = await service.createSession({
      templateId: "template-a",
      userId: "user-1",
    });

    expect(session).toMatchObject({
      exerciseLogs: [
        {
          exerciseId: "exercise-1",
          id: "exercise-log-1",
          position: 1,
        },
        {
          exerciseId: "exercise-2",
          id: "exercise-log-2",
          position: 2,
        },
      ],
      id: "session-start",
      status: "ACTIVE",
      templateId: "template-a",
      userId: "user-1",
    });
  });

  it("returns the existing session when a client-provided id collides (idempotent retry)", async () => {
    const existingSession = {
      exerciseLogs: [
        { exerciseId: "exercise-1", id: "exercise-log-1", position: 1 },
      ],
      id: "client-uuid-1",
      status: "ACTIVE",
      templateId: "template-a",
      userId: "user-1",
    };

    const service = new WorkoutSessionService(
      createStore({
        workoutSession: {
          create: async () => {
            throw new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed",
              { clientVersion: "6.8.2", code: "P2002" },
            );
          },
          findFirst: async () => existingSession,
        },
        workoutTemplate: {
          findFirst: async () => ({
            exercises: [{ exerciseId: "exercise-1", position: 1 }],
            id: "template-a",
            mesocyclus: { id: "meso-1" },
            mesocyclusId: "meso-1",
          }),
        },
      }),
    );

    const session = await service.createSession({
      id: "client-uuid-1",
      templateId: "template-a",
      userId: "user-1",
    });

    expect(session).toMatchObject(existingSession);
  });

  it("rejects exercise logs referencing an exercise the user cannot access", async () => {
    const service = new WorkoutSessionService(
      createStore({
        exercise: {
          findFirst: async () => null,
        },
        workoutTemplate: {
          findFirst: async () => ({
            exercises: [{ exerciseId: "exercise-1", position: 1 }],
            id: "template-a",
            mesocyclus: { id: "meso-1" },
            mesocyclusId: "meso-1",
          }),
        },
      }),
    );

    await expect(
      service.createSession({
        exerciseLogs: [
          { exerciseId: "other-users-exercise", id: "log-1", position: 1 },
        ],
        templateId: "template-a",
        userId: "user-1",
      }),
    ).rejects.toThrow("Exercise not found or not accessible");
  });

  it("creates a session using client-provided exercise log ids when ownership is validated", async () => {
    const service = new WorkoutSessionService(
      createStore({
        exercise: {
          findFirst: async () => ({ id: "exercise-1" }),
        },
        workoutSession: {
          create: async ({
            data,
          }: {
            data: {
              exerciseLogs: {
                create: Array<{
                  exerciseId: string;
                  id?: string;
                  position: number;
                }>;
              };
              id?: string;
              templateId: string;
              userId: string;
            };
          }) => ({
            exerciseLogs: data.exerciseLogs.create,
            id: data.id ?? "server-generated",
            status: "ACTIVE",
            templateId: data.templateId,
            userId: data.userId,
          }),
        },
        workoutTemplate: {
          findFirst: async () => ({
            exercises: [{ exerciseId: "exercise-1", position: 1 }],
            id: "template-a",
            mesocyclus: { id: "meso-1" },
            mesocyclusId: "meso-1",
          }),
        },
      }),
    );

    const session = await service.createSession({
      exerciseLogs: [
        { exerciseId: "exercise-1", id: "client-log-1", position: 1 },
      ],
      id: "client-session-1",
      templateId: "template-a",
      userId: "user-1",
    });

    expect(session).toMatchObject({
      exerciseLogs: [
        { exerciseId: "exercise-1", id: "client-log-1", position: 1 },
      ],
      id: "client-session-1",
    });
  });

  it("completes session and advances template atomically", async () => {
    const events: string[] = [];
    let updatedNextTemplateId: string | null = null;

    const service = new WorkoutSessionService(
      createStore({
        mesocyclus: {
          update: async ({
            data,
          }: { data: { nextTemplateId: string | null } }) => {
            events.push("advance");
            updatedNextTemplateId = data.nextTemplateId;
            return { id: "meso-1", nextTemplateId: data.nextTemplateId };
          },
        },
        workoutSession: {
          findFirst: async () => ({
            id: "session-1",
            mesocyclus: {
              id: "meso-1",
              nextTemplate: { id: "template-b" },
              nextTemplateId: "template-b",
              templates: [
                { id: "template-a", position: 1 },
                { id: "template-b", position: 2 },
                { id: "template-c", position: 3 },
              ],
            },
            templateId: "template-b",
            userId: "user-1",
          }),
          update: async () => {
            events.push("complete");
            return {
              completedAt: new Date("2026-05-19T12:00:00.000Z"),
              id: "session-1",
              status: "COMPLETED",
            };
          },
        },
      }),
    );

    events.push("begin");
    const session = await service.completeSession({
      sessionId: "session-1",
      userId: "user-1",
    });
    events.push("commit");

    expect(session.status).toBe("COMPLETED");
    expect(String(updatedNextTemplateId)).toBe("template-c");
    expect(events).toEqual(["begin", "complete", "advance", "commit"]);
  });

  it("rejects completion for a session outside the user scope", async () => {
    const service = new WorkoutSessionService(
      createStore({
        workoutSession: {
          findFirst: async () => null,
        },
      }),
    );

    await expect(
      service.completeSession({
        sessionId: "session-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("Session not found");
  });

  it("skip records an abandoned session and advances rotation", async () => {
    const events: string[] = [];
    let updatedNextTemplateId: string | null = null;

    const service = new WorkoutSessionService(
      createStore({
        mesocyclus: {
          findFirst: async () => ({
            id: "meso-1",
            nextTemplate: { id: "template-a" },
            nextTemplateId: "template-a",
            templates: [
              { id: "template-a", position: 1 },
              { id: "template-b", position: 2 },
            ],
          }),
          update: async ({
            data,
          }: { data: { nextTemplateId: string | null } }) => {
            events.push("advance");
            updatedNextTemplateId = data.nextTemplateId;
            return { id: "meso-1", nextTemplateId: data.nextTemplateId };
          },
        },
        workoutSession: {
          create: async () => {
            events.push("skip");
            return {
              id: "session-2",
              status: "ABANDONED",
            };
          },
        },
      }),
    );

    events.push("begin");
    const session = await service.skipSession({
      mesocyclusId: "meso-1",
      userId: "user-1",
    });
    events.push("commit");

    expect(session.status).toBe("ABANDONED");
    expect(String(updatedNextTemplateId)).toBe("template-b");
    expect(events).toEqual(["begin", "skip", "advance", "commit"]);
  });

  it("lists recent session history for the owning user", async () => {
    const service = new WorkoutSessionService(
      createStore({
        workoutSession: {
          findMany: async () => [
            {
              completedAt: new Date("2026-05-19T12:45:00.000Z"),
              id: "session-2",
              startedAt: new Date("2026-05-19T12:00:00.000Z"),
              status: "COMPLETED",
              templateId: "template-b",
            },
          ],
        },
      }),
    );

    const history = await service.listHistory("user-1");

    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe("session-2");
  });

  it("substitutes an exercise and preserves the original reference", async () => {
    const service = new WorkoutSessionService(
      createStore({
        exercise: {
          findMany: async () => [
            {
              id: "exercise-2",
              imageAltText: "Replacement push-up",
              imageUrl: null,
              isGlobal: true,
              nameDe: null,
              nameEn: "Incline Push-up",
              ownerId: null,
              tags: [
                {
                  tag: {
                    category: "EQUIPMENT",
                    value: "bodyweight",
                  },
                },
                {
                  tag: {
                    category: "MUSCLE_GROUP",
                    value: "push",
                  },
                },
              ],
            },
          ],
        },
        exerciseLog: {
          findFirst: async () => ({
            exercise: {
              id: "exercise-1",
              tags: [
                {
                  tag: {
                    category: "EQUIPMENT",
                    value: "bodyweight",
                  },
                },
                {
                  tag: {
                    category: "MUSCLE_GROUP",
                    value: "push",
                  },
                },
              ],
            },
            exerciseId: "exercise-1",
            id: "exercise-log-1",
            substitutedForExercise: null,
            substitutedForExerciseId: null,
            workoutSession: {
              id: "session-1",
            },
          }),
          update: async () => ({
            exercise: {
              imageAltText: "Replacement push-up",
              imageUrl: null,
              nameDe: null,
              nameEn: "Incline Push-up",
            },
            exerciseId: "exercise-2",
            id: "exercise-log-1",
            substitutedForExercise: {
              nameDe: null,
              nameEn: "Push-up",
            },
            substitutedForExerciseId: "exercise-1",
          }),
        },
      }),
    );

    const substituted = await service.substituteExercise({
      exerciseId: "exercise-2",
      exerciseLogId: "exercise-log-1",
      sessionId: "session-1",
      userId: "user-1",
    });

    expect(substituted).toEqual({
      exerciseId: "exercise-2",
      exerciseLogId: "exercise-log-1",
      imageAltText: "Replacement push-up",
      imageUrl: null,
      name: "Incline Push-up",
      substitutedForExerciseId: "exercise-1",
      substitutedForName: "Push-up",
    });
  });
});
