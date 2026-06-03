import { type ActiveWorkout, type SetPayload, api } from "$lib/api";
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
  | "skipToday"
  | "submitFeedback"
  | "substituteExercise"
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
  | "queueFeedback"
  | "queueOp"
  | "queueSkipToday"
  | "queueSubstitution"
  | "queueWorkoutCompletion"
  | "resetCurrentUserWorkoutState"
  | "setBlockedSyncReason"
  | "setLastSuccessfulReplayAt"
>;

type SubstituteResult = Awaited<ReturnType<typeof api.substituteExercise>>;

type PendingSyncResult = { status: "queued" } | { status: "synced" };
type SubstituteSyncResult =
  | { status: "queued" }
  | { status: "synced"; replacement: SubstituteResult };
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
  switch (op.entityType) {
    case "set": {
      await client.logSet(op.payload.sessionId, op.payload.set);
      await store.applyQueuedSetToCachedWorkout(
        op.payload.set.exerciseLogId,
        op.userId,
      );
      return { terminal: false };
    }

    case "workout": {
      if (op.operation === "complete") {
        await client.completeWorkoutSession(op.payload.sessionId);
        return { terminal: true };
      }

      try {
        await client.skipToday(op.payload.mesocyclusId);
      } catch (error) {
        const status = getErrorStatus(error);

        if (status === 404 || status === 409) {
          return { terminal: false };
        }
        throw error;
      }
      return { terminal: false };
    }

    case "feedback": {
      try {
        await client.submitFeedback(op.payload);
      } catch (error) {
        if (getErrorStatus(error) === 409) {
          return { terminal: false };
        }
        throw error;
      }
      return { terminal: false };
    }

    case "substitution": {
      await client.substituteExercise(
        op.payload.sessionId,
        op.payload.exerciseLogId,
        op.payload.exerciseId,
      );
      return { terminal: false };
    }

    case "profile": {
      await client.updateProfile(op.payload);
      return { terminal: false };
    }

    default: {
      const _: never = op;
      throw new Error(`Unsupported pending operation`);
    }
  }
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
    ...ops.filter((op) => op.entityType === "substitution"),
    ...ops.filter((op) => op.entityType === "set"),
    ...ops.filter(
      (op) => op.entityType === "workout" && op.operation === "complete",
    ),
    ...ops.filter(
      (op) =>
        op.entityType !== "substitution" &&
        op.entityType !== "set" &&
        !(op.entityType === "workout" && op.operation === "complete"),
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
          replayResult.blockedReason!,
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

export async function submitFeedbackWithOfflineFallback(
  mesocyclusId: string,
  difficulty: string,
  variety: string,
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
): Promise<PendingSyncResult> {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;

  try {
    await client.submitFeedback({ difficulty, mesocyclusId, variety });
    return { status: "synced" };
  } catch (error) {
    if (!isBackendUnavailableError(error)) {
      throw error;
    }

    await store.queueFeedback(mesocyclusId, difficulty, variety);
    return { status: "queued" };
  }
}

export async function skipTodayWithOfflineFallback(
  mesocyclusId: string,
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
): Promise<PendingSyncResult> {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;

  try {
    await client.skipToday(mesocyclusId);
    return { status: "synced" };
  } catch (error) {
    if (!isBackendUnavailableError(error)) {
      throw error;
    }

    await store.queueSkipToday(mesocyclusId);
    return { status: "queued" };
  }
}

export async function substituteExerciseWithOfflineFallback(
  sessionId: string,
  exerciseLogId: string,
  exerciseId: string,
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
): Promise<SubstituteSyncResult> {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;

  try {
    const replacement = await client.substituteExercise(
      sessionId,
      exerciseLogId,
      exerciseId,
    );
    return { replacement, status: "synced" };
  } catch (error) {
    if (!isBackendUnavailableError(error)) {
      throw error;
    }

    await store.queueSubstitution(sessionId, exerciseLogId, exerciseId);
    return { status: "queued" };
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
