import { beforeEach, describe, expect, it } from "bun:test";

import type { ActivePlan, ActiveWorkout } from "$lib/api";

import { offlineStore } from "./offline-store";

function createPlan(overrides: Partial<ActivePlan> = {}): ActivePlan {
  return {
    completedSessions: 0,
    cycleCount: 4,
    equipmentPoolId: null,
    mesocyclusId: "meso-1",
    name: "Mesocyclus 1",
    sessionMinutes: 30,
    sessions: [],
    sessionsPerCycle: 3,
    totalSessions: 12,
    ...overrides,
  };
}

function createWorkout(): ActiveWorkout {
  return {
    exercises: [
      {
        completedSets: 0,
        durationSecs: null,
        exerciseId: "exercise-1",
        exerciseLogId: "exercise-log-1",
        imageAltText: "Person doing a squat",
        imageUrl: null,
        name: "Squat",
        position: 0,
        reps: 10,
        restSecs: 60,
        sets: 3,
        substitutedForExerciseId: null,
        substitutedForName: null,
      },
    ],
    mesocyclusId: "meso-1",
    sessionId: "session-1",
    status: "active_session",
    templateId: "template-1",
    templateLabel: "A",
    templateTitle: "Workout A",
  };
}

let testCounter = 0;

function nextUserId() {
  testCounter += 1;
  return `user-offline-store-${testCounter}`;
}

describe("OfflineStore", () => {
  beforeEach(async () => {
    await offlineStore.open();
  });

  it("queues a session creation pending op with the right shape", async () => {
    const userId = nextUserId();
    const exerciseLogs = [
      { exerciseId: "exercise-1", id: "exercise-log-1", position: 1 },
    ];

    await offlineStore.queueSessionCreate(
      "session-1",
      "template-1",
      exerciseLogs,
      userId,
    );

    const ops = await offlineStore.listPendingOps(userId);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      entityId: "session-1",
      entityType: "session",
      operation: "create",
      payload: {
        exerciseLogs,
        sessionId: "session-1",
        templateId: "template-1",
      },
      userId,
    });
  });

  it("caches and returns the active plan", async () => {
    const userId = nextUserId();
    const plan = createPlan();

    await offlineStore.cacheActivePlan(plan, userId);
    const cached = await offlineStore.getCachedActivePlan(userId);

    expect(cached?.data).toEqual(plan);
  });

  it("expires a cached plan older than 24h and deletes it", async () => {
    const userId = nextUserId();
    const staleUpdatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

    await offlineStore.activePlan.put({
      data: createPlan(),
      id: userId,
      updatedAt: staleUpdatedAt,
    });

    const cached = await offlineStore.getCachedActivePlan(userId);

    expect(cached).toBeUndefined();
    expect(await offlineStore.activePlan.get(userId)).toBeUndefined();
  });

  it("still returns a cached workout between 24h and 48h old", async () => {
    const userId = nextUserId();
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);

    await offlineStore.activeWorkout.put({
      data: createWorkout(),
      id: userId,
      updatedAt: thirtyHoursAgo,
    });

    const cached = await offlineStore.getCachedActiveWorkout(userId);

    expect(cached?.data).toEqual(createWorkout());
  });

  it("expires a cached workout older than 48h", async () => {
    const userId = nextUserId();
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

    await offlineStore.activeWorkout.put({
      data: createWorkout(),
      id: userId,
      updatedAt: fiftyHoursAgo,
    });

    const cached = await offlineStore.getCachedActiveWorkout(userId);

    expect(cached).toBeUndefined();
  });

  it("dedupes queued workout completions and clears the cached workout", async () => {
    const userId = nextUserId();

    await offlineStore.cacheActiveWorkout(createWorkout(), userId);

    await offlineStore.queueWorkoutCompletion("session-1", userId);
    await offlineStore.queueWorkoutCompletion("session-1", userId);

    const ops = await offlineStore.listPendingOps(userId);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      entityId: "session-1",
      entityType: "workout",
      operation: "complete",
      payload: { sessionId: "session-1" },
      userId,
    });

    expect(await offlineStore.getCachedActiveWorkout(userId)).toBeUndefined();
    expect(await offlineStore.getWorkoutActive(userId)).toBe(false);
  });

  it("does not delete pending ops when the workout cache expires past 48h", async () => {
    const userId = nextUserId();
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

    await offlineStore.queueSessionCreate(
      "session-1",
      "template-1",
      [{ exerciseId: "exercise-1", id: "exercise-log-1", position: 1 }],
      userId,
    );
    await offlineStore.activeWorkout.put({
      data: createWorkout(),
      id: userId,
      updatedAt: fiftyHoursAgo,
    });

    await offlineStore.getCachedActiveWorkout(userId);

    const remainingOps = await offlineStore.listPendingOps(userId);
    expect(remainingOps).toHaveLength(1);
  });
});
