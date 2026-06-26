## ADDED Requirements

### Requirement: A user can edit their own template's title
The system SHALL allow a user to update the `title` of a `WorkoutTemplate`
belonging to one of their own mesocycluses, and SHALL reject the request if
the template does not belong to the requesting user.

#### Scenario: Owner updates a template's title
- **WHEN** a user submits a new title for a template belonging to their own
  mesocyclus
- **THEN** the system SHALL persist the new title

#### Scenario: Non-owner cannot edit a template's title
- **WHEN** a user submits a title update for a template that does not
  belong to one of their own mesocycluses
- **THEN** the system SHALL reject the request and SHALL NOT modify the
  template

### Requirement: A user can add an exercise to their own template
The system SHALL allow a user to add an existing global exercise to a
template they own, at a specified position, with its own `sets` and
`reps` or `durationSecs`, and SHALL NOT restrict which global exercise can
be added based on the template's muscle-group bucket.

#### Scenario: Owner adds an exercise
- **WHEN** a user adds an existing global exercise to their own template
  with valid sets/reps configuration
- **THEN** the system SHALL insert it at the specified position and SHALL
  renumber other exercises in that template as needed to keep positions
  dense and ordered

#### Scenario: Adding an exercise outside the template's usual muscle group is allowed
- **WHEN** a user adds a global exercise whose tags do not match the
  template's typical muscle-group bucket
- **THEN** the system SHALL accept the addition, since exercise selection
  for manual editing is not restricted by bucket

#### Scenario: Adding an exercise that would violate structural invariants is rejected
- **WHEN** adding an exercise would result in a template whose first
  exercise is not tagged warmup, whose last exercise is not tagged
  cooldown, or whose exercise lacks both reps and durationSecs
- **THEN** the system SHALL reject the request and SHALL NOT persist the
  addition

### Requirement: A user can remove an exercise from their own template
The system SHALL allow a user to remove an exercise from a template they
own, and SHALL reject the removal if the resulting exercise list would
violate the template's structural invariants.

#### Scenario: Owner removes an exercise
- **WHEN** a user removes an exercise from their own template and the
  remaining exercises still satisfy all structural invariants
- **THEN** the system SHALL remove it and renumber the remaining exercises
  to keep positions dense and ordered

#### Scenario: Removal that breaks warmup/cooldown placement is rejected
- **WHEN** removing an exercise would leave the template's first exercise
  not tagged warmup or its last exercise not tagged cooldown
- **THEN** the system SHALL reject the removal and SHALL NOT modify the
  template

#### Scenario: Removal below the minimum exercise count is rejected
- **WHEN** removing an exercise would leave a template with fewer than two
  exercises
- **THEN** the system SHALL reject the removal and SHALL NOT modify the
  template

### Requirement: A user can reorder exercises within their own template
The system SHALL allow a user to move an exercise one position earlier or
later within a template they own, and SHALL reject the move if the
resulting order would violate the template's structural invariants.

#### Scenario: Owner moves an exercise up or down
- **WHEN** a user moves an exercise one position earlier or later within
  their own template and the resulting order still satisfies all
  structural invariants
- **THEN** the system SHALL persist the new order

#### Scenario: Move that breaks warmup/cooldown placement is rejected
- **WHEN** moving an exercise would result in a first exercise not tagged
  warmup or a last exercise not tagged cooldown
- **THEN** the system SHALL reject the move and SHALL NOT modify the
  template's order

### Requirement: A user can edit an exercise's sets, reps/duration, and rest
The system SHALL allow a user to update `sets`, `reps` or `durationSecs`,
and `restSecsOverride` for one exercise within a template they own, subject
to the same numeric ranges enforced during plan generation, and SHALL
reject values outside those ranges.

#### Scenario: Owner edits an exercise's configuration within valid ranges
- **WHEN** a user updates an exercise's sets/reps/duration/rest within the
  valid ranges (sets 1-100, reps 1-1000, durationSecs 1-7200,
  restSecsOverride 0-7200)
- **THEN** the system SHALL persist the update

#### Scenario: Out-of-range values are rejected
- **WHEN** a user submits a sets/reps/duration/rest value outside its valid
  range
- **THEN** the system SHALL reject the request and SHALL NOT persist the
  update

#### Scenario: Missing both reps and duration is rejected
- **WHEN** a user submits an update that leaves an exercise with neither
  `reps` nor `durationSecs` set
- **THEN** the system SHALL reject the request and SHALL NOT persist the
  update

### Requirement: Template edits do not retroactively affect existing sessions
The system SHALL NOT modify any already-created `ExerciseLog` when a
template is edited; edits SHALL only affect sessions created from that
template after the edit.

#### Scenario: Editing a template does not change an in-progress session
- **WHEN** a user edits a template while a workout session created from
  that template is still active or already completed
- **THEN** the system SHALL leave that session's existing exercise logs
  unchanged

#### Scenario: A future session reflects the edited template
- **WHEN** a new workout session is created from a template after it has
  been edited
- **THEN** the system SHALL use the template's current, edited exercise
  list for that new session
