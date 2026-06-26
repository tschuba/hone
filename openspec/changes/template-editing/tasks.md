## 1. Shared Validation Extraction

- [ ] 1.1 Create `packages/shared/src/template-validation.ts` exporting
      pure functions operating on a plain exercise array. Three are
      genuinely extracted from `validatePlan()`'s existing imperative code:
      warmup-first check, cooldown-last check, reps-or-duration-required
      check. Two are new, freestanding functions with no existing
      imperative equivalent to extract (today they're declarative AJV
      schema properties, not standalone code): minimum-exercise-count
      check, and numeric-range checks (`sets` 1-100, `reps` 1-1000,
      `durationSecs` 1-7200, `restSecsOverride` 0-7200) — mirror the same
      bound values AJV already enforces
- [ ] 1.2 Update `validatePlan` in `packages/shared/src/plan-validation.ts`
      to call the three genuinely-extracted functions (warmup-first,
      cooldown-last, reps-or-duration) instead of duplicating that logic
      inline. Do **not** wire the new minItems/numeric-range functions into
      `validatePlan` — AJV already enforces those for the full-plan path,
      and routing them through the new functions too would either
      duplicate enforcement or change `validatePlan`'s existing
      AJV-formatted error messages for no benefit
- [ ] 1.3 Confirm `packages/shared/src/plan-validation.test.ts` still
      passes unchanged after the extraction (pure refactor, no behavior
      change)
- [ ] 1.4 Add unit tests for the new `template-validation.ts` functions
      directly, independent of `validatePlan`

## 2. API: Template Repository & Service

- [ ] 2.1 Add a template repository (new file or extend
      `apps/api/src/repositories/workout-session.repo.ts`) with an
      ownership-scoped lookup mirroring `findTemplateForUser`, but
      including each exercise's tags
      (`exercises: { include: { exercise: { include: { tags: { include: { tag: true } } } } } }`)
      so warmup/cooldown checks have the data they need
- [ ] 2.2 Add a template service wrapping the repository in
      `$transaction` calls (mirroring `WorkoutSessionService`'s pattern),
      implementing: update title; insert exercise at position; remove
      exercise; move exercise up/down; update exercise
      sets/reps/duration/rest
- [ ] 2.3 Each mutation method: load the full current exercise list (with
      tags), apply the single mutation in memory, recompute dense
      `position` values for the whole list, run the result through
      `template-validation.ts`, and persist (writing back every changed
      `position`) only if valid — otherwise throw/return a validation error
      without persisting anything
- [ ] 2.4 Add service-level unit tests covering: valid add/remove/move/edit,
      rejected add/remove/move that would break warmup/cooldown placement,
      rejected removal below minimum exercise count, rejected out-of-range
      edits, rejected mutation on a template not owned by the requesting
      user

## 3. API: Routes

- [ ] 3.1 Add `PATCH /templates/:templateId` (title) to a new
      `apps/api/src/routes/template.routes.ts`, following
      `apps/api/src/routes/equipment.routes.ts`'s auth-guard and
      error-response shape
- [ ] 3.2 Add `POST /templates/:templateId/exercises` (insert)
- [ ] 3.3 Add `PUT /templates/:templateId/exercises/:exerciseId` (edit
      sets/reps/duration/rest)
- [ ] 3.4 Add `DELETE /templates/:templateId/exercises/:exerciseId`
      (remove)
- [ ] 3.5 Add `POST /templates/:templateId/exercises/:exerciseId/move`
      (`{ direction: "up" | "down" }`)
- [ ] 3.6 Add/update route-level tests in
      `apps/api/src/routes/template.routes.test.ts` covering each endpoint's
      success and rejection cases (404 for non-owned template, 400 for
      validation failures)
- [ ] 3.7 Confirm existing `apps/api/src/routes/workout.routes.test.ts` and
      `apps/api/src/routes/plan.routes.test.ts` still pass unchanged —
      this change adds a new mutation path, it does not alter generation
      or the active-session read path

## 4. Web: Template Editing UI

- [ ] 4.1 Add a template-editing entry point (e.g. from the existing plan
      page, `apps/web/src/routes/plan/+page.svelte`) for the user's active
      mesocyclus's templates
- [ ] 4.2 Build a title-edit control wired to `PATCH /templates/:templateId`
- [ ] 4.3 Reuse the exercise-picker component being built for
      `manual-workout-builder` to add an exercise to a template, wired to
      `POST /templates/:templateId/exercises`
- [ ] 4.4 Add per-exercise sets/reps/duration/rest edit controls wired to
      `PUT /templates/:templateId/exercises/:exerciseId`
- [ ] 4.5 Add remove and up/down move controls wired to their respective
      endpoints, with inline error display when a mutation is rejected
      (e.g. "can't remove the only cooldown exercise")
- [ ] 4.6 Add client-side API methods to `apps/web/src/lib/api.ts` for all
      five endpoints, following the existing `request<T>()` pattern

## 5. Tests & Verification

- [ ] 5.1 End-to-end check: edit a template's title, add an exercise outside
      its usual muscle-group bucket, edit an exercise's sets/reps, reorder
      exercises, remove an exercise — confirm each persists and a
      subsequent session created from that template reflects the changes
- [ ] 5.2 End-to-end check: attempt to remove the warmup or cooldown
      exercise, attempt to reduce a template below two exercises, attempt
      an out-of-range sets/reps/rest edit — confirm each is rejected with
      no partial persistence
- [ ] 5.3 Confirm an already-active or already-completed session's
      exercise logs are unaffected by a template edit made afterward
- [ ] 5.4 Run `bun run lint` and fix any issues before considering the
      change complete, per repository convention
