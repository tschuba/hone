## ADDED Requirements

### Requirement: Stable Provider Runtime Contract
The system SHALL expose a single transport-agnostic provider runtime contract for all BYOM adapters.

#### Scenario: Adapter invocation
- **WHEN** any provider adapter is invoked
- **THEN** the caller SHALL use the same invocation contract and response envelope

### Requirement: Classified Single-Hop Fallback
The system SHALL perform at most one fallback hop based on classified error reason.

#### Scenario: Fallback-eligible error
- **WHEN** primary returns a fallback-eligible class
- **THEN** the system SHALL invoke exactly one configured secondary provider

#### Scenario: Fallback-blocking error
- **WHEN** primary returns fallback-blocking or unknown class
- **THEN** the system SHALL not fallback and SHALL return blocking outcome

### Requirement: Runtime Breaker Enforcement
The system SHALL enforce circuit-breaker behavior when provider reliability thresholds are breached.

#### Scenario: Reliability degradation
- **WHEN** timeout/error thresholds exceed configured breaker limits
- **THEN** the provider path SHALL be temporarily opened (blocked) per breaker policy
