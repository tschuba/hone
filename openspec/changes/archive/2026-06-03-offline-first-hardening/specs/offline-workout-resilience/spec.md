## ADDED Requirements

### Requirement: Offline workout state is scoped to the authenticated user
The system SHALL scope cached active workout data, pending workout operations, and sync metadata to the authenticated user identity on the current device.

#### Scenario: User switch does not expose another user's workout
- **WHEN** user A has cached workout state or pending operations on a device and user B later authenticates on the same device
- **THEN** the system SHALL hide user A's cached workout state from user B and SHALL NOT replay user A's pending operations under user B's session

#### Scenario: Logout clears resumable workout state for the current user
- **WHEN** an authenticated user logs out on a device with cached active workout data
- **THEN** the system SHALL clear or detach that user's resumable workout state so it is not restored into a later unauthenticated or different-user session

### Requirement: Active workout cache follows an explicit lifecycle
The system SHALL treat the cached active workout as a resumable session artifact with explicit creation, restore, expiry, and terminal-path invalidation rules.

#### Scenario: Fresh cached workout can be restored offline
- **WHEN** the client starts without backend availability and a cached active workout exists for the current user with an age less than 24 hours
- **THEN** the system SHALL restore that workout as the resumable active session

#### Scenario: Stale cached workout is expired
- **WHEN** the client starts and the cached active workout for the current user is older than 24 hours
- **THEN** the system SHALL clear the cached workout, reset persisted workout-active state, and SHALL NOT resume the expired session

#### Scenario: Terminal workout paths clear resumable cache
- **WHEN** a workout reaches a terminal path through successful completion, confirmed manual abort, or acknowledged offline completion replay
- **THEN** the system SHALL clear the cached active workout for that session and reset persisted workout-active state

### Requirement: Replay completes before server-backed workout refresh
The system SHALL replay pending workout operations before refreshing server-backed workout state on app startup, auth restoration, and reconnect flows unless the client is definitively offline or replay is blocked by a known non-retriable condition.

#### Scenario: Startup with pending operations replays before refresh
- **WHEN** the client starts with pending workout operations for the current user and backend connectivity is available
- **THEN** the system SHALL attempt replay before using fresh server responses to render dashboard or workout state

#### Scenario: Replay barrier is skipped only for defined blocked states
- **WHEN** pending workout operations exist but replay cannot proceed because the client is offline or requires reauthentication
- **THEN** the system SHALL preserve the pending operations and enter a defined blocked-sync state instead of silently continuing as if replay succeeded

### Requirement: Offline-safe workout writes are explicit and limited
The system SHALL support offline queuing for set logging and workout completion, and SHALL treat other workout mutations as online-only until they have their own offline contract.

#### Scenario: Set completion queues offline and updates local progress
- **WHEN** a user logs a set while the backend is unavailable
- **THEN** the system SHALL queue the set with an idempotent client-generated identifier and update local workout progress for the active session

#### Scenario: Workout completion can be queued offline
- **WHEN** a user completes the final step of a workout while the backend is unavailable
- **THEN** the system SHALL queue workout completion for later replay and present the workout as pending sync rather than leaving it in an ambiguous active state

#### Scenario: Unsupported workout mutations stay online-only
- **WHEN** a user attempts an unsupported mutation such as profile edit or plan creation while the backend is unavailable
- **THEN** the system SHALL preserve existing queued workout data and SHALL present that mutation as unavailable offline instead of pretending it was queued

### Requirement: Pending operation outcomes are explicit
The system SHALL remove a pending workout operation only after an explicit applied or duplicate-applied outcome and SHALL preserve blocked operations for recovery.

#### Scenario: Duplicate set replay is safely acknowledged
- **WHEN** replay submits a queued set operation whose idempotent identifier was already accepted by the server
- **THEN** the system SHALL treat the duplicate acknowledgement as successful replay and remove the queued operation

#### Scenario: Conflict or authorization failure blocks replay
- **WHEN** replay receives a non-retriable conflict, validation error, or authorization failure for a queued operation
- **THEN** the system SHALL preserve the queued operation, stop dependent replay, and expose a blocked-sync reason for recovery

### Requirement: Service worker updates respect persisted workout activity
The system SHALL use persisted workout activity state to defer service worker activation while a workout is resumable on the device.

#### Scenario: Update is deferred during an active or resumable workout
- **WHEN** a service worker update is available while persisted workout activity indicates an active or resumable workout session
- **THEN** the system SHALL defer activation of the update until the workout reaches a terminal path

#### Scenario: Update can activate after terminal path
- **WHEN** persisted workout activity has been reset after workout completion, abort, or expiry
- **THEN** the system SHALL allow the waiting service worker to activate on the next eligible update check

### Requirement: Storage loss enters a defined recovery mode
The system SHALL detect missing or wiped local offline state and enter a defined recovery mode instead of silently treating partial local state as trustworthy.

#### Scenario: Missing storage sentinel triggers recovery handling
- **WHEN** the client starts and required offline-state sentinel metadata is missing or indicates a wiped local store
- **THEN** the system SHALL clear inconsistent local workout state, preserve any recoverable server-backed session flow, and notify the user when unsynced local work may have been lost

#### Scenario: IndexedDB is unavailable
- **WHEN** the client cannot open or use the local offline store
- **THEN** the system SHALL disable offline workout guarantees for that session and communicate that degraded mode to the user

### Requirement: Sync state is visible to the user
The system SHALL expose minimal sync state for the active workout experience.

#### Scenario: Pending replay is visible
- **WHEN** queued workout operations exist for the current user
- **THEN** the system SHALL display that replay is pending and how many operations remain queued

#### Scenario: Blocked replay communicates recovery state
- **WHEN** replay is blocked by reauthentication, conflict, or storage recovery conditions
- **THEN** the system SHALL display the blocked state and SHALL NOT imply that local data has already been synchronized

### Requirement: Feedback submission can be queued offline
The system SHALL queue feedback submission when the backend is unavailable and replay it on reconnect.

#### Scenario: Feedback queues when offline
- **WHEN** a user submits feedback while the backend is unavailable
- **THEN** the system SHALL queue the op with `entityType: "feedback"` keyed on `mesocyclusId` and SHALL display a queued-success message instead of an error

#### Scenario: Duplicate feedback replay is treated as success
- **WHEN** a queued feedback op is replayed and the server returns 409 (duplicate submission for the same user and mesocycle)
- **THEN** the system SHALL treat the response as a successful no-op, delete the queued op, and continue replay — it SHALL NOT enter a blocked-sync state

### Requirement: Skip-today can be queued offline
The system SHALL queue a skip-today action when the backend is unavailable and replay it on reconnect.

#### Scenario: Skip-today queues when offline
- **WHEN** a user skips today's workout while the backend is unavailable
- **THEN** the system SHALL queue the op as `entityType: "workout"`, `operation: "update"`, `payload.action: "skip_today"` and SHALL immediately transition the dashboard to an empty state to prevent the action from being triggered again

#### Scenario: loadDashboard is not called after offline skip
- **WHEN** a skip-today op is queued offline
- **THEN** the system SHALL NOT call `loadDashboard()` — the optimistic empty state persists until the next auth-triggered refresh

#### Scenario: Duplicate skip replay is treated as success
- **WHEN** a queued skip op is replayed and the server returns 409
- **THEN** the system SHALL treat the response as a successful no-op and delete the queued op — it SHALL NOT enter a blocked-sync state

### Requirement: Exercise substitution can be queued offline
The system SHALL queue exercise substitution when the backend is unavailable and replay it before any dependent set-create ops.

#### Scenario: Substitution queues when offline
- **WHEN** a user substitutes an exercise while the backend is unavailable
- **THEN** the system SHALL queue the op as `entityType: "substitution"` keyed on `exerciseLogId`, close the substitution panel immediately, and display a queued announcement

#### Scenario: Only one substitution per exercise log entry is held in the queue
- **WHEN** a user queues a substitution for an `exerciseLogId` that already has a pending substitution op
- **THEN** the system SHALL replace the prior queued substitution with the new one atomically (single Dexie transaction) so at most one substitution per `exerciseLogId` is in the queue at any time

#### Scenario: Substitution replays before its dependent set-create ops
- **WHEN** a queued substitution op and queued set-create ops exist for the same session
- **THEN** the system SHALL replay the substitution op before any set-create ops, because the substitution creates the `exerciseLogId` that the set-create payloads reference
