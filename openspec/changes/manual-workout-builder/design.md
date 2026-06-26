## Context

Today every workout session is created from a real `WorkoutTemplate`:
`WorkoutSessionService.createSession` requires a `templateId`, and its
optional `exerciseLogs` override only accepts `{exerciseId, id, position}`
— no `sets`/`reps`/`rest`. The actual sets/reps/rest values shown during a
session are resolved in `apps/api/src/routes/workout.routes.ts` by matching
`exerciseLog.position` against a real `WorkoutTemplateExercise` row;
`ExerciseLog` itself carries no sets/reps/rest/duration data of its own.
There is no way today to express "do 3 sets of 12 of this exercise, then 2
sets of 8 of that one" without a template backing every position.

Two schema facts narrow the design space usefully:
- `WorkoutSession.templateId` and `WorkoutSession.mesocyclusId` are
  **already nullable** in `schema.prisma` — the "must have a template"
  constraint is enforced only at the service/repo/route layer, not the DB.
- `WorkoutTemplate.mesocyclusId` is **not** nullable, and `WorkoutLabel` is a
  fixed `A | B | C` enum with no "none" value — both are obstacles only if a
  template were synthesized to back an ad-hoc session.

Session creation is also not a simple synchronous REST call in this app: it
flows through a typed offline queue (`PendingSessionCreateOp` in
`apps/web/src/lib/db/offline-store.ts`, replayed by `flushOp` in
`apps/web/src/lib/sync.ts`), consistent with the app's offline-first
architecture (see `openspec/specs/offline-workout-resilience/spec.md`).

## Goals / Non-Goals

**Goals:**
- Let a user assemble a one-off workout from existing global exercises,
  with their own per-exercise `sets`, `reps`/`durationSecs`, and rest, that
  is not saved as a reusable template.
- Make this fully usable offline, consistent with how templated session
  creation already works offline today.
- Leave room for the exercise list to carry a `groupId` (from
  `alternating-exercise-sets`) without requiring that change to ship first.

**Non-Goals:**
- No persistent `WorkoutTemplate`/`WorkoutTemplateExercise` mutation routes
  — that's a separate, later change.
- No custom exercise creation — the exercise picker only lists existing
  global exercises (`GET /exercises`).
- No drag-and-drop reordering UI — no such library exists anywhere in this
  codebase today, and introducing one is unnecessary scope for assembling a
  short, one-off exercise list.
- No changes to `rule-engine.service.ts`, AI plan generation, or the
  mesocyclus rotation (`resolveNextTemplateId`).

## Decisions

### Extend `ExerciseLog` directly, rather than synthesizing a template
`ExerciseLog` gains its own optional `sets`, `reps`, `durationSecs`,
`restSecsOverride`, and `groupId` columns. The read path
(`apps/api/src/routes/workout.routes.ts`) uses these directly when there is
no matching `WorkoutTemplateExercise`, falling back to today's
template-resolution logic unchanged when one exists.

**Alternative considered**: materialize a minimal, unlisted "throwaway"
`WorkoutTemplate` (and the `WorkoutTemplateExercise` rows under it) per
ad-hoc session, reusing all existing resolution logic for free.
**Rejected**: it needs a backing `Mesocyclus` (`WorkoutTemplate.mesocyclusId`
is non-nullable) — either a per-user "scratch" mesocyclus or a schema
relaxation — and a `WorkoutLabel` value that doesn't collide with the real
`A | B | C` rotation read by `resolveNextTemplateId` in
`workout-session.service.ts`. Neither has a clean answer (no `WorkoutLabel`
value means "not part of the rotation"), and a scratch row risks silently
being swept into rotation logic that wasn't written with it in mind. The
`ExerciseLog`-extension path also mirrors the same additive,
reuse-existing-concepts approach already used for `groupId` in
`alternating-exercise-sets`, rather than introducing a structurally
different mechanism for what is conceptually the same "per-exercise
configuration" idea.

### `templateId` becomes optional at the service/route layer
`WorkoutSessionService.createSession` accepts `templateId: string | null`.
When `null`, no `WorkoutTemplate` lookup happens at all — the session is
created directly from the caller-supplied exercise list (now carrying its
own `sets`/`reps`/`durationSecs`/`restSecsOverride`/`groupId` per entry).
This is a layer-only change: the DB columns were already nullable, so no
migration is needed for `WorkoutSession` itself.

### `findActiveSession` stops requiring a template
Today, `apps/api/src/routes/workout.routes.ts`'s `findActiveSession` does
`if (!session?.template) return null;`, meaning a templateless session is
currently invisible to `/workout/today`. This guard is replaced with logic
that resolves each exercise's sets/reps/rest from its own `ExerciseLog`
columns when `session.template` is absent, and from the template when
present — the same branching the write path uses, applied symmetrically on
read.

### Offline queue and client types: less new surface than it first looked
Verified directly against `apps/web/src/lib/db/offline-store.ts`,
`apps/web/src/lib/sync.ts`, and `apps/web/src/lib/api.ts`:

- `PendingSessionCreateOp.payload` is currently
  `{ exerciseLogs: Array<{exerciseId, id, position}>, sessionId, templateId: string }`
  — `templateId` is required. This becomes `templateId: string | null`, and
  each `exerciseLogs` entry gains the new optional per-exercise fields
  (`sets?`, `reps?`, `durationSecs?`, `restSecsOverride?`, `groupId?`) to
  carry what the user configured. `flushOp`'s replay call
  (`client.startSession(op.payload.templateId, {...})`) and `startSession`'s
  signature in `api.ts` both need the same nullable-`templateId`/new-fields
  update.
- **`ActiveWorkoutExercise` (the client's per-exercise read type) already
  has `sets`, `reps`, `durationSecs`, and `restSecs`** — these are already
  populated today by resolving a templated exercise's configuration for
  display. Nothing new is needed for these fields specifically; only
  `groupId: string | null` is genuinely new on this type. (Note the
  existing field is `restSecs`, the already-resolved value — not
  `restSecsOverride`, which is the raw `WorkoutTemplateExercise`/
  `ExerciseLog` column name used server-side; don't conflate the two.)
- **Missed in earlier scoping, real task**: `ActiveWorkout`'s
  `active_session` variant has non-nullable `templateId: string` and
  `templateLabel: string` (`templateTitle` is already `string | null`).
  These must become nullable — `templateId: string | null`,
  `templateLabel: string | null` — since an ad-hoc session has no template
  or label at all. This is a genuine client-type change this proposal
  needs, not just a per-exercise field addition.

No new queue *operation type* is introduced — ad-hoc session creation
reuses the existing `PendingSessionCreateOp` shape, consistent with how
templated session creation already queues today.

### Reordering uses simple up/down controls, not drag-and-drop
The exercise picker UI lets a user move a selected exercise up or down in
the list with buttons. **Alternative considered**: a drag-and-drop list.
**Rejected for v1** — no drag library exists anywhere in this codebase, the
list being assembled is short (a single session's exercises), and adding a
new UI dependency for this is disproportionate scope. Can be revisited if a
future template editor (which has the same reordering need at larger scale)
makes the investment worthwhile.

### `groupId` is carried but not authored with full validation yet
The new `ExerciseLog.groupId` column exists and is included in the ad-hoc
session's create/read path, but this change does not implement the
contiguity/warmup-cooldown-exclusion validation that
`alternating-exercise-sets` defines for templated plans (that validation
lives in `packages/shared/src/plan-validation.ts`, which only validates
plan/template structures, not ad-hoc session payloads). If a future
iteration of the picker UI lets a user mark two exercises as alternating
before `alternating-exercise-sets`'s runtime walker ships, the `groupId`
will be stored but the session runtime will treat the exercises
sequentially (today's default behavior) until that walker change lands —
this is a safe, non-breaking gap, not a blocking dependency.

## Risks / Trade-offs

- **[Risk] Two parallel resolution paths in `workout.routes.ts`** (template-
  backed vs. `ExerciseLog`-own-fields) increase branching complexity in an
  already-dense read function **→ Mitigation**: extract the per-exercise
  resolution into a small pure helper that takes
  `(templateExercise | null, exerciseLog)` and returns the resolved
  sets/reps/rest, testable independently of the route handler.
- **[Risk] Offline queue schema change touches a part of the codebase with
  prior fragility** (recent offline bugfix commits) **→ Mitigation**:
  dedicated tests for queuing and replaying an ad-hoc `PendingSessionCreateOp`
  specifically, in addition to existing templated-session queue tests.
- **[Trade-off] `ExerciseLog` gains five new nullable columns that are only
  ever populated for ad-hoc sessions** — most rows (templated sessions)
  will always have them `NULL` **→ Accepted**: consistent with the
  established pattern of additive nullable columns used for `groupId`
  elsewhere; no index or constraint overhead since they're never queried by
  value, only read per-row.
- **[Risk] Custom exercise creation and persistent template editing are
  visibly "missing" pieces of the same broader goal** — a user could
  reasonably expect to save an ad-hoc session as a template, which this
  change does not support **→ Mitigation**: explicitly out of scope per the
  proposal; the UI should not imply "save as template" is available.

## Migration Plan

1. Add nullable `sets`, `reps`, `durationSecs`, `restSecsOverride`,
   `groupId` columns to `ExerciseLog` (additive, no backfill).
2. Update `workout-session.service.ts`/`workout-session.repo.ts` to accept
   `templateId: string | null` and per-exercise fields.
3. Update `workout-session.routes.ts`'s request schema accordingly.
4. Update `workout.routes.ts`'s `findActiveSession` (and the analogous
   `findPlannedWorkout`, where relevant) to resolve sets/reps/rest from
   `ExerciseLog`'s own columns when there's no template.
5. Extend `PendingSessionCreateOp`/`flushOp` and the `ActiveWorkout` cache
   shape for the new fields and nullable `templateId`.
6. Build the exercise-picker web UI and wire it to the (now ad-hoc-capable)
   session creation flow.
7. No feature flag needed: `NULL` `templateId`/per-exercise columns are
   fully backward compatible with every existing templated session, so each
   layer ships incrementally without changing existing behavior.

**Rollback**: each layer is independently revertible; the new columns are
nullable and unused by existing templated-session code paths.

## Open Questions

- Exact picker UI layout/copy (e.g. how exercises are searched/filtered, how
  the assembled list is presented before starting) is left to
  implementation — low architectural risk.
- Whether the picker should pre-fill suggested `sets`/`reps` from
  `Exercise.suggestedRestSecs`/category heuristics, or always start blank,
  is a UX detail to settle during implementation, not an architectural one.
