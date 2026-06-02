## Sync Outcome Handling

This document defines how the client interprets every server response (and network condition) it can encounter during a pending-op replay cycle. It covers the full outcome space for `replayPendingOpsOnce` so that callers have a predictable contract to code against.

---

### Response classes

#### Successful flush — `200 OK` (including duplicate UUID)

The server accepted the operation. For set creation the server identifies duplicates by the client-generated UUID and responds with `200` rather than `409`, so the write is idempotent. The client deletes the op from the local queue and continues to the next op in the ordered sequence.

If the flushed op is a workout-completion (terminal), the client additionally calls `resetCurrentUserWorkoutState()` before returning `synced`. This clears the cached workout, all pending ops for the user, and the `workout_active` flag in one step.

#### Auth failure — `401` or `403`

The session token is invalid or the resource is forbidden. Replay stops immediately. The client writes `"reauthentication"` as the blocked-sync reason and returns `status: "blocked"` with `blockedReason: "reauthentication"`. No ops are deleted.

Route handlers downstream of `getTodayWorkout` receive a `{ status: 409, reason: "reauthentication" }` error shape, which the layout banner renders as a sign-in prompt.

#### Conflict — `409`, `422`, or `423`

The server rejected the operation due to a business-logic conflict (e.g. session already completed, lock active, or an unprocessable payload). Replay stops immediately. The client writes `"conflict"` as the blocked-sync reason and returns `status: "blocked"` with `blockedReason: "conflict"`. No ops are deleted; manual resolution is expected.

#### Backend unavailable — `502`, `503`, `504`, or `TypeError("Failed to fetch" / "NetworkError" / "Load failed")`

A transient infrastructure or network condition. Replay stops immediately. The client writes `"blocked"` as the blocked-sync reason and returns `status: "blocked"` with `blockedReason: "blocked"`. No ops are deleted. Replay will be retried on the next reconnect or app-focus event; a fresh `isBackendUnavailableError` check on retry will clear the block if the backend has recovered.

This is the only blocked state that is self-healing without user action.

#### Storage loss — IndexedDB wiped or sentinel missing

Detected before replay begins via `getOfflineStoreHealth()`. When the health check returns `"recovery"` the client writes `"storage"` as the blocked-sync reason, skips replay entirely, and returns `status: "blocked"` with `blockedReason: "storage"`. The layout banner prompts the user to reconnect online; `auth-session` initialization will have already entered the storage-recovery error path.

---

### Replay ordering

Within a single `replayPendingOpsOnce` call ops are processed in this order:

1. Set-creation ops (`entityType: "set"`, `operation: "create"`), in the order they were queued (ascending `createdAt`)
2. Workout-completion op (`entityType: "workout"`, `operation: "complete"`), if present
3. All other ops (e.g. profile updates)

A completion op is never sent before all pending set ops have been flushed successfully. If a set op encounters a non-retriable error the completion op is never reached in that replay cycle.

---

### Blocked-reason persistence

The current blocked reason is persisted to IndexedDB under the user-scoped key `<userId>:blocked_sync_reason`. It is cleared (`null`) when:

- A replay cycle completes with `status: "synced"` (all ops flushed or no ops pending)
- A terminal completion op is processed successfully (via `resetCurrentUserWorkoutState`)

It is never automatically cleared after a transient `"blocked"` reason — that is intentional so that the last-known block is visible to the sync-status banner even between replay attempts.

---

### `getTodayWorkout` propagation rules

| Replay result | Action in `getTodayWorkout` |
|---|---|
| `synced` | Proceeds to live network fetch; falls back to Dexie cache on offline error |
| `blocked` + reason `"blocked"` | Proceeds to live network fetch (transient condition); falls back to cache on error |
| `blocked` + reason `"reauthentication"` | Throws `{ status: 409, reason: "reauthentication" }` — layout shows sign-in prompt |
| `blocked` + reason `"conflict"` | Throws `{ status: 409, reason: "conflict" }` — layout shows conflict message |
| `blocked` + reason `"storage"` | Throws `{ status: 507 }` — auth-session initialization already entered recovery mode |
