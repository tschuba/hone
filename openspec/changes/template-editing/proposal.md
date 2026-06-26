## Why

Today a `WorkoutTemplate`'s exercises can only be set once, at generation
time, by the rule engine or AI. There is no way for a user to adjust a
template afterward — swap an exercise, change sets/reps, or fix a rest
duration — without regenerating the entire mesocyclus. This change lets a
user edit their existing templates directly, so corrections and preferences
persist across every future occurrence of that template in the rotation.

## What Changes

- Add API endpoints to mutate one of a user's active mesocyclus's existing
  `WorkoutTemplate` rows: edit its `title`; add, remove, and reorder its
  exercises; edit each exercise's `sets`, `reps`/`durationSecs`, and
  `restSecsOverride`.
- Extract the warmup-first/cooldown-last/minimum-exercise-count/
  reps-or-duration invariants currently embedded in
  `packages/shared/src/plan-validation.ts`'s `validatePlan()` into reusable
  helpers, so both full-plan validation (rule engine/AI output) and
  incremental template mutations enforce the same invariants from one
  source of truth.
- Add a web UI for this editing, reusing the exercise-picker component
  being built for the sibling `manual-workout-builder` change.
- Templates can only be added to or removed from in this way — never
  created or deleted. `WorkoutLabel` stays fixed to exactly `A`/`B`/`C`,
  one template per position per mesocyclus, unchanged.
- Exercise selection for this editing is fully free-form: any existing
  global exercise can be added to any template/position. This change does
  **not** restrict the picker to a template's own muscle-group bucket
  (`BUCKET_TAGS` in `rule-engine.service.ts`) — that bucket logic governs
  generation-time heuristics, not a permanent constraint on manual edits.
- Out of scope for this change, explicitly: adding/removing/renaming
  templates; alternating-group (`groupId`) authoring, deferred until
  `alternating-exercise-sets` is implemented; custom exercise creation;
  offline support for these mutations (online-only, consistent with how
  plan creation already behaves).

## Capabilities

### New Capabilities
- `template-editing`: Defines how a user mutates an existing
  `WorkoutTemplate`'s exercises and title, the validation invariants that
  must hold after every mutation, and the scoping/authorization rules for
  who can edit which template.

### Modified Capabilities
(none — `plan-generation`'s existing requirements about rule-engine output
are unchanged; this change adds a separate, independent mutation path for
already-persisted templates, sharing validation logic but not altering any
existing requirement's normative text)

## Impact

- **Schema**: no migration needed — operates entirely on existing
  `WorkoutTemplate`/`WorkoutTemplateExercise` columns.
- **Shared validation**: `packages/shared/src/plan-validation.ts` —
  extract warmup/cooldown/minItems/reps-or-duration invariants into a new
  reusable module (e.g. `packages/shared/src/template-validation.ts`)
  consumed by both `validatePlan()` and the new mutation handlers.
- **API**: new template repository/service (mirroring
  `apps/api/src/repositories/workout-session.repo.ts`'s
  `findTemplateForUser` ownership pattern and
  `apps/api/src/services/workout-session.service.ts`'s `$transaction`
  usage) and new routes for title/exercise mutations, following
  `apps/api/src/routes/equipment.routes.ts`'s POST/PUT/DELETE shape.
- **Web**: new template-editing UI, reusing the exercise-picker component
  from `manual-workout-builder` and the `request<T>()` client in
  `apps/web/src/lib/api.ts`.
- **Unaffected**: `apps/api/src/services/rule-engine.service.ts`, AI plan
  generation, the mesocyclus rotation logic (`resolveNextTemplateId`),
  offline sync (`apps/web/src/lib/sync.ts`,
  `apps/web/src/lib/db/offline-store.ts`).
