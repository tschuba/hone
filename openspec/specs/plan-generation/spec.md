## ADDED Requirements

### Requirement: Plan generation produces varied exercise selection across mesocyclus generations
The system SHALL use a seeded shuffle when selecting exercises for a generated plan so that successive mesocyclus plans differ in exercise selection.

#### Scenario: Two back-to-back plans have different exercise selections
- **WHEN** two mesocyclus plans are generated sequentially for the same user and equipment profile
- **THEN** the exercise selections SHALL differ with high probability (i.e. different seeds produce different orderings)

#### Scenario: Same seed reproduces the same plan
- **WHEN** a mesocyclus plan is generated with an explicit seed value
- **THEN** generating again with the same seed SHALL produce identical exercise selections

### Requirement: Shuffle is applied independently per session bucket
The system SHALL shuffle each session bucket (A / B / C) independently before exercise selection so that variety is not correlated across sessions.

#### Scenario: Each session draws from its own independently shuffled pool
- **WHEN** a mesocyclus plan is generated
- **THEN** Session A, B, and C each draw from independently shuffled versions of their respective muscle-group buckets

### Requirement: Shuffled selection preserves structural correctness
The system SHALL preserve the exercise count and bucket-membership constraints after shuffling.

#### Scenario: Session contains exactly 4 exercises
- **WHEN** a mesocyclus plan is generated
- **THEN** each session template SHALL contain exactly 4 exercises (warmup, main × 2, cooldown)

#### Scenario: No cross-bucket contamination
- **WHEN** a mesocyclus plan is generated
- **THEN** a session's exercises SHALL all belong to that session's designated muscle-group bucket (e.g. a Push session SHALL NOT contain back exercises)
