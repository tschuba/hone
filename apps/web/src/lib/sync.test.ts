import { describe, expect, it } from "bun:test";

import type { ActiveWorkout, SetPayload } from "$lib/api";

import {
  getTodayWorkout,
  logSetWithOfflineFallback,
  syncPendingOps,
} from "./sync";

function createCachedWorkout(): ActiveWorkout {
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

function createPendingSet(set: SetPayload) {
  return {
    createdAt: new Date("2026-05-20T08:00:00.000Z"),
    entityId: set.uuid,
    entityType: "set" as const,
    id: 1,
    operation: "create" as const,
    payload: {
      sessionId: "session-1",
      set,
    },
    retryCount: 0,
  };
}

describe("sync helpers", () => {
  it("falls back to cached workout data when the network is offline", async () => {
    const cachedWorkout = createCachedWorkout();

    const workout = await getTodayWorkout({
      client: {
        async getActiveWorkout() {
          throw new TypeError("Failed to fetch");
        },
        async logSet() {
          throw new Error("not used");
        },
        async updateProfile() {
          throw new Error("not used");
        },
      },
      store: {
        async applyQueuedSetToCachedWorkout() {},
        async cacheActiveWorkout() {},
        async deletePendingOp() {},
        async getCachedActiveWorkout() {
          return {
            data: cachedWorkout,
            id: "today-workout",
            updatedAt: new Date(),
          };
        },
        async listPendingOps() {
          return [];
        },
        async markWorkoutActive() {},
        async queueOp() {
          return 1;
        },
        async updatePendingOpRetryCount() {},
      },
    });

    expect(workout).toEqual(cachedWorkout);
  });

  it("returns a friendly offline message when the backend is unavailable and nothing is cached", async () => {
    await expect(
      getTodayWorkout({
        client: {
          async getActiveWorkout() {
            throw {
              status: 500,
              title: "Internal Server Error",
            };
          },
          async logSet() {
            throw new Error("not used");
          },
          async updateProfile() {
            throw new Error("not used");
          },
        },
        store: {
          async applyQueuedSetToCachedWorkout() {},
          async cacheActiveWorkout() {},
          async deletePendingOp() {},
          async getCachedActiveWorkout() {
            return undefined;
          },
          async listPendingOps() {
            return [];
          },
          async markWorkoutActive() {},
          async queueOp() {
            return 1;
          },
          async updatePendingOpRetryCount() {},
        },
      }),
    ).rejects.toEqual({
      status: 503,
      title:
        "Offline data is not available yet. Open the app once while online to cache your workout.",
    });
  });

  it("queues a set and updates the cached workout when offline", async () => {
    let queuedPayload:
      | {
          sessionId: string;
          set: SetPayload;
        }
      | undefined;
    let updatedExerciseLogId: string | undefined;

    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    const result = await logSetWithOfflineFallback("session-1", set, {
      client: {
        async getActiveWorkout() {
          throw new Error("not used");
        },
        async logSet() {
          throw new TypeError("Failed to fetch");
        },
        async updateProfile() {
          throw new Error("not used");
        },
      },
      store: {
        async applyQueuedSetToCachedWorkout(exerciseLogId) {
          updatedExerciseLogId = exerciseLogId;
        },
        async cacheActiveWorkout() {},
        async deletePendingOp() {},
        async getCachedActiveWorkout() {
          return undefined;
        },
        async listPendingOps() {
          return [];
        },
        async markWorkoutActive() {},
        async queueOp(input) {
          queuedPayload = input.payload as {
            sessionId: string;
            set: SetPayload;
          };
          return 1;
        },
        async updatePendingOpRetryCount() {},
      },
    });

    expect(result).toEqual({ status: "queued" });
    expect(updatedExerciseLogId).toBe("exercise-log-1");
    expect(queuedPayload).toEqual({
      sessionId: "session-1",
      set,
    });
  });

  it("flushes queued set operations in created order", async () => {
    const flushed: string[] = [];
    const deleted: number[] = [];
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    await syncPendingOps({
      client: {
        async getActiveWorkout() {
          throw new Error("not used");
        },
        async logSet(sessionId, payload) {
          flushed.push(`${sessionId}:${payload.uuid}`);
          return {
            durationSecs: null,
            exerciseLogId: payload.exerciseLogId,
            id: "server-set-1",
            reps: payload.reps ?? null,
            setNr: payload.setNr,
            uuid: payload.uuid,
          };
        },
        async updateProfile() {
          throw new Error("not used");
        },
      },
      store: {
        async applyQueuedSetToCachedWorkout() {},
        async cacheActiveWorkout() {},
        async deletePendingOp(id) {
          deleted.push(id);
        },
        async getCachedActiveWorkout() {
          return undefined;
        },
        async listPendingOps() {
          return [createPendingSet(set)];
        },
        async markWorkoutActive() {},
        async queueOp() {
          return 1;
        },
        async updatePendingOpRetryCount() {},
      },
    });

    expect(flushed).toEqual(["session-1:set-1"]);
    expect(deleted).toEqual([1]);
  });

  it("does not consume retries while the backend is unavailable", async () => {
    const deleted: number[] = [];
    const updatedRetries: Array<{ id: number; retryCount: number }> = [];
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    await syncPendingOps({
      client: {
        async getActiveWorkout() {
          throw new Error("not used");
        },
        async logSet() {
          throw {
            status: 500,
            title: "Internal Server Error",
          };
        },
        async updateProfile() {
          throw new Error("not used");
        },
      },
      store: {
        async applyQueuedSetToCachedWorkout() {},
        async cacheActiveWorkout() {},
        async deletePendingOp(id) {
          deleted.push(id);
        },
        async getCachedActiveWorkout() {
          return undefined;
        },
        async listPendingOps() {
          return [createPendingSet(set)];
        },
        async markWorkoutActive() {},
        async queueOp() {
          return 1;
        },
        async updatePendingOpRetryCount(id, retryCount) {
          updatedRetries.push({ id, retryCount });
        },
      },
    });

    expect(deleted).toEqual([]);
    expect(updatedRetries).toEqual([]);
  });
});
