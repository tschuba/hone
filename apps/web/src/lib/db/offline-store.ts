import Dexie, { type Table } from "dexie";

import type { ActiveWorkout, SetPayload, UserProfile } from "$lib/api";
import { createStorageRecoveryError } from "$lib/network-errors";

const OFFLINE_STORE_VERSION = "2";
const GLOBAL_SYNC_SCOPE = "global";
const OFFLINE_STORE_SENTINEL_KEY = "offline_store_sentinel";
const LAST_SUCCESSFUL_REPLAY_META_KEY = "last_successful_replay_at";
const BLOCKED_SYNC_REASON_META_KEY = "blocked_sync_reason";

export type OfflineStoreHealthStatus = "healthy" | "initialized" | "recovery";
export type SyncBlockedReason =
  | "blocked"
  | "conflict"
  | "reauthentication"
  | "storage";

type PendingOpBase = {
  createdAt: Date;
  entityId: string;
  id?: number;
  retryCount: number;
  userId: string;
};

type PendingSetCreateOp = PendingOpBase & {
  entityType: "set";
  operation: "create";
  payload: { sessionId: string; set: SetPayload };
};

type PendingWorkoutCompleteOp = PendingOpBase & {
  entityType: "workout";
  operation: "complete";
  payload: { sessionId: string };
};

type PendingWorkoutSkipOp = PendingOpBase & {
  entityType: "workout";
  operation: "update";
  payload: { action: "skip_today"; mesocyclusId: string };
};

type PendingFeedbackCreateOp = PendingOpBase & {
  entityType: "feedback";
  operation: "create";
  payload: { difficulty: string; mesocyclusId: string; variety: string };
};

type PendingSubstitutionCreateOp = PendingOpBase & {
  entityType: "substitution";
  operation: "create";
  payload: { exerciseId: string; exerciseLogId: string; sessionId: string };
};

type PendingProfileUpdateOp = PendingOpBase & {
  entityType: "profile";
  operation: "update";
  payload: UserProfile;
};

export type PendingOp =
  | PendingSetCreateOp
  | PendingWorkoutCompleteOp
  | PendingWorkoutSkipOp
  | PendingFeedbackCreateOp
  | PendingSubstitutionCreateOp
  | PendingProfileUpdateOp;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type CachedActiveWorkout = {
  data: ActiveWorkout;
  id: string;
  updatedAt: Date;
};

export type SyncMetaRecord = {
  key: string;
  value: string;
};

export const ACTIVE_WORKOUT_CACHE_KEY = "today-workout";
export const AUTH_USER_ID_META_KEY = "auth_user_id";
export const WORKOUT_ACTIVE_META_KEY = "workout_active";

function scopedMetaKey(scope: string, key: string) {
  return `${scope}:${key}`;
}

function readBrowserSentinel() {
  if (typeof localStorage === "undefined") {
    return undefined;
  }

  return (
    localStorage.getItem(
      scopedMetaKey(GLOBAL_SYNC_SCOPE, OFFLINE_STORE_SENTINEL_KEY),
    ) ?? undefined
  );
}

function writeBrowserSentinel() {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(
    scopedMetaKey(GLOBAL_SYNC_SCOPE, OFFLINE_STORE_SENTINEL_KEY),
    OFFLINE_STORE_VERSION,
  );
}

function clearBrowserSentinel() {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(
    scopedMetaKey(GLOBAL_SYNC_SCOPE, OFFLINE_STORE_SENTINEL_KEY),
  );
}

export class OfflineStore extends Dexie {
  activeWorkout!: Table<CachedActiveWorkout, string>;
  pendingOps!: Table<PendingOp, number>;
  syncMeta!: Table<SyncMetaRecord, string>;

  constructor() {
    super("hone-offline");

    this.version(2).stores({
      activeWorkout: "id, updatedAt",
      pendingOps: "++id, userId, createdAt, entityType, entityId",
      syncMeta: "key",
    });
  }

  private async deleteScopedSyncMeta(scope: string, key: string) {
    await this.syncMeta.delete(scopedMetaKey(scope, key));
  }

  private async getScopedSyncMeta(scope: string, key: string) {
    return this.syncMeta.get(scopedMetaKey(scope, key));
  }

  private async putScopedSyncMeta(scope: string, key: string, value: string) {
    await this.syncMeta.put({
      key: scopedMetaKey(scope, key),
      value,
    });
  }

  private async requireCurrentUserId(userId?: string) {
    if (userId) {
      return userId;
    }

    const cachedUserId = await this.getCachedAuthUserId();

    if (cachedUserId?.value) {
      return cachedUserId.value;
    }

    throw createStorageRecoveryError(
      "Offline storage is unavailable until this device is reinitialized online.",
    );
  }

  async applyQueuedSetToCachedWorkout(exerciseLogId: string, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);
    const cachedWorkout = await this.getCachedActiveWorkout(scope);

    if (!cachedWorkout || cachedWorkout.data.status !== "active_session") {
      return;
    }

    const exercises = cachedWorkout.data.exercises.map((exercise) =>
      exercise.exerciseLogId === exerciseLogId
        ? {
            ...exercise,
            completedSets: exercise.completedSets + 1,
          }
        : exercise,
    );

    await this.cacheActiveWorkout(
      {
        ...cachedWorkout.data,
        exercises,
      },
      scope,
    );
  }

  async cacheActiveWorkout(data: ActiveWorkout, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);

    await this.activeWorkout.put({
      data,
      id: scope,
      updatedAt: new Date(),
    });

    await this.markWorkoutActive(data.status === "active_session", scope);
  }

  async clearCachedAuthUserId() {
    await this.deleteScopedSyncMeta(GLOBAL_SYNC_SCOPE, AUTH_USER_ID_META_KEY);
  }

  async clearCachedAuthUserState() {
    await this.clearCurrentUserOfflineState();
    await this.clearCachedAuthUserId();
  }

  async clearCurrentUserOfflineState() {
    const cachedUserId = await this.getCachedAuthUserId();

    if (!cachedUserId?.value) {
      return;
    }

    await this.clearUserOfflineState(cachedUserId.value);
  }

  async clearUserOfflineState(userId: string) {
    await this.activeWorkout.delete(userId);
    await this.pendingOps.where("userId").equals(userId).delete();
    await this.deleteScopedSyncMeta(userId, WORKOUT_ACTIVE_META_KEY);
    await this.deleteScopedSyncMeta(userId, LAST_SUCCESSFUL_REPLAY_META_KEY);
    await this.deleteScopedSyncMeta(userId, BLOCKED_SYNC_REASON_META_KEY);
  }

  async deletePendingOp(id: number) {
    await this.pendingOps.delete(id);
  }

  async getCachedActiveWorkout(userId?: string) {
    const scope = await this.requireCurrentUserId(userId);
    const cachedWorkout = await this.activeWorkout.get(scope);

    if (!cachedWorkout) {
      return undefined;
    }

    if (Date.now() - cachedWorkout.updatedAt.getTime() > 24 * 60 * 60 * 1000) {
      await this.clearUserOfflineState(scope);
      return undefined;
    }

    return cachedWorkout;
  }

  async getCachedAuthUserId() {
    return this.getScopedSyncMeta(GLOBAL_SYNC_SCOPE, AUTH_USER_ID_META_KEY);
  }

  async getOfflineStoreHealth() {
    const indexedDbSentinel = await this.getScopedSyncMeta(
      GLOBAL_SYNC_SCOPE,
      OFFLINE_STORE_SENTINEL_KEY,
    );
    const browserSentinel = readBrowserSentinel();

    if (!indexedDbSentinel && !browserSentinel) {
      const hasStoredOfflineData =
        (await this.activeWorkout.count()) > 0 ||
        (await this.pendingOps.count()) > 0 ||
        (await this.syncMeta.count()) > 0;

      if (hasStoredOfflineData) {
        return "recovery";
      }

      await this.putScopedSyncMeta(
        GLOBAL_SYNC_SCOPE,
        OFFLINE_STORE_SENTINEL_KEY,
        OFFLINE_STORE_VERSION,
      );
      writeBrowserSentinel();
      return "initialized";
    }

    if (
      indexedDbSentinel?.value !== OFFLINE_STORE_VERSION ||
      browserSentinel !== OFFLINE_STORE_VERSION
    ) {
      return "recovery";
    }

    return "healthy";
  }

  async getBlockedSyncReason(userId?: string) {
    const scope = userId ?? GLOBAL_SYNC_SCOPE;
    const meta = await this.getScopedSyncMeta(scope, BLOCKED_SYNC_REASON_META_KEY);

    return meta?.value as SyncBlockedReason | undefined;
  }

  async getLastSuccessfulReplayAt(userId?: string) {
    const scope = userId ?? GLOBAL_SYNC_SCOPE;
    const meta = await this.getScopedSyncMeta(
      scope,
      LAST_SUCCESSFUL_REPLAY_META_KEY,
    );

    return meta?.value;
  }

  async getSyncMeta(key: string, userId?: string) {
    const scope = userId ?? GLOBAL_SYNC_SCOPE;
    return this.getScopedSyncMeta(scope, key);
  }

  async getWorkoutActive(userId?: string) {
    const scope = await this.requireCurrentUserId(userId);
    const meta = await this.getScopedSyncMeta(scope, WORKOUT_ACTIVE_META_KEY);

    return meta?.value === "true";
  }

  async listPendingOps(userId?: string) {
    const scope = await this.requireCurrentUserId(userId);
    return this.pendingOps
      .where("userId")
      .equals(scope)
      .sortBy("createdAt");
  }

  async listPendingOpsCount(userId?: string) {
    const scope = await this.requireCurrentUserId(userId);
    return this.pendingOps.where("userId").equals(scope).count();
  }

  async markWorkoutActive(value: boolean, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);

    await this.putScopedSyncMeta(
      scope,
      WORKOUT_ACTIVE_META_KEY,
      value ? "true" : "false",
    );
  }

  async queueFeedback(
    mesocyclusId: string,
    difficulty: string,
    variety: string,
    userId?: string,
  ) {
    const scope = await this.requireCurrentUserId(userId);

    await this.transaction("rw", this.pendingOps, async () => {
      await this.pendingOps
        .where("entityId")
        .equals(mesocyclusId)
        .filter(
          (op) => op.userId === scope && op.entityType === "feedback",
        )
        .delete();

      await this.pendingOps.add({
        createdAt: new Date(),
        entityId: mesocyclusId,
        entityType: "feedback",
        operation: "create",
        payload: { difficulty, mesocyclusId, variety },
        retryCount: 0,
        userId: scope,
      });
    });
  }

  async queueOp(
    input: DistributiveOmit<PendingOp, "createdAt" | "id">,
    userId?: string,
  ) {
    const scope = await this.requireCurrentUserId(userId);

    return this.pendingOps.add({
      ...input,
      createdAt: new Date(),
      userId: scope,
    } as PendingOp);
  }

  async queueSkipToday(mesocyclusId: string, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);

    return this.pendingOps.add({
      createdAt: new Date(),
      entityId: mesocyclusId,
      entityType: "workout",
      operation: "update",
      payload: { action: "skip_today", mesocyclusId },
      retryCount: 0,
      userId: scope,
    });
  }

  async queueSubstitution(
    sessionId: string,
    exerciseLogId: string,
    exerciseId: string,
    userId?: string,
  ) {
    const scope = await this.requireCurrentUserId(userId);

    await this.transaction("rw", this.pendingOps, async () => {
      await this.pendingOps
        .where("entityId")
        .equals(exerciseLogId)
        .filter(
          (op) => op.userId === scope && op.entityType === "substitution",
        )
        .delete();

      await this.pendingOps.add({
        createdAt: new Date(),
        entityId: exerciseLogId,
        entityType: "substitution",
        operation: "create",
        payload: { exerciseId, exerciseLogId, sessionId },
        retryCount: 0,
        userId: scope,
      });
    });
  }

  async queueWorkoutCompletion(sessionId: string, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);

    return this.pendingOps.add({
      createdAt: new Date(),
      entityId: sessionId,
      entityType: "workout",
      operation: "complete",
      payload: {
        sessionId,
      },
      retryCount: 0,
      userId: scope,
    });
  }

  async resetCurrentUserWorkoutState() {
    await this.clearCurrentUserOfflineState();
  }

  async setBlockedSyncReason(reason: SyncBlockedReason | null, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);

    if (!reason) {
      await this.deleteScopedSyncMeta(scope, BLOCKED_SYNC_REASON_META_KEY);
      return;
    }

    await this.putScopedSyncMeta(scope, BLOCKED_SYNC_REASON_META_KEY, reason);
  }

  async setCachedAuthUserId(userId: string) {
    await this.putScopedSyncMeta(GLOBAL_SYNC_SCOPE, AUTH_USER_ID_META_KEY, userId);
    writeBrowserSentinel();
  }

  async setLastSuccessfulReplayAt(date: Date, userId?: string) {
    const scope = await this.requireCurrentUserId(userId);

    await this.putScopedSyncMeta(
      scope,
      LAST_SUCCESSFUL_REPLAY_META_KEY,
      date.toISOString(),
    );
  }

  async updatePendingOpRetryCount(id: number, retryCount: number) {
    await this.pendingOps.update(id, { retryCount });
  }

  async validateOfflineState() {
    const health = await this.getOfflineStoreHealth();

    if (health === "recovery") {
      clearBrowserSentinel();
    }

    return health;
  }
}

export const offlineStore = new OfflineStore();
