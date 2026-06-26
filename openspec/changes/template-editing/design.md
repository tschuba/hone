## Context

`WorkoutTemplate`/`WorkoutTemplateExercise` rows are created once, inside
the rule engine's generation transaction (`apps/api/src/routes/plan.routes.ts`),
and never mutated afterward. `WorkoutLabel` is a fixed `A | B | C` enum with
a `@@unique([mesocyclusId, position])` constraint on `WorkoutTemplate` —
exactly one template per position, no way to add or remove a template.
`ExerciseLog` rows snapshot a template's exercises at session-creation time
and never re-read the template afterward (confirmed in
`apps/api/src/repositories/workout-session.repo.ts`'s `createSession`),
so editing a template is safe regardless of whether a session created from
it is currently active, completed, or in the future rotation — only future
session creations see the edit.

`packages/shared/src/plan-validation.ts`'s `validatePlan()` validates a
whole `MesocyclusPlan` JSON blob in one pass: `exercises[0]` must be tagged
`CATEGORY:warmup`, `exercises.at(-1)` must be tagged `CATEGORY:cooldown`,
each workout needs `minItems: 2` exercises, and every exercise needs `reps`
or `durationSecs`. Its AJV schema also enforces numeric ranges (`sets`
1-100, `reps` 1-1000, `durationSecs` 1-7200, `restSecsOverride` 0-7200).
None of this is currently reusable against a single already-persisted
`WorkoutTemplateExercise` list outside of full-plan validation.

## Goals / Non-Goals

**Goals:**
- Let a user mutate one of their active mesocyclus's existing templates:
  edit `title`; add, remove, and reorder exercises; edit each exercise's
  `sets`/`reps`/`durationSecs`/`restSecsOverride`.
- Enforce the same structural and numeric-range invariants the rule engine
  already enforces at generation time, from one shared source of truth.
- Keep this safe under the existing rotation/session-snapshot model with no
  new risk to in-progress or historical sessions.

**Non-Goals:**
- No adding, removing, or relabeling templates — `WorkoutLabel` stays fixed
  to `A | B | C`, one template per position.
- No `groupId`/alternating-group authoring — deferred until
  `alternating-exercise-sets` is implemented; this change ships basic CRUD
  only.
- No custom exercise creation — the picker only offers existing global
  exercises.
- No drag-and-drop reordering UI — simple up/down move controls, consistent
  with `manual-workout-builder`'s precedent.
- No offline queue support for these mutations — online-only, the same
  class of infrequent management mutation as plan creation (see Risks).
- No restriction of exercise selection to a template's own muscle-group
  bucket — selection is fully free-form (see proposal.md).

## Decisions

### Granular per-mutation endpoints, not a bulk "replace the list" PUT
- `PATCH /templates/:templateId` — `{ title }`
- `POST /templates/:templateId/exercises` — insert
  `{ exerciseId, position, sets, reps?, durationSecs?, restSecsOverride? }`
- `PUT /templates/:templateId/exercises/:exerciseId` — edit
  `sets`/`reps`/`durationSecs`/`restSecsOverride` (`:exerciseId` is the
  `WorkoutTemplateExercise.id`, not `Exercise.id`, since the same exercise
  could appear in a template more than once)
- `DELETE /templates/:templateId/exercises/:exerciseId` — remove
- `POST /templates/:templateId/exercises/:exerciseId/move` —
  `{ direction: "up" | "down" }`

**Alternative considered**: a single `PUT /templates/:templateId` accepting
a whole replacement exercise array. **Rejected** — it pushes
position/diffing computation onto the client, is more failure-prone under
concurrent edits (one stale full-list write can silently clobber a
different concurrent single change), and doesn't reduce server-side
validation work anyway, since the full resulting list must be re-validated
after any mutation regardless of how it arrived. Granular endpoints also
match the existing `apps/api/src/routes/equipment.routes.ts` POST/PUT/DELETE
shape already established in this codebase.

Every handler: load the full current exercise list (with tags — see gap
below), apply the single mutation in memory, re-validate the full resulting
list via the extracted validators, and persist only if valid, inside a
transaction; otherwise reject with 400 and persist nothing.

### Extract validation into a shared module — but only what's genuinely extractable
`plan-validation.ts`'s invariants are not all the same kind of thing.
Warmup-first, cooldown-last, and reps-or-duration are **genuinely
imperative JS code** inside `validatePlan()` — these get truly extracted
(moved, not duplicated) into `packages/shared/src/template-validation.ts`
as functions operating on a plain exercise array, and `validatePlan()` is
updated to call them instead of its current inline checks.

`minItems: 2` and the numeric ranges (`sets` 1-100, `reps` 1-1000,
`durationSecs` 1-7200, `restSecsOverride` 0-7200), by contrast, are
**declarative AJV JSON-schema properties** — there is no standalone
imperative function to extract for these; AJV enforces them before
`validatePlan()`'s own checks even run. `template-validation.ts` gets new,
freestanding functions with the same bound values, used **only** by the new
template-mutation handlers. `validatePlan()`/AJV are left untouched for
these two — rewriting them to call the new functions would either duplicate
AJV's enforcement for no benefit, or require removing it from the AJV
schema and changing `validatePlan`'s existing AJV-formatted error messages,
which `plan-validation.test.ts` likely asserts on.

The new template-mutation handlers call all five checks (three shared, two
freestanding) against the full resulting exercise list after every
mutation.

**Real gap to close**: the warmup/cooldown check needs each exercise's
`CATEGORY` tag, but `findTemplateForUser`'s current `include` only fetches
`exercises` and `mesocyclus` — not `exercise.tags`. The new template
repository's equivalent method must add a nested
`exercises: { include: { exercise: { include: { tags: { include: { tag: true } } } } } }`
include.

### Position renumbering: dense recompute on every mutation
`WorkoutTemplateExercise` has no DB-level uniqueness constraint on
`(workoutTemplateId, position)` — only an index. On every mutation
(insert/remove/move), recompute a dense position sequence for the entire
template's exercise set in memory and write back every row whose position
changed, in the same transaction. Cheap given a template only ever has a
handful of exercises; avoids needing fractional or gap-based position
schemes.

### Reuse existing authorization and transaction patterns
- **Authorization**: mirror `WorkoutSessionRepository.findTemplateForUser`'s
  ownership join (`workoutTemplate.findFirst({ where: { id, mesocyclus: {
  userId } } })`) in a new template repository. Every mutation handler calls
  it first and returns 404 if null.
- **Transactions**: `$transaction` is already an established pattern —
  `WorkoutSessionService` uses `this.store.$transaction(...)` extensively
  (`apps/api/src/services/workout-session.service.ts`), and
  `WorkoutSessionRepository`'s constructor already accepts an optional
  `TxClient` for transaction-client injection. The new template
  repository/service copies this exact shape rather than inventing a new
  one.

### Exercise selection is fully free-form
The picker is not restricted to a template's own `BUCKET_TAGS` bucket. This
is a deliberate product decision (see proposal.md), not an oversight: manual
editing exists specifically to let a user override the rule engine's
generation-time heuristics.

## Risks / Trade-offs

- **[Risk] No optimistic locking on concurrent edits to the same template**
  (e.g. two browser tabs) **→ Mitigation**: accepted as low-priority —
  templates are a single-user-owned resource typically edited from one
  device at a time, and this matches the existing lack of optimistic
  locking on `equipment.routes.ts`'s mutations. Not a regression from
  today's baseline.
- **[Risk] Online-only mutation on an offline-first app could surprise
  users** **→ Mitigation**: this matches an already-established precedent
  — `openspec/specs/offline-workout-resilience/spec.md`'s own example of an
  "unsupported workout mutation" that "stays online-only" is literally
  "plan creation." Template editing is the same class of infrequent
  management mutation, structurally unlike high-frequency in-workout
  set-logging, which is the only thing this app's offline queue targets.
- **[Risk] Validation extraction touches `plan-validation.ts`, a file with
  existing rule-engine-facing tests** **→ Mitigation**: extract behavior
  identically (same checks, same error messages where reasonable) and keep
  `plan-validation.test.ts` passing unchanged as the regression gate.
- **[Trade-off] Move-up/move-down requires N calls to move an exercise N
  positions** **→ Accepted**: consistent with `manual-workout-builder`'s
  same no-drag-and-drop decision; template exercise lists are short.

## Migration Plan

1. Extract `template-validation.ts` from `plan-validation.ts`; confirm
   `plan-validation.test.ts` still passes unchanged.
2. Add the template repository (ownership lookup with tags include,
   `TxClient` injection) and service (transactional mutate-then-validate).
3. Add the five routes, following `equipment.routes.ts`'s shape.
4. Build the web UI, reusing the `manual-workout-builder` exercise picker.
5. No schema migration, no feature flag — this is purely new application
   logic over existing columns; nothing changes for users who never use the
   new endpoints.

**Rollback**: routes/service/repo are net-new and independently revertible;
no data shape changes to roll back.

## Open Questions

- Exact UI placement (a dedicated template-editing screen vs. inline
  editing from the existing plan page) is left to implementation.
- Whether to surface a preview of which invariant would be violated before
  a rejected mutation (e.g. "can't remove this exercise, it's the only
  cooldown") versus a generic 400 is a UX detail, not architectural.
