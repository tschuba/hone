## 1. Schema & Migration

- [ ] 1.1 Add nullable `sets` (`Int?`), `reps` (`Int?`), `durationSecs`
      (`Int?`, `@map("duration_seconds")`), `restSecsOverride` (`Int?`,
      `@map("rest_seconds_override")`), `groupId` (`String?`,
      `@map("group_id")`) to `ExerciseLog` in `apps/api/prisma/schema.prisma`
- [ ] 1.2 Generate and review the Prisma migration (additive only, no
      backfill, no change to `WorkoutTemplate`, `WorkoutTemplateExercise`,
      or the `WorkoutLabel` enum)

## 2. API: Session Creation

- [ ] 2.1 Update `WorkoutSessionService.createSession`
      (`apps/api/src/services/workout-session.service.ts`) to accept
      `templateId: string | null` and, when `null`, skip the template
      lookup entirely and create the session directly from the supplied
      exercise list
- [ ] 2.2 Update `WorkoutSessionRepository.createSession`
      (`apps/api/src/repositories/workout-session.repo.ts`) to accept and
      persist `sets`/`reps`/`durationSecs`/`restSecsOverride`/`groupId` per
      `exerciseLogs` entry, and to allow a `null` `templateId`/`mesocyclusId`
      on the created `WorkoutSession`
- [ ] 2.3 Update `createSessionBodySchema` and the route handler in
      `apps/api/src/routes/workout-session.routes.ts` to accept a nullable
      `templateId` and the new per-exercise fields, with validation (e.g.
      each ad-hoc entry requires at least `sets` with `reps` or
      `durationSecs`, mirroring the existing plan-validation invariant)
- [ ] 2.4 Add/update tests in
      `apps/api/src/routes/workout-session.routes.test.ts` covering: ad-hoc
      session creation with no `templateId`, per-exercise fields persisted
      correctly, existing templated-session creation unaffected

## 3. API: Active Session Read Path

- [ ] 3.1 Update `findActiveSession` in
      `apps/api/src/routes/workout.routes.ts` to stop returning `null` when
      `session.template` is absent; resolve each exercise's
      `sets`/`reps`/`restSecs`/`durationSecs` from the `ExerciseLog`'s own
      columns when there is no matching `templateExercise`, and from the
      template when there is (extract this branching into a small,
      independently testable helper per design.md's risk mitigation)
- [ ] 3.2 Add `groupId` to the `ActiveWorkoutExercise` projection for both
      the templated and ad-hoc resolution branches
- [ ] 3.3 Add/update tests in `apps/api/src/routes/workout.routes.test.ts`
      covering: ad-hoc session returned as the active workout, ad-hoc
      session resume after restart, templated sessions unaffected

## 4. Web: Offline Queue & API Client

- [ ] 4.1 Extend `PendingSessionCreateOp.payload` in
      `apps/web/src/lib/db/offline-store.ts` to carry a nullable
      `templateId` and the new per-exercise fields
- [ ] 4.2 Update `flushOp`'s replay call in `apps/web/src/lib/sync.ts` and
      `startSession` in `apps/web/src/lib/api.ts` to pass the new fields
      through unchanged
- [ ] 4.3 Add `groupId: string | null` to `ActiveWorkoutExercise` — its
      `sets`/`reps`/`durationSecs`/`restSecs` fields already exist and need
      no change. Separately, make `ActiveWorkout`'s `active_session`
      variant's `templateId`/`templateLabel` nullable (`templateTitle` is
      already nullable) so a resumed offline ad-hoc session — which has no
      template at all — can be represented and rendered without a round
      trip
- [ ] 4.4 Add/update tests in `apps/web/src/lib/sync.test.ts` and
      `apps/web/src/lib/db/offline-store.test.ts` covering: queuing an
      ad-hoc session creation offline, replaying it on reconnect, existing
      templated-session queue/replay behavior unaffected

## 5. Web: Exercise Picker UI

- [ ] 5.1 Add a new web route for assembling an ad-hoc session, reusing the
      `request<T>()` client pattern (`apps/web/src/lib/api.ts`) and the
      form/validation/error-handling patterns from
      `apps/web/src/routes/onboarding/+page.svelte`
- [ ] 5.2 Build a searchable/filterable exercise picker over `GET /exercises`
      that only lists existing global exercises (no create-exercise entry
      point)
- [ ] 5.3 Let the user configure `sets` and `reps`/`durationSecs` and rest
      per selected exercise
- [ ] 5.4 Add up/down move controls to reorder selected exercises before
      starting (no drag-and-drop dependency, per design.md)
- [ ] 5.5 Wire the assembled list to session creation via the existing
      offline-fallback start-session flow, mirroring the pattern in
      `apps/web/src/routes/workout/+page.svelte`'s use of
      `logSetWithOfflineFallback`/`completeWorkoutWithOfflineFallback`

## 6. Tests & Verification

- [ ] 6.1 End-to-end check: assemble and start an ad-hoc session online,
      confirm it appears as the active workout, log sets, complete it, and
      confirm history/analytics show it like any other session
- [ ] 6.2 End-to-end check: assemble and start an ad-hoc session while
      offline, confirm it queues and replays correctly on reconnect
- [ ] 6.3 Confirm existing templated-session creation, active-session
      lookup, and offline queue/replay tests all still pass unchanged
- [ ] 6.4 Run `bun run lint` and fix any issues before considering the
      change complete, per repository convention
