## 1. Offline Contract And Documentation

- [x] 1.1 Define the MVP offline contract for active workout restore, queued set logging, and queued workout completion.
- [x] 1.2 Update architecture and implementation docs to remove unsupported offline behaviors from the MVP promise.
- [x] 1.3 Document server/client outcome handling for duplicate, blocked, unauthorized, and unavailable sync responses.

## 2. User-Scoped Local State

- [x] 2.1 Replace the current pre-release offline store shape so cached workout data, pending ops, and sync metadata are scoped to the authenticated user.
- [x] 2.2 Implement cache invalidation for completion, manual abort, logout, user switch, and 24-hour expiry.
- [x] 2.3 Add startup storage validation and recovery handling for missing or wiped IndexedDB state.

## 3. Replay And Route Coordination

- [x] 3.1 Introduce a foreground sync coordinator that replays pending ops before dashboard or workout refreshes.
- [x] 3.2 Update auth initialization, app layout, and workout/dashboard routes to use the shared replay barrier and explicit sync states.
- [x] 3.3 Refine offline error classification so stale cache fallback is only used for defined offline conditions.

## 4. Offline Completion And PWA Hardening

- [x] 4.1 Add queued workout completion with explicit ordering after pending set replay.
- [x] 4.2 Extend queued-write scope to include feedback submission, skip-today, and exercise substitution; keep start-session and create-plan online-only with clear UX messaging.
- [x] 4.3 Narrow service worker runtime API caching and wire persisted `workout_active` coordination for deferred updates.
- [x] 4.4 Add minimal sync visibility for pending count, last successful replay, and blocked-sync reason.

## 5. Validation

- [x] 5.1 Add focused tests for user-scoped cache isolation, stale-workout expiry, and replay-before-refresh ordering.
- [x] 5.2 Add workflow tests for offline workout completion, terminal-path invalidation, and service worker update deferral.
- [x] 5.3 Add degraded-mode tests for auth loss, storage wipe detection, and blocked sync outcomes.

## 6. Queued Mutation Extension

- [x] 6.1 Refactor `PendingOp` to a discriminated union; remove `PendingEntityType` and `PendingOperationKind` type aliases; update `flushOp()` to an exhaustive switch; fix the unguarded `profile:update` cast; update `sync.test.ts` inline type annotation.
- [x] 6.2 Add queued feedback submission: `entityType: "feedback"`, `operation: "create"`, keyed on `mesocyclusId`; swallow 409 on replay.
- [x] 6.3 Add queued skip-today: `entityType: "workout"`, `operation: "update"`, payload `{ action: "skip_today", mesocyclusId }` — discriminated via payload, not a new op kind; swallow 409 on replay.
- [x] 6.4 Add queued exercise substitution: `entityType: "substitution"`, `operation: "create"`; deduplication atomic via Dexie transaction (one sub per `exerciseLogId`); replay ordered before sets.
- [x] 6.5 Update replay ordering in `replayPendingOpsOnce`: substitutions → sets → workout completion → others (feedback, skip, profile update).
- [x] 6.6 Update UI: optimistic skip-today (hide workout card after queue to prevent double-queue), substitution panel closes on queue with queued announcement, queued-success messages for feedback.
- [x] 6.7 Add/update tests: discriminated union exhaustiveness, substitution replay-before-sets ordering, 409 swallow for skip and feedback, deduplication atomicity.