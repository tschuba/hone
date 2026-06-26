## ADDED Requirements

### Requirement: A user can create their own private exercise
The system SHALL allow a user to create an `Exercise` owned by themselves
(`isGlobal: false`, `ownerId` set to the requesting user) with a required
name and optional description and suggested rest duration, and SHALL NOT
provide any path for that exercise to become globally shared.

#### Scenario: User creates a custom exercise
- **WHEN** a user submits a name and at least one muscle-group tag and one
  category tag
- **THEN** the system SHALL create a private exercise owned by that user

#### Scenario: Created exercise is never global
- **WHEN** a custom exercise is created
- **THEN** the system SHALL set `isGlobal` to false and SHALL NOT expose any
  mechanism to change it in this capability

### Requirement: Creating an exercise requires explicit muscle-group and category tags
The system SHALL require at least one muscle-group tag and exactly one
category tag, selected from existing tag values, when creating a custom
exercise, and SHALL reject creation if either is missing, since no
automatic inference of these tags is available.

#### Scenario: Creation without a muscle-group tag is rejected
- **WHEN** a user submits a custom exercise with no muscle-group tag
  selected
- **THEN** the system SHALL reject the request and SHALL NOT create the
  exercise

#### Scenario: Creation without a category tag is rejected
- **WHEN** a user submits a custom exercise with no category tag selected
- **THEN** the system SHALL reject the request and SHALL NOT create the
  exercise

#### Scenario: Tag options are sourced from existing tag values
- **WHEN** a user requests the available tag options for the creation form
- **THEN** the system SHALL return values from existing tag records rather
  than an arbitrary or hardcoded set

### Requirement: Custom exercises automatically receive heuristic safety tags
The system SHALL automatically derive modifier safety tags (e.g. for knee
or back loading) from a custom exercise's name at creation time, using the
same heuristic tagging already applied to the global exercise catalog.

#### Scenario: Name matching a safety pattern is tagged automatically
- **WHEN** a user creates a custom exercise whose name matches an existing
  modifier heuristic pattern
- **THEN** the system SHALL attach the corresponding modifier tag without
  requiring the user to select it manually

### Requirement: Custom exercises are visible only to their owner's pickers
The system SHALL include a user's own custom exercises, alongside global
exercises, when that user lists available exercises for manual selection,
and SHALL NOT include another user's custom exercises.

#### Scenario: Owner sees their own custom exercise in the picker
- **WHEN** a user lists available exercises after creating a custom one
- **THEN** the system SHALL include that custom exercise in the results

#### Scenario: Other users do not see someone else's custom exercise
- **WHEN** a different user lists available exercises
- **THEN** the system SHALL NOT include the first user's custom exercise in
  their results

### Requirement: Custom exercises do not affect automatic plan generation
The system SHALL exclude custom exercises from the automatic plan
generator's candidate pool, so creating one never changes what the rule
engine selects for a user's generated plans.

#### Scenario: Generated plans never include a custom exercise
- **WHEN** a user with one or more custom exercises generates a new plan
- **THEN** the system SHALL select exercises only from the global exercise
  catalog, never from that user's custom exercises

### Requirement: A user can soft-delete their own custom exercise
The system SHALL allow a user to delete their own custom exercise, SHALL
preserve the underlying record and any exercise logs referencing it, and
SHALL exclude the deleted exercise from future listings.

#### Scenario: Owner deletes their custom exercise
- **WHEN** a user deletes a custom exercise they own
- **THEN** the system SHALL mark it deleted and SHALL exclude it from
  subsequent exercise listings for that user

#### Scenario: Deletion preserves existing exercise logs
- **WHEN** a custom exercise that has already been logged in a past session
  is deleted
- **THEN** the system SHALL leave the existing exercise log referencing it
  unchanged and readable

#### Scenario: Non-owner cannot delete another user's custom exercise
- **WHEN** a user attempts to delete a custom exercise they do not own
- **THEN** the system SHALL reject the request and SHALL NOT delete it

#### Scenario: Global exercises cannot be deleted through this capability
- **WHEN** a user attempts to delete a global exercise
- **THEN** the system SHALL reject the request and SHALL NOT delete it
