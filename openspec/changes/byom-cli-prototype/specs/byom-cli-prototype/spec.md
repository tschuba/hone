## ADDED Requirements

### Requirement: Prototype Decision Gate for CLI BYOM
The system SHALL complete a timeboxed prototype decision gate before enabling CLI-backed BYOM providers in launch scope.

#### Scenario: Prototype passes launch gates
- **WHEN** reliability, safety, and error-classification acceptance thresholds are all met
- **THEN** CLI-backed BYOM providers are eligible for launch architecture

#### Scenario: Prototype fails launch gates
- **WHEN** any hard blocker threshold is missed
- **THEN** launch scope MUST remain API-only BYOM and CLI support MUST be deferred

### Requirement: Transport-Agnostic Provider Runtime Contract
The system SHALL evaluate CLI and API providers through one transport-agnostic runtime contract.

#### Scenario: Mixed adapter invocation
- **WHEN** caller invokes primary and fallback providers
- **THEN** the invocation interface and caller control flow MUST remain identical regardless of adapter transport

### Requirement: Capability Handshake Before Runtime Selection
The system SHALL collect capability handshake metadata for each provider path before runtime fallback policy is applied.

#### Scenario: Provider capability probe
- **WHEN** a provider path is registered for prototype evaluation
- **THEN** the system MUST capture `non_interactive_supported`, `supports_structured_output`, `max_timeout_ms`, `auth_mode`, and `health_status`

### Requirement: Reason-Aware Single-Hop Fallback
The system SHALL use a single-hop fallback policy from primary to secondary provider based on classified error reason.

#### Scenario: Fallback-allowed error
- **WHEN** primary provider returns `quota_exceeded`, `rate_limited`, or `temporary_unavailable`
- **THEN** the system MUST attempt the configured secondary provider

#### Scenario: Fallback-blocking error
- **WHEN** primary provider returns `auth_invalid`, `misconfigured`, `policy_blocked`, or unknown/unmapped error
- **THEN** the system MUST NOT fallback and MUST return a blocking failure classification

### Requirement: CLI Execution Safety Controls
The system SHALL enforce CLI safety controls before CLI adapters are considered launch-eligible.

#### Scenario: CLI command execution
- **WHEN** CLI adapter executes a provider invocation
- **THEN** command MUST be allowlisted, use a fixed binary path, avoid shell interpolation, scrub environment variables, and enforce timeout with kill behavior

### Requirement: Transport-Independent Strict-Gate Safety
The system SHALL enforce identical Sport Medic strict-gate behavior across primary and fallback provider paths.

#### Scenario: High-risk request on fallback path
- **WHEN** fallback provider handles a high-risk safety prompt
- **THEN** abstain/escalation outcome MUST match strict-gate policy behavior from primary path

### Requirement: CLI Execution Placement Policy
The system SHALL default CLI execution to tenant-hosted backend worker topology and disallow browser-side CLI execution.

#### Scenario: Browser-originated request
- **WHEN** a request originates from browser/PWA runtime
- **THEN** direct CLI execution MUST be disallowed

#### Scenario: Local daemon profile
- **WHEN** local companion daemon mode is enabled in future scope
- **THEN** it MUST be treated as an optional deployment profile and MUST NOT be required for launch
