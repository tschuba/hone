## ADDED Requirements

### Requirement: Plan creation always succeeds regardless of AI gate outcome
The system SHALL always create a rule-based mesocyclus and return 201 on `POST /plans`. AI job gating MUST NOT block or fail plan creation. When an AI gate prevents job creation, the response SHALL include `jobId: null`.

#### Scenario: AI gate skips job, plan still created
- **WHEN** the concurrency or debounce gate prevents a new AI job
- **THEN** the rule-based plan is created and archived normally
- **THEN** the response is `201 { mesocyclusId, planSource: 'rule_based', jobId: null, ... }`

### Requirement: Concurrency gate prevents duplicate AI jobs
The system SHALL skip a new AI job if a PENDING or PROCESSING job already exists for the same user and type. The check SHALL be enforced at the database level with a partial unique index to prevent TOCTOU races.

#### Scenario: Concurrent request hits active job
- **WHEN** `POST /plans` is called while a PENDING or PROCESSING AI job exists for the user
- **THEN** no new AI job is created
- **THEN** the response includes `jobId: null`

#### Scenario: DB rejects duplicate via partial unique index
- **WHEN** two concurrent requests both pass the application-level concurrency check simultaneously
- **THEN** the database enforces the partial unique constraint on `(user_id, type) WHERE status IN ('PENDING', 'PROCESSING')`
- **THEN** only one job row is created; the second insert fails with a unique constraint violation handled gracefully

### Requirement: Debounce gate prevents rapid re-generation
The system SHALL skip a new AI job if an AI job for the same user and type reached a terminal state less than 60 seconds ago. The debounce window SHALL be anchored to `completedAt` (not `createdAt`) to avoid a misleading countdown after instant failures.

#### Scenario: Debounce active after recent completion
- **WHEN** `POST /plans` is called within 60 seconds of a job's `completedAt`
- **THEN** no new AI job is created
- **THEN** the response includes `jobId: null` and `retryAfter: <ISO timestamp>`

#### Scenario: Debounce window has elapsed
- **WHEN** `POST /plans` is called more than 60 seconds after the last job's `completedAt`
- **THEN** a new AI job is queued normally

### Requirement: Daily cap hard-blocks AI job creation with a transparent error
The system SHALL reject AI job creation with HTTP 429 when the user's daily AI job count (excluding feedback jobs) reaches the configured limit. The response SHALL include `retryAfter` and `resetAt` (start of next UTC day).

#### Scenario: Daily cap reached for managed AI
- **WHEN** `POST /plans` is called and the user has reached the admin-defined daily limit for managed AI
- **THEN** the response is `429 { title: 'Daily limit reached', limitType: 'daily', retryAfter: <ISO>, resetAt: <ISO> }`
- **THEN** the rule-based plan IS still created (daily cap only blocks AI job, not plan creation)

#### Scenario: Daily cap reached for BYOM
- **WHEN** `POST /plans` is called and the user has reached their personal daily limit (BYOM setting)
- **THEN** same 429 response as managed AI cap

### Requirement: Feedback jobs are exempt from the daily AI job cap
Jobs with `type=FEEDBACK` SHALL NOT count toward the per-user daily AI job limit.

#### Scenario: Feedback job does not consume daily quota
- **WHEN** a FEEDBACK AI job is created
- **THEN** the daily cap counter is not incremented for MESOCYCLUS-type jobs
- **THEN** a subsequent MESOCYCLUS job creation is not affected by the feedback job count

### Requirement: Daily limit configuration is split by deployment mode
For managed-AI deployments, the daily cap SHALL be admin-configured only. For BYOM deployments, the daily cap SHALL be user-configurable with a system-defined fallback.

#### Scenario: Admin-configured limit (managed AI)
- **WHEN** the deployment uses a managed AI provider
- **THEN** the daily cap value is read from admin configuration
- **THEN** individual users cannot override it

#### Scenario: User-configured limit (BYOM)
- **WHEN** the deployment uses BYOM and the user has set a personal daily limit
- **THEN** the user's personal limit applies
- **THEN** if no personal limit is set, the system fallback applies

### Requirement: Daily limit resets at UTC midnight
The daily AI job count window SHALL reset at UTC 00:00:00, regardless of the server's local timezone.

#### Scenario: Count window is UTC-anchored
- **WHEN** the system counts AI jobs since the start of the current day
- **THEN** the start-of-day boundary is calculated as UTC midnight, not server-local midnight
