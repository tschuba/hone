import {
  type ActiveWorkout,
  type SetPayload,
  type UserProfile,
  api,
} from "$lib/api";
import {
  type OfflineStore,
  type OfflineStoreHealthStatus,
  type PendingOp,
  type SyncBlockedReason,
  offlineStore,
} from "$lib/db/offline-store";
import {
  createOfflineUnavailableError,
  createStorageRecoveryError,
  createSyncBlockedError,
  getErrorStatus,
  isBackendUnavailableError,
} from "$lib/network-errors";

type SyncApi = Pick<
  typeof api,
  | "completeWorkoutSession"
  | "getActiveWorkout"
  | "logSet"
  | "updateProfile"
>;

type SyncStore = Pick<
  OfflineStore,
  | "applyQueuedSetToCachedWorkout"
  | "cacheActiveWorkout"
  | "clearCurrentUserOfflineState"
  | "deletePendingOp"
  | "getBlockedSyncReason"
  | "getCachedActiveWorkout"
  | "getCachedAuthUserId"
  | "getLastSuccessfulReplayAt"
  | "getOfflineStoreHealth"
  | "getWorkoutActive"
  | "listPendingOps"
  | "listPendingOpsCount"
  | "markWorkoutActive"
  | "queueOp"
  | "queueWorkoutCompletion"
  | "resetCurrentUserWorkoutState"
  | "setBlockedSyncReason"
  | "setLastSuccessfulReplayAt"
>;

type SetSyncPayload = {
  sessionId: string;
  set: SetPayload;
};

type PendingSyncResult = { status: "queued" } | { status: "synced" };
type SyncReplayResult = {
  blockedReason?: SyncBlockedReason;
  lastSuccessfulReplayAt?: string;
  pendingCount: number;
  status: "blocked" | "synced";
};

type SyncStatus = {
  blockedReason?: SyncBlockedReason;
  lastSuccessfulReplayAt?: string;
  pendingCount: number;
  storageStatus?: OfflineStoreHealthStatus;
  workoutActive: boolean;
};

const pendingReplayRuns = new Map<string, Promise<SyncReplayResult>>();

export { isBackendUnavailableError as isOfflineError };

export async function getSyncStatus(
  options: {
    store?: SyncStore;
  } = {},
): Promise<SyncStatus> {
  const store = options.store ?? offlineStore;
  const cachedAuthUserId = await store.getCachedAuthUserId();

  if (!cachedAuthUserId?.value) {
    return {
      pendingCount: 0,
      storageStatus: await store.getOfflineStoreHealth(),
      workoutActive: false,
    };
  }

  return {
    blockedReason: await store.getBlockedSyncReason(cachedAuthUserId.value),
    lastSuccessfulReplayAt: await store.getLastSuccessfulReplayAt(
      cachedAuthUserId.value,
    ),
    pendingCount: await store.listPendingOpsCount(cachedAuthUserId.value),
    storageStatus: await store.getOfflineStoreHealth(),
    workoutActive: await store.getWorkoutActive(cachedAuthUserId.value),
  };
}

function isSetSyncPayload(payload: unknown): payload is SetSyncPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as {
    sessionId?: unknown;
    set?: {
      exerciseLogId?: unknown;
      setNr?: unknown;
      uuid?: unknown;
    } | null;
  };

  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.set === "object" &&
    candidate.set !== null &&
    typeof candidate.set.exerciseLogId === "string" &&
    typeof candidate.set.setNr === "number" &&
    typeof candidate.set.uuid === "string"
  );
}

async function cacheTodayWorkout(
  workout: ActiveWorkout,
  store: SyncStore = offlineStore,
) {
  await store.cacheActiveWorkout(workout);
}

async function flushOp(
  op: PendingOp,
  client: SyncApi,
  store: SyncStore,
): Promise<{ terminal: boolean }> {
  if (op.entityType === "set" && op.operation === "create") {
    if (!isSetSyncPayload(op.payload)) {
      throw new Error("Invalid queued set payload");
    }

    await client.logSet(op.payload.sessionId, op.payload.set);
    await store.applyQueuedSetToCachedWorkout(
      op.payload.set.exerciseLogId,
      op.userId,
    );
    return { terminal: false };
  }

  if (op.entityType === "workout" && op.operation === "complete") {
    const sessionId = op.payload.sessionId;

    if (typeof sessionId !== "string") {
      throw new Error("Invalid queued workout completion payload");
    }

    await client.completeWorkoutSession(sessionId);
    return { terminal: true };
  }

  if (op.entityType === "profile" && op.operation === "update") {
    await client.updateProfile(op.payload as unknown as UserProfile);
    return { terminal: false };
  }

  throw new Error(
    `Unsupported pending operation: ${op.entityType}:${op.operation}`,
  );
}

function getBlockedReasonFromError(error: unknown): SyncBlockedReason {
  const status = getErrorStatus(error);

  if (status === 401 || status === 403) {
    return "reauthentication";
  }

  if (status === 409 || status === 422 || status === 423) {
    return "conflict";
  }

  return "blocked";
}

async function replayPendingOpsOnce(
  client: SyncApi,
  store: SyncStore,
  userId: string,
): Promise<SyncReplayResult> {
  const ops = await store.listPendingOps(userId);

  if (ops.length === 0) {
    await store.setBlockedSyncReason(null, userId);

    return {
      lastSuccessfulReplayAt: await store.getLastSuccessfulReplayAt(userId),
      pendingCount: 0,
      status: "synced",
    };
  }

  const orderedOps = [
    ...ops.filter((op) => op.entityType === "set"),
    ...ops.filter((op) => op.entityType === "workout"),
    ...ops.filter(
      (op) => op.entityType !== "set" && op.entityType !== "workout",
    ),
  ];

  for (const op of orderedOps) {
    if (typeof op.id !== "number") {
      continue;
    }

    try {
      const result = await flushOp(op, client, store);

      await store.deletePendingOp(op.id);

      if (result.terminal) {
        await store.resetCurrentUserWorkoutState();
        await store.setBlockedSyncReason(null, userId);
        await store.setLastSuccessfulReplayAt(new Date(), userId);

        return {
          lastSuccessfulReplayAt: await store.getLastSuccessfulReplayAt(userId),
          pendingCount: await store.listPendingOpsCount(userId),
          status: "synced",
        };
      }
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        await store.setBlockedSyncReason("blocked", userId);

        return {
          blockedReason: "blocked",
          lastSuccessfulReplayAt: await store.getLastSuccessfulReplayAt(userId),
          pendingCount: await store.listPendingOpsCount(userId),
          status: "blocked",
        };
      }

      const blockedReason = getBlockedReasonFromError(error);
      await store.setBlockedSyncReason(blockedReason, userId);

      return {
        blockedReason,
        lastSuccessfulReplayAt: await store.getLastSuccessfulReplayAt(userId),
        pendingCount: await store.listPendingOpsCount(userId),
        status: "blocked",
      };
    }
  }

  await store.setBlockedSyncReason(null, userId);
  await store.setLastSuccessfulReplayAt(new Date(), userId);

  return {
    lastSuccessfulReplayAt: await store.getLastSuccessfulReplayAt(userId),
    pendingCount: await store.listPendingOpsCount(userId),
    status: "synced",
  };
}

async function syncPendingOpsForUser(
  client: SyncApi,
  store: SyncStore,
  userId: string,
) {
  const existingRun = pendingReplayRuns.get(userId);

  if (existingRun) {
    return existingRun;
  }

  const run = replayPendingOpsOnce(client, store, userId).finally(() => {
    pendingReplayRuns.delete(userId);
  });

  pendingReplayRuns.set(userId, run);

  return run;
}

export async function getTodayWorkout(
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
) {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;
  const authUserId = await store.getCachedAuthUserId();

  if (authUserId?.value) {
    const replayResult = await syncPendingOpsForUser(
      client,
      store,
      authUserId.value,
    );

    if (replayResult.status === "blocked") {
      if (replayResult.blockedReason === "storage") {
        throw createStorageRecoveryError(
          "Offline storage was reset or is unavailable. Reconnect online to restore your workout state.",
        );
      }

      if (replayResult.blockedReason !== "blocked") {
        throw createSyncBlockedError(
          replayResult.blockedReason === "reauthentication"
            ? "Please sign in again before we continue syncing your workout."
            : "Workout sync is blocked until the conflict is resolved.",
          replayResult.blockedReason,
        );
      }
    }
  }

  try {
    const workout = await client.getActiveWorkout();
    await cacheTodayWorkout(workout, store);
    return workout;
  } catch (error) {
    if (!isBackendUnavailableError(error)) {
      throw error;
    }

    const cachedWorkout = await store.getCachedActiveWorkout();

    if (!cachedWorkout) {
      throw createOfflineUnavailableError(
        "Offline data is not available yet. Open the app once while online to cache your workout.",
      );
    }

    return cachedWorkout.data;
  }
}

export async function logSetWithOfflineFallback(
  sessionId: string,
  set: SetPayload,
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
): Promise<PendingSyncResult> {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;

  try {
    await client.logSet(sessionId, set);
    await store.applyQueuedSetToCachedWorkout(set.exerciseLogId);
    return { status: "synced" };
  } catch (error) {
    if (!isBackendUnavailableError(error)) {
      throw error;
    }

    const cachedAuthUserId = await store.getCachedAuthUserId();

    await store.queueOp({
      entityId: set.uuid,
      entityType: "set",
      operation: "create",
      payload: {
        sessionId,
        set,
      },
      retryCount: 0,
      userId: cachedAuthUserId?.value ?? "unknown",
    });
    await store.applyQueuedSetToCachedWorkout(set.exerciseLogId);
    await store.markWorkoutActive(true);

    return { status: "queued" };
  }
}

export async function completeWorkoutWithOfflineFallback(
  sessionId: string,
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
) {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;

  try {
    await client.completeWorkoutSession(sessionId);
    await store.resetCurrentUserWorkoutState();
    return { status: "synced" as const };
  } catch (error) {
    if (!isBackendUnavailableError(error)) {
      throw error;
    }

    await store.queueWorkoutCompletion(sessionId);
    await store.markWorkoutActive(true);

    return { status: "queued" as const };
  }
}

export async function syncPendingOps(
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
): Promise<SyncReplayResult> {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;
  const cachedAuthUserId = await store.getCachedAuthUserId();

  if (!cachedAuthUserId?.value) {
    return {
      pendingCount: 0,
      status: "synced",
    };
  }

  const storageHealth = await store.getOfflineStoreHealth();

  if (storageHealth === "recovery") {
    await store.setBlockedSyncReason("storage", cachedAuthUserId.value);

    return {
      blockedReason: "storage",
      pendingCount: await store.listPendingOpsCount(cachedAuthUserId.value),
      status: "blocked",
    };
  }

  const result = await syncPendingOpsForUser(
    client,
    store,
    cachedAuthUserId.value,
  );

  return {
    ...result,
    pendingCount: await store.listPendingOpsCount(cachedAuthUserId.value),
  };
}
