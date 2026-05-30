## ADDED Requirements

### Requirement: Dormant Managed Contract Fields
The system SHALL define managed-ready schema and config fields with disabled semantics in launch scope.

#### Scenario: Launch configuration
- **WHEN** launch BYOM mode is active
- **THEN** managed contract fields SHALL remain present but inactive

### Requirement: No Breaking Activation Path
The system SHALL enable future managed activation without breaking existing public API contracts.

#### Scenario: Future managed enablement
- **WHEN** managed mode is enabled in a future release
- **THEN** existing BYOM API consumers SHALL remain compatible without mandatory breaking migration

### Requirement: No Launch Managed UX References
The system SHALL not expose managed mode in launch user-facing settings or copy.

#### Scenario: Launch UI rendering
- **WHEN** launch version renders settings and messaging
- **THEN** managed-mode options and references SHALL be absent
