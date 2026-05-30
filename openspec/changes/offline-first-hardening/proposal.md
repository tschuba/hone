## Why

The current offline-first implementation is materially narrower than the behavior promised in the architecture notes. That gap makes offline mode fragile: stale workouts can be resurrected, queued writes do not reliably reconcile before fresh reads, and users can finish a workout locally without a safe path to close the session.

## What Changes

- Define a single offline workout resilience capability covering user-scoped local state, active-workout cache lifecycle, deterministic replay-before-refresh behavior, and persisted workout update coordination.
- Narrow the MVP offline contract to the flows that must be safe: resume a fresh active workout, queue set logs, and complete a workout without stranding the session.
- Define explicit failure handling for stale cache, auth loss, storage loss, and sync-blocked conditions instead of treating them as generic offline states.
- Add minimal sync visibility requirements so the UI can communicate pending work, blocked replay, and recovery actions.
- Align architecture and implementation scope by moving unsupported offline mutations out of the MVP contract.

## Capabilities

### New Capabilities
- `offline-workout-resilience`: Reliable offline behavior for active workout restore, queued workout writes, replay orchestration, and recovery from stale or lost local state.

### Modified Capabilities
- None.

## Impact

- Affects [apps/web/src/lib/db/offline-store.ts](/Users/thomas/Projects/hone/apps/web/src/lib/db/offline-store.ts), [apps/web/src/lib/sync.ts](/Users/thomas/Projects/hone/apps/web/src/lib/sync.ts), [apps/web/src/lib/network-errors.ts](/Users/thomas/Projects/hone/apps/web/src/lib/network-errors.ts), [apps/web/src/lib/context/auth-session.svelte.ts](/Users/thomas/Projects/hone/apps/web/src/lib/context/auth-session.svelte.ts), [apps/web/src/routes/+layout.svelte](/Users/thomas/Projects/hone/apps/web/src/routes/+layout.svelte), [apps/web/src/routes/+page.svelte](/Users/thomas/Projects/hone/apps/web/src/routes/+page.svelte), [apps/web/src/routes/workout/+page.svelte](/Users/thomas/Projects/hone/apps/web/src/routes/workout/+page.svelte), and [apps/web/vite.config.ts](/Users/thomas/Projects/hone/apps/web/vite.config.ts).
- May require small API contract clarifications for set idempotency and workout completion sequencing in the workout session routes.
- Requires architecture and implementation docs to reflect the narrowed MVP offline surface without carrying legacy migration concerns.