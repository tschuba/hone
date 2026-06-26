## Why

Today every workout is a strict sequence of isolated exercise blocks: a user
must finish all sets of Exercise A before starting Exercise B. There is no
way to alternate sets between two or more exercises in the same slot (e.g. 4
alternating sets of Biceps Curl and Triceps Pressdown instead of 4 sets of
each done back-to-back), which is a common way to keep antagonist muscle
groups in training balance and a capability the product has no path to
support at any layer today.

## What Changes

- Add a nullable `groupId` to `WorkoutTemplateExercise` and `ExerciseLog` so
  two or more exercises in the same workout slot can be marked as one
  alternating unit, without disturbing existing `position` ordering or
  matching logic.
- Extend the shared `MesocyclusPlan`/`MesocyclusExercise` validation schema
  (`packages/shared/src/plan-validation.ts`) with an optional `groupId` and
  invariants (group members contiguous, group size ≥ 2).
- Rework the active-workout runtime walker
  (`apps/web/src/lib/context/workout-session.svelte.ts`,
  `apps/web/src/routes/workout/+page.svelte`) from a flat `currentIndex`
  walk to a `whoseTurn` pointer that round-robins across a group's active
  (not-yet-complete) members, reusing each member's existing
  `restSecsOverride` to decide whether to rest between turns.
- Generalize offline resume so the runtime can correctly determine whose
  turn is next within a group after an app restart or reconnect, with no
  changes to the existing offline queue/replay contract.
- Out of scope for this change, explicitly: the rule-based plan generator
  (`rule-engine.service.ts`) is not modified and will not auto-detect or
  auto-pair antagonist muscle groups; no antagonist-pair data modeling (e.g.
  a `Tag` self-relation) is introduced; no manual plan/template editor or
  custom-exercise creation UI is built (none exists today); the AI-generated
  plan path is not modified since `async-ai-plan-optimisation` has not
  shipped yet. This change ships the underlying mechanism only — a future
  manual editor and/or the AI-generated path can consume it later.

## Capabilities

### New Capabilities
- `alternating-exercise-groups`: Defines how two or more exercises can be
  grouped into one alternating unit at the schema/validation level, and the
  runtime contract for executing, resting within, and resuming an
  alternating group during an active workout session.

### Modified Capabilities
(none — `plan-generation` and `offline-workout-resilience` requirements are
unchanged; this change adds a new capability layered on top of both without
altering their existing behavior)

## Impact

- **Schema**: `apps/api/prisma/schema.prisma` — additive nullable `groupId`
  column on `WorkoutTemplateExercise` and `ExerciseLog`; new migration.
- **Shared validation**: `packages/shared/src/plan-validation.ts` —
  `MesocyclusExercise`/schema gains optional `groupId` and group invariants.
- **API**: `apps/api/src/repositories/workout-session.repo.ts` (copy
  `groupId` onto `ExerciseLog` at session creation),
  `apps/api/src/routes/workout.routes.ts` (project `groupId` into
  `ActiveWorkoutExercise`), `apps/api/src/services/workout-session.service.ts`
  (no behavior change expected, verify substitution still scopes correctly
  per exercise).
- **Web runtime**: `apps/web/src/lib/context/workout-session.svelte.ts`,
  `apps/web/src/routes/workout/+page.svelte`,
  `apps/web/src/lib/components/ExerciseRow.svelte`,
  `apps/web/src/lib/api.ts` (`ActiveWorkoutExercise` type).
- **Unaffected**: `apps/api/src/services/rule-engine.service.ts` (explicitly
  unchanged), AI plan generation/prompting (not yet built), any
  plan/template editor UI (does not exist).
