## ADDED Requirements

### Requirement: Source Trust Threshold Enforcement
The system SHALL enforce minimum trust thresholds before retrieved sources are used as verification evidence.

#### Scenario: Low-trust source retrieved
- **WHEN** source trust score is below policy threshold
- **THEN** the source SHALL be excluded from evidence set

### Requirement: Freshness Policy Enforcement
The system SHALL enforce freshness windows for time-sensitive evidence categories.

#### Scenario: Evidence out of date
- **WHEN** source age exceeds configured freshness window
- **THEN** the source SHALL be marked stale and excluded or downgraded per policy

### Requirement: Contradiction Handling
The system SHALL apply contradiction handling rules when evidence sources materially disagree.

#### Scenario: Conflicting evidence set
- **WHEN** accepted sources contain unresolved contradiction
- **THEN** the system SHALL trigger downgrade, abstain, or escalation outcome per policy
