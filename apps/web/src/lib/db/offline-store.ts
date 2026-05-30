import Dexie, { type Table } from "dexie";

import type { ActiveWorkout } from "$lib/api";

export type PendingEntityType = "profile" | "set" | "workout";
export type PendingOperationKind = "create" | "delete" | "update";

export type PendingOp = {
  createdAt: Date;
  entityId: string;
  entityType: PendingEntityType;
  id?: number;
  operation: PendingOperationKind;
  payload: Record<string, unknown>;
  retryCount: number;
};

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

export class OfflineStore extends Dexie {
  activeWorkout!: Table<CachedActiveWorkout, string>;
  pendingOps!: Table<PendingOp, number>;
  syncMeta!: Table<SyncMetaRecord, string>;

  constructor() {
    super("hone-offline");

    this.version(1).stores({
      activeWorkout: "id, updatedAt",
      pendingOps: "++id, createdAt, entityType, entityId",
      syncMeta: "key",
    });
  }

  async applyQueuedSetToCachedWorkout(exerciseLogId: string) {
    const cachedWorkout = await this.getCachedActiveWorkout();

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

    await this.cacheActiveWorkout({
      ...cachedWorkout.data,
      exercises,
    });
    await this.markWorkoutActive(true);
  }

  async cacheActiveWorkout(data: ActiveWorkout) {
    await this.activeWorkout.put({
      data,
      id: ACTIVE_WORKOUT_CACHE_KEY,
      updatedAt: new Date(),
    });
  }

  async clearCachedAuthUserId() {
    await this.syncMeta.delete(AUTH_USER_ID_META_KEY);
  }

  async deletePendingOp(id: number) {
    await this.pendingOps.delete(id);
  }

  async getCachedActiveWorkout() {
    return this.activeWorkout.get(ACTIVE_WORKOUT_CACHE_KEY);
  }

  async getCachedAuthUserId() {
    return this.syncMeta.get(AUTH_USER_ID_META_KEY);
  }

  async getSyncMeta(key: string) {
    return this.syncMeta.get(key);
  }

  async listPendingOps() {
    return this.pendingOps.orderBy("createdAt").toArray();
  }

  async markWorkoutActive(value: boolean) {
    await this.syncMeta.put({
      key: WORKOUT_ACTIVE_META_KEY,
      value: value ? "true" : "false",
    });
  }

  async queueOp(input: Omit<PendingOp, "createdAt" | "id">) {
    return this.pendingOps.add({
      ...input,
      createdAt: new Date(),
    });
  }

  async setCachedAuthUserId(userId: string) {
    await this.syncMeta.put({
      key: AUTH_USER_ID_META_KEY,
      value: userId,
    });
  }

  async updatePendingOpRetryCount(id: number, retryCount: number) {
    await this.pendingOps.update(id, { retryCount });
  }
}

export const offlineStore = new OfflineStore();
