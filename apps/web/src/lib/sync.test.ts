import { describe, expect, it } from "bun:test";

import type { ActiveWorkout, SetPayload } from "$lib/api";

import {
  completeWorkoutWithOfflineFallback,
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
    userId: "user-1",
  };
}

function createPendingWorkoutCompletion() {
  return {
    createdAt: new Date("2026-05-20T08:05:00.000Z"),
    entityId: "session-1",
    entityType: "workout" as const,
    id: 2,
    operation: "complete" as const,
    payload: {
      sessionId: "session-1",
    },
    retryCount: 0,
    userId: "user-1",
  };
}

function createClient(
  overrides: Partial<{
    completeWorkoutSession(sessionId: string): Promise<unknown>;
    getActiveWorkout(): Promise<ActiveWorkout>;
    logSet(sessionId: string, set: SetPayload): Promise<unknown>;
    updateProfile(): Promise<unknown>;
  }> = {},
) {
  return {
    async completeWorkoutSession() {
      throw new Error("not used");
    },
    async getActiveWorkout() {
      throw new Error("not used");
    },
    async logSet() {
      throw new Error("not used");
    },
    async updateProfile() {
      throw new Error("not used");
    },
    ...overrides,
  };
}

function createStore(
  overrides: Partial<{
    applyQueuedSetToCachedWorkout(exerciseLogId: string, userId?: string): Promise<void>;
    cacheActiveWorkout(data: ActiveWorkout, userId?: string): Promise<void>;
    clearCurrentUserOfflineState(): Promise<void>;
    deletePendingOp(id: number): Promise<void>;
    getBlockedSyncReason(userId?: string): Promise<string | undefined>;
    getCachedActiveWorkout(userId?: string): Promise<
      | {
          data: ActiveWorkout;
          id: string;
          updatedAt: Date;
        }
      | undefined
    >;
    getCachedAuthUserId(): Promise<{ key: string; value: string } | undefined>;
    getLastSuccessfulReplayAt(userId?: string): Promise<string | undefined>;
    getOfflineStoreHealth(): Promise<"healthy" | "initialized" | "recovery">;
    getWorkoutActive(userId?: string): Promise<boolean>;
    listPendingOps(userId?: string): Promise<
      Array<{
        createdAt: Date;
        entityId: string;
        entityType: "profile" | "set" | "workout";
        id?: number;
        operation: "complete" | "create" | "delete" | "update";
        payload: Record<string, unknown>;
        retryCount: number;
        userId: string;
      }>
    >;
    listPendingOpsCount(userId?: string): Promise<number>;
    markWorkoutActive(value: boolean, userId?: string): Promise<void>;
    queueOp(input: Record<string, unknown>, userId?: string): Promise<number>;
    queueWorkoutCompletion(sessionId: string, userId?: string): Promise<number>;
    resetCurrentUserWorkoutState(): Promise<void>;
    setBlockedSyncReason(reason: string | null, userId?: string): Promise<void>;
    setCachedAuthUserId(userId: string): Promise<void>;
    setLastSuccessfulReplayAt(date: Date, userId?: string): Promise<void>;
    updatePendingOpRetryCount(id: number, retryCount: number): Promise<void>;
  }> = {},
) {
  return {
    async applyQueuedSetToCachedWorkout() {},
    async cacheActiveWorkout() {},
    async clearCurrentUserOfflineState() {},
    async deletePendingOp() {},
    async getBlockedSyncReason() {
      return undefined;
    },
    async getCachedActiveWorkout() {
      return undefined;
    },
    async getCachedAuthUserId() {
      return {
        key: "global:auth_user_id",
        value: "user-1",
      };
    },
    async getLastSuccessfulReplayAt() {
      return undefined;
    },
    async getOfflineStoreHealth() {
      return "healthy" as const;
    },
    async getWorkoutActive() {
      return false;
    },
    async listPendingOps() {
      return [];
    },
    async listPendingOpsCount() {
      return 0;
    },
    async markWorkoutActive() {},
    async queueOp() {
      return 1;
    },
    async queueWorkoutCompletion() {
      return 2;
    },
    async resetCurrentUserWorkoutState() {},
    async setBlockedSyncReason() {},
    async setCachedAuthUserId() {},
    async setLastSuccessfulReplayAt() {},
    async updatePendingOpRetryCount() {},
    ...overrides,
  };
}

describe("sync helpers", () => {
  it("falls back to cached workout data when the network is offline", async () => {
    const cachedWorkout = createCachedWorkout();

    const workout = await getTodayWorkout({
      client: createClient({
        async getActiveWorkout() {
          throw new TypeError("Failed to fetch");
        },
      }),
      store: createStore({
        async getCachedActiveWorkout() {
          return {
            data: cachedWorkout,
            id: "user-1",
            updatedAt: new Date(),
          };
        },
      }),
    });

    expect(workout).toEqual(cachedWorkout);
  });

  it("returns a friendly offline message when the backend is unavailable and nothing is cached", async () => {
    await expect(
      getTodayWorkout({
        client: createClient({
          async getActiveWorkout() {
            throw {
              status: 503,
              title: "Internal Server Error",
            };
          },
        }),
        store: createStore({
          async getCachedActiveWorkout() {
            return undefined;
          },
        }),
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
      client: createClient({
        async logSet() {
          throw new TypeError("Failed to fetch");
        },
      }),
      store: createStore({
        async applyQueuedSetToCachedWorkout(exerciseLogId) {
          updatedExerciseLogId = exerciseLogId;
        },
        async queueOp(input) {
          queuedPayload = input.payload as {
            sessionId: string;
            set: SetPayload;
          };
          return 1;
        },
      }),
    });

    expect(result).toEqual({ status: "queued" });
    expect(updatedExerciseLogId).toBe("exercise-log-1");
    expect(queuedPayload).toEqual({
      sessionId: "session-1",
      set,
    });
  });

  it("queues workout completion when offline", async () => {
    let queuedSessionId: string | undefined;

    const result = await completeWorkoutWithOfflineFallback("session-1", {
      client: createClient({
        async completeWorkoutSession() {
          throw new TypeError("Failed to fetch");
        },
      }),
      store: createStore({
        async queueWorkoutCompletion(sessionId) {
          queuedSessionId = sessionId;
          return 2;
        },
      }),
    });

    expect(result).toEqual({ status: "queued" });
    expect(queuedSessionId).toBe("session-1");
  });

  it("replays queued set operations before workout completion", async () => {
    const flushed: string[] = [];
    const deleted: number[] = [];
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    const result = await syncPendingOps({
      client: createClient({
        async completeWorkoutSession(sessionId) {
          flushed.push(`complete:${sessionId}`);
          return { completedAt: new Date(), id: sessionId, status: "COMPLETED" };
        },
        async logSet(sessionId, payload) {
          flushed.push(`set:${sessionId}:${payload.uuid}`);
          return {
            durationSecs: null,
            exerciseLogId: payload.exerciseLogId,
            id: "server-set-1",
            reps: payload.reps ?? null,
            setNr: payload.setNr,
            uuid: payload.uuid,
          };
        },
      }),
      store: createStore({
        async deletePendingOp(id) {
          deleted.push(id);
        },
        async listPendingOps() {
          return [createPendingWorkoutCompletion(), createPendingSet(set)];
        },
        async listPendingOpsCount() {
          return 0;
        },
      }),
    });

    expect(flushed).toEqual(["set:session-1:set-1", "complete:session-1"]);
    expect(deleted).toEqual([1, 2]);
    expect(result.status).toBe("synced");
  });

  it("blocks replay while the backend is unavailable", async () => {
    const deleted: number[] = [];
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    const result = await syncPendingOps({
      client: createClient({
        async logSet() {
          throw {
            status: 503,
            title: "Internal Server Error",
          };
        },
      }),
      store: createStore({
        async deletePendingOp(id) {
          deleted.push(id);
        },
        async listPendingOps() {
          return [createPendingSet(set)];
        },
        async listPendingOpsCount() {
          return 1;
        },
      }),
    });

    expect(result).toEqual({
      blockedReason: "blocked",
      pendingCount: 1,
      status: "blocked",
    });
    expect(deleted).toEqual([]);
  });

  it("reports storage recovery as a blocked sync state", async () => {
    const result = await syncPendingOps({
      client: createClient(),
      store: createStore({
        async getOfflineStoreHealth() {
          return "recovery";
        },
        async listPendingOpsCount() {
          return 3;
        },
      }),
    });

    expect(result).toEqual({
      blockedReason: "storage",
      pendingCount: 3,
      status: "blocked",
    });
  });

  // --- 5.1: User-scoped cache isolation and stale-workout expiry ---

  it("scopes pending op replay to the authenticated user id", async () => {
    // Verifies that listPendingOps receives the resolved user identity,
    // ensuring replay is isolated per user (user-scoped cache isolation).
    let replayedUserId: string | undefined;

    await getTodayWorkout({
      client: createClient({
        async getActiveWorkout() {
          return createCachedWorkout();
        },
      }),
      store: createStore({
        async getCachedAuthUserId() {
          return { key: "global:auth_user_id", value: "user-42" };
        },
        async listPendingOps(userId) {
          replayedUserId = userId;
          return [];
        },
      }),
    });

    expect(replayedUserId).toBe("user-42");
  });

  it("treats a missing cached workout as offline-unavailable (simulates stale expiry path)", async () => {
    await expect(
      getTodayWorkout({
        client: createClient({
          async getActiveWorkout() {
            throw new TypeError("Failed to fetch");
          },
        }),
        store: createStore({
          async getCachedActiveWorkout() {
            // Store returns undefined when the entry is absent or expired (>24 h)
            return undefined;
          },
        }),
      }),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  // --- 5.2: Terminal-path invalidation and auth-loss blocking ---

  it("resets user workout state after a queued completion op syncs", async () => {
    let resetCalled = false;

    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    await syncPendingOps({
      client: createClient({
        async completeWorkoutSession() {
          return { completedAt: new Date(), id: "session-1", status: "COMPLETED" };
        },
        async logSet(_sessionId, payload) {
          return {
            durationSecs: null,
            exerciseLogId: payload.exerciseLogId,
            id: "server-set-1",
            reps: payload.reps ?? null,
            setNr: payload.setNr,
            uuid: payload.uuid,
          };
        },
      }),
      store: createStore({
        async listPendingOps() {
          return [createPendingSet(set), createPendingWorkoutCompletion()];
        },
        async listPendingOpsCount() {
          return 0;
        },
        async resetCurrentUserWorkoutState() {
          resetCalled = true;
        },
      }),
    });

    expect(resetCalled).toBe(true);
  });

  it("blocks replay with reauthentication reason on 401 during a set flush", async () => {
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    let recordedReason: string | null | undefined;

    const result = await syncPendingOps({
      client: createClient({
        async logSet() {
          throw { status: 401, title: "Unauthorized" };
        },
      }),
      store: createStore({
        async listPendingOps() {
          return [createPendingSet(set)];
        },
        async listPendingOpsCount() {
          return 1;
        },
        async setBlockedSyncReason(reason) {
          recordedReason = reason;
        },
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("reauthentication");
    expect(recordedReason).toBe("reauthentication");
  });

  // --- 5.3: Conflict blocking ---

  it("blocks replay with conflict reason on 409 during a set flush", async () => {
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    let recordedReason: string | null | undefined;

    const result = await syncPendingOps({
      client: createClient({
        async logSet() {
          throw { status: 409, title: "Conflict" };
        },
      }),
      store: createStore({
        async listPendingOps() {
          return [createPendingSet(set)];
        },
        async listPendingOpsCount() {
          return 1;
        },
        async setBlockedSyncReason(reason) {
          recordedReason = reason;
        },
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("conflict");
    expect(recordedReason).toBe("conflict");
  });

  it("getTodayWorkout throws a sync-blocked error when replay is blocked by auth loss", async () => {
    const set: SetPayload = {
      exerciseLogId: "exercise-log-1",
      reps: 10,
      setNr: 1,
      uuid: "set-1",
    };

    await expect(
      getTodayWorkout({
        client: createClient({
          async logSet() {
            throw { status: 401, title: "Unauthorized" };
          },
          async getActiveWorkout() {
            return createCachedWorkout();
          },
        }),
        store: createStore({
          async listPendingOps() {
            return [createPendingSet(set)];
          },
          async listPendingOpsCount() {
            return 1;
          },
        }),
      }),
    ).rejects.toMatchObject({
      reason: "reauthentication",
      status: 409,
    });
  });
});
