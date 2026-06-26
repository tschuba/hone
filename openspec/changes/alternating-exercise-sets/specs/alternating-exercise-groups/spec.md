## ADDED Requirements

### Requirement: Exercises can be linked into an alternating group
The system SHALL support marking two or more exercises within the same
workout template or session as one alternating group via a shared, optional
`groupId`, without altering the uniqueness of each exercise's own `position`.

#### Scenario: Two exercises share a group
- **WHEN** a workout template defines two exercises with the same `groupId`
- **THEN** the system SHALL treat them as members of one alternating group
  while each retains its own distinct `position`

#### Scenario: Absent groupId preserves existing sequential behavior
- **WHEN** an exercise has no `groupId`
- **THEN** the system SHALL treat it as an ungrouped, single-member unit and
  execute it exactly as it does today, fully sequentially relative to
  adjacent exercises

#### Scenario: A group must have at least two members
- **WHEN** a plan or template assigns a `groupId` to only one exercise
- **THEN** the system SHALL reject the plan as invalid

### Requirement: Plan validation enforces group structural invariants
The shared plan validation schema SHALL require that members of a group
appear contiguously within a workout's exercise list and SHALL reject groups
that violate this. These checks SHALL be evaluated independently per
workout — a `groupId` value has no meaning across different workouts in the
same plan, and group-size, contiguity, and warmup/cooldown checks SHALL each
be scoped to a single workout's own `exercises` array.

#### Scenario: Contiguous group members are accepted
- **WHEN** a workout's exercises array places all members of a `groupId`
  next to each other
- **THEN** validation SHALL accept the plan

#### Scenario: Non-contiguous group members are rejected
- **WHEN** a workout's exercises array places members of the same `groupId`
  with one or more non-member exercises between them
- **THEN** validation SHALL reject the plan with an explanatory error

#### Scenario: Identical groupId values in different workouts are independent
- **WHEN** two different workouts within the same plan each contain a group
  using the same literal `groupId` string value
- **THEN** validation SHALL treat each workout's group independently and
  SHALL NOT consider this a cross-workout conflict

### Requirement: Groups exclude the workout's warmup and cooldown exercise
The system SHALL reject a plan where a group includes the workout's first
exercise (the warmup) or last exercise (the cooldown), consistent with the
existing requirement that the first and last exercises be the warmup and
cooldown respectively.

#### Scenario: Group including the warmup exercise is rejected
- **WHEN** a workout's exercise group includes the exercise at array index
  `0`
- **THEN** validation SHALL reject the plan with an explanatory error

#### Scenario: Group including the cooldown exercise is rejected
- **WHEN** a workout's exercise group includes the exercise at the last
  array index
- **THEN** validation SHALL reject the plan with an explanatory error

### Requirement: Runtime executes an alternating group via round-robin over active members
During an active workout session, the system SHALL advance turns within a
group by cycling through members whose completed sets are below their own
target (active members), in ascending order of each member's own `position`
(their stable group order), and SHALL consider the group complete only once
no member remains active.

#### Scenario: Equal-target members alternate every turn
- **WHEN** two group members each have a target of 4 sets and neither has
  reached it
- **THEN** the system SHALL alternate the active turn between them after
  each logged set

#### Scenario: A member that reaches its target drops out of rotation
- **WHEN** one group member reaches its own `sets` target while another
  member has not
- **THEN** the system SHALL remove the completed member from the turn
  rotation and continue advancing turns only among remaining active members

#### Scenario: Group completes only when all members are done
- **WHEN** the last remaining active member of a group logs its final set
- **THEN** the system SHALL mark the group complete and advance to the next
  position or group in the workout, rather than waiting on any
  already-completed member

### Requirement: Inter-turn rest is controlled by each member's own rest setting
The system SHALL use each group member's own `restSecsOverride` to decide
whether to present a rest interval after that member's set before switching
turn, consistent with how rest is already configured for ungrouped
exercises.

#### Scenario: Zero rest switches turn immediately
- **WHEN** a group member's `restSecsOverride` is `0` and that member just
  completed a set
- **THEN** the system SHALL switch to the next active member's turn
  immediately without presenting a rest interval

#### Scenario: Nonzero rest is shown before switching turn
- **WHEN** a group member's `restSecsOverride` is greater than `0` and that
  member just completed a set, and at least one other member remains active
- **THEN** the system SHALL present a rest interval of that duration before
  switching to the next active member's turn

#### Scenario: Group-completion rest matches existing single-exercise behavior
- **WHEN** the final set of the last active group member is logged and the
  group becomes complete
- **THEN** the system SHALL present rest using that member's own
  `restSecsOverride` before advancing to the next position or group, the
  same as today's behavior when a single ungrouped exercise's last set is
  logged

### Requirement: Offline resume deterministically reconstructs whose turn is next
The system SHALL deterministically recompute, on app restart, reconnect, or
any other resume of an active workout session, which group member's turn is
next using only each member's `completedSets`, without relying on any
separately persisted turn-state field.

#### Scenario: Resume picks the most-behind active member
- **WHEN** a workout session resumes with an active group whose members have
  differing `completedSets` among those still active
- **THEN** the system SHALL set the next turn to the active member with the
  fewest `completedSets`

#### Scenario: Resume ties are broken by stable group order
- **WHEN** a workout session resumes with an active group whose active
  members have equal `completedSets`
- **THEN** the system SHALL set the next turn to the active member with the
  lowest `position` value among those tied
