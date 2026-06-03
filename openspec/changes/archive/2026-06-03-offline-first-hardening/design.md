## Context

The shipped client currently supports only a thin offline slice: it caches the latest active workout, queues offline set creation, restores a cached user ID when the backend is unavailable, and flushes pending operations on a small set of reconnect events. That leaves three failure classes unresolved:

- stale local state can outlive the workout it represents
- replay and fresh server reads race each other on startup and reconnect
- a workout can be completed locally without a safe, explicit offline completion contract

The architecture notes already describe richer behavior such as 24-hour expiry, persisted `workout_active` coordination, storage-loss recovery, and deterministic startup restore. This change turns the highest-value parts of that intent into an implementable MVP contract and narrows the rest.

## Goals / Non-Goals

**Goals:**
- Make active workout restore deterministic and user-scoped.
- Ensure pending workout writes reconcile before route-level refreshes use fresh server state.
- Eliminate the "finished locally but stranded remotely" failure mode.
- Define explicit degraded behavior for auth loss, storage loss, and sync-blocked conditions.
- Keep the offline MVP small enough to implement and validate with targeted tests.

**Non-Goals:**

- Full offline coverage for every mutation surface such as profile edits and plan management.
- Offline support for start-session (server returns `sessionId` that downstream set-log ops depend on) and create-plan (triggers a background job; stacking multiple offline creates is a product risk).
- Multi-device merge resolution beyond idempotent append semantics for the active session.
- Rich operational analytics or background sync behavior that depends on unsupported iOS browser features.

## Decisions

1. User-scoped offline state

Local workout cache, queue state, and sync metadata will be bound to the authenticated user identity rather than a single global browser database view. This avoids cross-user leakage on shared devices and makes cache invalidation deterministic on logout or user switch.

Alternative considered: keeping one global cache and clearing everything on auth changes. Rejected because it still leaves ambiguity during offline restore and makes it easier to accidentally flush one user's pending writes under another user's session.

2. Active workout cache is a resumable session artifact, not a generic fallback for "today workout"

The cached active workout will have explicit lifecycle rules: create from a confirmed active session, restore only if it is fresh and belongs to the current offline identity, and clear on terminal paths such as completion, manual abort, or expiry.

Alternative considered: continuing to treat the cached active workout as a general fallback for dashboard and workout reads. Rejected because it blurs the difference between resuming an active session and showing current server state, which is the root of stale-session resurrection.

3. Offline-safe write scope covers set logging, workout completion, feedback submission, skip-today, and exercise substitution

Set creation remains an idempotent append-by-client UUID. Workout completion is an explicit queued operation so a user can finish offline. Feedback submission, skip-today, and exercise substitution are also queued: their payloads are stable at call time, they reference the mesocycle or session IDs already known client-side, and duplicate replays are safe (server treats them as no-ops). Other mutations such as profile edits and plan management remain online-only. Start-session and create-plan remain online-only: the former returns a `sessionId` that downstream set-log ops depend on, and the latter carries a product risk of stacking multiple offline job-creation requests.

Alternative considered: keeping only queued set writes and requiring online completion and all other mutations. Rejected because feedback, skip, and substitution have the same stable-payload properties as set writes and leaving them blocked degrades the offline experience unnecessarily.

4. Sync coordination moves behind a foreground replay barrier

App startup, auth restore, reconnect, and route refreshes will use a shared sync coordinator that replays pending operations before server-backed workout state is refreshed. The barrier can be skipped only when the client is definitively offline or replay is blocked by a known non-retriable condition.

Alternative considered: retaining today's best-effort background `syncPendingOps()` calls. Rejected because racing replay and route loads produces stale UI and incorrect redirects.

5. Runtime API caching is narrowed to avoid stale auth and workout reads

Service worker runtime caching for `/api/*` will be limited to explicitly safe endpoints, while auth- and workout-sensitive reads rely on the explicit Dexie-backed offline contract instead of opaque Workbox fallback behavior.

Alternative considered: keeping broad `NetworkFirst` API caching and inferring freshness from fetch success. Rejected because stale cached responses are indistinguishable from live data at the call site.

6. Persisted workout-active coordination and storage-loss detection are part of MVP hardening

The `workout_active` flag becomes a read/write coordination primitive, not a write-only hint. The client also gains a small sentinel-based storage health check so Safari or IndexedDB loss enters a defined recovery path instead of silently degrading into partial state.

Alternative considered: leaving these protections as architecture notes only. Rejected because reloads and browser storage loss are core offline failure modes, not edge cases.

7. Sync visibility stays minimal but explicit

The UI will expose pending-op count, last successful replay timestamp, and blocked-sync reason where relevant. This is enough to support user trust and debugging without creating a full diagnostics console.

Alternative considered: no new visibility until a later diagnostics change. Rejected because hidden queue state is a direct contributor to perceived fragility.

8. `PendingOp` is a discriminated union, not a flat matrix

The `PendingOp` type will be refactored from a flat `{ entityType, operation, payload: Record<string, unknown> }` shape to a discriminated union where each op variant carries a typed payload. The existing `flushOp()` if-chain becomes an exhaustive switch, so adding or removing an op type is a compile error if not handled. The `profile:update` branch already omits a runtime type guard under the old design — the union eliminates that class of bug entirely.

Alternative considered: continuing to grow the flat matrix. Rejected because adding three new op types at once is the natural inflection point, and the cost of the refactor is contained to three files (`offline-store.ts`, `sync.ts`, `sync.test.ts`).

## Risks / Trade-offs

- [Queued workout completion adds a second syncable mutation type] -> Mitigation: keep the payload narrow, define terminal-path ordering explicitly, and cover it with integration tests.
- [User-scoped local state changes the local storage shape] -> Mitigation: replace the pre-release IndexedDB layout directly and keep the new schema minimal.
- [Replay barrier can delay initial route rendering] -> Mitigation: only block server-backed refreshes, not the entire shell, and provide a visible syncing state.
- [Narrowing Workbox API caching may reduce perceived resilience for non-critical reads] -> Mitigation: rely on explicit Dexie-backed offline data for critical workout flows and show empty-state messaging for non-cached reads.
- [Storage-loss detection can surface more user-facing warnings] -> Mitigation: reserve warnings for cases that affect unsynced local work or require the user to reconnect before proceeding.

## Migration Plan

No customer migration is required. This change can replace the current pre-release offline store shape directly while updating the route and service-worker flows in the same implementation window.

## Open Questions

- Should a blocked completion queue item keep the workout resumable from the dashboard, or should the UI enter a distinct "finish sync required" terminal state?
- Should workout history receive its own local cache in this change, or remain explicitly unavailable offline?
- Is a dedicated server sync-status endpoint needed immediately, or can structured logs and existing route responses carry the first implementation?