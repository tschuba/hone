## ADDED Requirements

### Requirement: A user can assemble and start an ad-hoc workout session
The system SHALL allow a user to select one or more existing global
exercises, specify per-exercise `sets`, `reps` or `durationSecs`, and a rest
duration, arrange them in order, and start a workout session from that
selection without referencing any `WorkoutTemplate`.

#### Scenario: Session starts from a hand-picked exercise list
- **WHEN** a user selects exercises from the existing global exercise
  catalog, configures sets/reps/rest for each, and starts the session
- **THEN** the system SHALL create a workout session whose exercises match
  the selection and configuration, with no `WorkoutTemplate` reference

#### Scenario: Selected exercises can be reordered before starting
- **WHEN** a user has selected two or more exercises and changes their
  order before starting the session
- **THEN** the system SHALL start the session with exercises in the
  user's chosen order

#### Scenario: Picker only offers existing global exercises
- **WHEN** a user searches the exercise picker
- **THEN** the system SHALL only offer exercises from the existing global
  exercise catalog, and SHALL NOT offer an option to create a new exercise

### Requirement: Per-exercise configuration is resolved without a template
The system SHALL store each ad-hoc session exercise's `sets`, `reps`,
`durationSecs`, `restSecsOverride`, and `groupId` directly on its own
exercise log entry, and SHALL resolve these values from the entry itself
when no matching template exercise exists, rather than requiring a
template-backed value.

#### Scenario: Ad-hoc exercise resolves its own configuration
- **WHEN** an active session's exercise has no matching template exercise
- **THEN** the system SHALL resolve that exercise's `sets`, `reps`,
  `durationSecs`, and rest duration from its own stored values

#### Scenario: Templated exercises are unaffected
- **WHEN** an active session's exercise does have a matching template
  exercise
- **THEN** the system SHALL resolve that exercise's configuration from the
  template exactly as it does today, regardless of the new per-exercise
  columns existing on the schema

### Requirement: Ad-hoc sessions are visible through the active-session lookup
The system SHALL include a session with no `WorkoutTemplate` reference in
the active-session lookup used to display and resume the current workout,
rather than treating the absence of a template as "no active session."

#### Scenario: Ad-hoc session is returned as the active workout
- **WHEN** a user has a started, incomplete ad-hoc session and requests
  their active workout
- **THEN** the system SHALL return that session's exercises and progress,
  not an empty or "no active session" result

#### Scenario: Ad-hoc session can be resumed after interruption
- **WHEN** a user resumes an in-progress ad-hoc session (e.g. after an app
  restart)
- **THEN** the system SHALL restore the session's per-exercise progress
  using the same resolution rules as during the original session

### Requirement: Ad-hoc session creation queues and replays offline
The system SHALL support starting an ad-hoc session while offline by
queuing its creation, and SHALL replay that queued creation on reconnect
using the same mechanism already used for templated session creation.

#### Scenario: Ad-hoc session creation queues while offline
- **WHEN** a user starts an ad-hoc session while the backend is unavailable
- **THEN** the system SHALL queue the session creation, including its
  per-exercise configuration and the absence of a template reference, and
  SHALL present the session as usable locally pending sync

#### Scenario: Queued ad-hoc session creation replays on reconnect
- **WHEN** connectivity is restored with a queued ad-hoc session creation
  pending
- **THEN** the system SHALL replay that creation using the same idempotent
  replay contract used for templated session creation

### Requirement: A groupId on an ad-hoc exercise degrades safely without the alternating-sets runtime
The system SHALL allow an ad-hoc session exercise to carry a `groupId` and
SHALL execute that session sequentially, exercise by exercise, when the
alternating-group runtime is not present, rather than rejecting the session
or behaving unpredictably.

#### Scenario: groupId is stored but executed sequentially
- **WHEN** an ad-hoc session is created with two exercises sharing a
  `groupId` and the alternating-group runtime walker is not available
- **THEN** the system SHALL store the `groupId` on each exercise and SHALL
  run the session's exercises sequentially, one at a time, as it does for
  ungrouped exercises today
