import {
  type ActiveWorkout,
  type SetPayload,
  type UserProfile,
  api,
} from "$lib/api";
import {
  type OfflineStore,
  type PendingOp,
  offlineStore,
} from "$lib/db/offline-store";
import {
  createOfflineUnavailableError,
  getErrorStatus,
  isBackendUnavailableError,
} from "$lib/network-errors";

type SyncApi = Pick<
  typeof api,
  "getActiveWorkout" | "logSet" | "updateProfile"
>;

type SyncStore = Pick<
  OfflineStore,
  | "applyQueuedSetToCachedWorkout"
  | "cacheActiveWorkout"
  | "deletePendingOp"
  | "getCachedActiveWorkout"
  | "listPendingOps"
  | "markWorkoutActive"
  | "queueOp"
  | "updatePendingOpRetryCount"
>;

type SetSyncPayload = {
  sessionId: string;
  set: SetPayload;
};

type PendingSyncResult = { status: "queued" } | { status: "synced" };

const MAX_SYNC_RETRIES = 5;

export { isBackendUnavailableError as isOfflineError };

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
  await store.markWorkoutActive(workout.status === "active_session");
}

async function flushOp(op: PendingOp, client: SyncApi) {
  if (op.entityType === "set" && op.operation === "create") {
    if (!isSetSyncPayload(op.payload)) {
      throw new Error("Invalid queued set payload");
    }

    await client.logSet(op.payload.sessionId, op.payload.set);
    return;
  }

  if (op.entityType === "profile" && op.operation === "update") {
    await client.updateProfile(op.payload as unknown as UserProfile);
    return;
  }

  throw new Error(
    `Unsupported pending operation: ${op.entityType}:${op.operation}`,
  );
}

export async function getTodayWorkout(
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
) {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;

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

    await store.queueOp({
      entityId: set.uuid,
      entityType: "set",
      operation: "create",
      payload: {
        sessionId,
        set,
      },
      retryCount: 0,
    });
    await store.applyQueuedSetToCachedWorkout(set.exerciseLogId);
    await store.markWorkoutActive(true);

    return { status: "queued" };
  }
}

export async function syncPendingOps(
  options: {
    client?: SyncApi;
    store?: SyncStore;
  } = {},
) {
  const client = options.client ?? api;
  const store = options.store ?? offlineStore;
  const ops = await store.listPendingOps();

  for (const op of ops) {
    if (typeof op.id !== "number") {
      continue;
    }

    try {
      await flushOp(op, client);
      await store.deletePendingOp(op.id);
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        await store.deletePendingOp(op.id);
        continue;
      }

      if (isBackendUnavailableError(error)) {
        break;
      }

      const retryCount = op.retryCount + 1;

      if (retryCount >= MAX_SYNC_RETRIES) {
        await store.deletePendingOp(op.id);
        continue;
      }

      await store.updatePendingOpRetryCount(op.id, retryCount);
    }
  }
}
