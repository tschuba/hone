## ADDED Requirements

### Requirement: Verification Before Response
The system SHALL run verification checks before emitting user-visible AI responses.

#### Scenario: Generated response received
- **WHEN** generation output is available
- **THEN** the system SHALL run claim/evidence verification before response delivery

### Requirement: Strict-Gate Outcome Authority
The system SHALL enforce strict-gate policy outcomes independent of provider origin.

#### Scenario: Strict-gate violation
- **WHEN** verification fails strict-gate policy
- **THEN** the system SHALL abstain or escalate according to policy regardless of provider confidence

### Requirement: Verified Freshness Requirement
The system SHALL require freshness checks for time-sensitive claims.

#### Scenario: Stale evidence
- **WHEN** supporting evidence exceeds allowed freshness window
- **THEN** the claim SHALL be rejected or downgraded per policy
