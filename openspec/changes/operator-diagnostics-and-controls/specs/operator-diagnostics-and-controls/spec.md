## ADDED Requirements

### Requirement: Provider Runtime Diagnostics
The system SHALL expose minimum diagnostics for each provider path.

#### Scenario: Operator checks provider health
- **WHEN** operator queries diagnostics
- **THEN** system SHALL return provider status, last error class, and last successful run timestamp

### Requirement: Fallback and Verification Telemetry
The system SHALL record telemetry for fallback decisions and verification outcomes.

#### Scenario: Incident review
- **WHEN** operator reviews runtime incident
- **THEN** fallback decision reason and verification outcome context SHALL be available

### Requirement: Minimal Safe Controls
The system SHALL provide only minimal safety-focused controls for launch operations.

#### Scenario: Operational intervention
- **WHEN** operator performs supported control action
- **THEN** action SHALL be auditable and bounded to documented scope
