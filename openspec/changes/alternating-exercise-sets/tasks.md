## 1. Schema & Migration

- [ ] 1.1 Add nullable `groupId` (`String?`, `@map("group_id")`) to
      `WorkoutTemplateExercise` in `apps/api/prisma/schema.prisma`
- [ ] 1.2 Add nullable `groupId` (`String?`, `@map("group_id")`) to
      `ExerciseLog` in `apps/api/prisma/schema.prisma`
- [ ] 1.3 Generate and review the Prisma migration (additive only, no
      backfill, no default change to existing rows)

## 2. Shared Plan Validation

- [ ] 2.1 Add optional `groupId` to `MesocyclusExercise` in
      `packages/shared/src/plan-validation.ts` and to the corresponding AJV
      schema property definitions
- [ ] 2.2 Add a validation check in `validatePlan` that rejects a `groupId`
      used by fewer than two exercises within the same workout (checked
      against that workout's own `exercises` array only — a `groupId` has no
      meaning across different workouts in the same plan)
- [ ] 2.3 Add a validation check in `validatePlan` that rejects group
      members that are not contiguous within a workout's `exercises` array
- [ ] 2.4 Add a validation check in `validatePlan` that rejects a group
      containing the workout's first exercise (index `0`, the warmup) or
      last exercise (the cooldown)
- [ ] 2.5 Add/update unit tests in `packages/shared/src/plan-validation.test.ts`
      covering: valid contiguous group, single-member group rejected,
      non-contiguous group rejected, group including warmup/cooldown
      rejected, identical `groupId` in two different workouts treated
      independently (not a conflict), ungrouped plans unaffected

## 3. API: Session Creation & Active Workout Projection

- [ ] 3.1 Update `WorkoutSessionRepository.createSession` in
      `apps/api/src/repositories/workout-session.repo.ts` to copy
      `groupId` from the source exercise list onto each created
      `ExerciseLog`
- [ ] 3.2 Update the `exerciseLogs` input type on
      `WorkoutSessionService.createSession` and its route schema in
      `apps/api/src/routes/workout-session.routes.ts` to accept an optional
      `groupId` per entry
- [ ] 3.3 Update `apps/api/src/routes/workout.routes.ts` to project
      `groupId` into `ActiveWorkoutExercise` for both the `active_session`
      and `planned` response branches
- [ ] 3.4 Add/update tests in `apps/api/src/routes/workout.routes.test.ts`
      and `apps/api/src/routes/workout-session.routes.test.ts` covering
      `groupId` round-tripping from session creation through to the active
      workout payload
- [ ] 3.5 Verify `WorkoutSessionService.substituteExercise` continues to
      operate correctly on a single grouped `ExerciseLog` (group membership
      via `groupId` is untouched by substitution; add a regression test)

## 4. Web: Shared Types & Runtime Walker

- [ ] 4.1 Add `groupId: string | null` to `ActiveWorkoutExercise` in
      `apps/web/src/lib/api.ts`
- [ ] 4.2 Implement pure helper functions (independently unit-testable, not
      coupled to Svelte component state) for: computing active members of a
      group, advancing `whoseTurn` to the next active member, and resolving
      `whoseTurn` on resume (fewest `completedSets`, ties broken by stable
      group order)
- [ ] 4.3 Replace the flat `currentIndex` advance logic in
      `apps/web/src/routes/workout/+page.svelte` (`moveToNextExercise`,
      `handleSetDone`, `loadWorkout`) with the `whoseTurn`-based walker,
      preserving exact existing behavior for ungrouped (single-member group)
      exercises
- [ ] 4.4 Wire per-member rest to control whether the rest screen is shown
      between turns within a group (skip entirely when `0`) versus
      group-completion rest (unchanged existing behavior). Note the field
      the walker actually reads is `currentExercise.restSecs` (the value
      already resolved server-side from `restSecsOverride` via
      `resolveRestSecs()` in `workout.routes.ts`), not `restSecsOverride`
      itself — `+page.svelte` never sees the raw override field
- [ ] 4.5 Update `apps/web/src/lib/context/workout-session.svelte.ts` if its
      `currentExerciseIndex` state needs to track turn position instead of
      a flat index

## 5. Web: UI Display

- [ ] 5.1 Update `apps/web/src/lib/components/ExerciseRow.svelte` (or its
      usage in `+page.svelte`) to show "(alternating with <partner name>)"
      when an exercise has a `groupId`, and to mark the active turn's row
- [ ] 5.2 Update accessibility announcement text in `+page.svelte` to
      reflect whose turn it is when grouped, consistent with existing
      announcement patterns

## 6. Tests & Verification

- [ ] 6.1 Add web-side tests for the pure walker helpers covering: 2-member
      equal-`sets` alternation, 3+-member circuits, unequal-`sets` dropout,
      zero-rest immediate turn switch, group completion using the
      last-finished member's `restSecsOverride`
- [ ] 6.2 Add resume tests covering: resume mid-round with differing
      `completedSets` among active members, resume with a tie, resume after
      a member has already dropped out of rotation
- [ ] 6.3 Confirm existing ungrouped-exercise tests (session walker, offline
      resume, rest timer) still pass unchanged, since ungrouped exercises
      are the one-member-group degenerate case
- [ ] 6.4 Run `bun run lint` and fix any issues before considering the
      change complete, per repository convention
