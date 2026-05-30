## ADDED Requirements

### Requirement: Domain Behavior Boundaries
The system SHALL enforce allowed and prohibited output classes for each domain agent.

#### Scenario: Agent response generation
- **WHEN** a domain agent generates a response
- **THEN** response content SHALL remain within that agent's allowed behavior classes

### Requirement: High-Risk Handoff to Sport Medic Path
The system SHALL route high-risk medical-safety contexts to sport medic strict-gate policy behavior.

#### Scenario: High-risk cue detected
- **WHEN** a fitness or diet interaction includes high-risk safety cues
- **THEN** the system SHALL trigger sport medic handoff and apply strict-gate behavior

### Requirement: Non-Diagnostic Sport Medic Scope
The system SHALL keep sport medic outputs in supportive safety-coach scope.

#### Scenario: Diagnostic request
- **WHEN** user requests diagnosis or treatment prescription
- **THEN** the system SHALL decline diagnostic scope and provide escalation-safe guidance
