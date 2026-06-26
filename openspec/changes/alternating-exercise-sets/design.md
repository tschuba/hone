## Context

Every layer of the current stack assumes a workout is a flat, strictly
sequential list of exercise blocks: `WorkoutTemplateExercise`/`ExerciseLog`
are ordered by a unique `position`, and the active-workout runtime
(`apps/web/src/routes/workout/+page.svelte`) walks them with a single
`currentIndex`, fully exhausting one exercise's `sets` before advancing.
There is no concept of pausing one exercise mid-block to take a turn on
another. `SetLog`/`ExerciseLog` themselves are agnostic to ordering — a
`SetLog` is just `{exerciseLogId, setNr, reps, loggedAt}` — so history and
analytics ("4 sets of Biceps Curl") look identical whether those 4 sets were
performed back-to-back or interleaved with another exercise. This means
alternating sets is purely a scheduling/sequencing concern layered on top of
an unchanged logging model, not a data-migration problem.

## Goals / Non-Goals

**Goals:**
- Let two or more exercises in one workout slot be marked as an alternating
  group, executed via round-robin turns instead of sequential blocks.
- Support groups of arbitrary size (≥ 2) with independent per-member `sets`
  targets — members are not required to share an equal set count.
- Reuse the existing per-exercise `restSecsOverride` field to control
  whether/how long to rest between turns, rather than introducing a new
  rest concept.
- Preserve correct offline resume behavior for grouped exercises, consistent
  with the existing offline-first contract (`offline-workout-resilience`).
- Ship the mechanism in a way that is immediately usable via direct
  API/session construction, without requiring any new authoring UI.

**Non-Goals:**
- No changes to `rule-engine.service.ts` — it stays goal-agnostic and will
  not auto-detect or auto-pair antagonist muscle groups in this change.
- No antagonist-pair data modeling (no `Tag` self-relation, no seed data).
- No manual plan/template editor or custom-exercise creation UI — neither
  exists today, and building one is explicitly deferred to a separate,
  later change.
- No changes to the AI-generated plan path or its prompts — that path isn't
  built yet (`async-ai-plan-optimisation` is unimplemented).
- No new "round" UI concept — grouped exercises keep the existing per-member
  "Set X of Y" framing.

## Decisions

### `groupId` as a parallel marker, not a shared `position`
Two exercises in a group keep distinct, unique `position` values exactly as
today; a new nullable `groupId` field links them. **Alternative considered**:
let group members share one `position` value and add a tiebreaker order
field. **Rejected** because the existing `position`-based match between
`ExerciseLog` and its template row in `apps/api/src/routes/workout.routes.ts`
(`exercise.position === exerciseLog.position`) assumes one row per position;
sharing positions would silently break that lookup. Keeping `position`
unique avoids touching that logic at all.

`groupId` is a plain nullable `String` (no foreign key) — it's a shared
label across rows in the same template/session, not a reference to another
table row. No new table is needed since groups don't currently need their
own metadata (e.g. a group name) beyond "which rows belong together."

`groupId` values are only meaningful within one workout template's or one
session's own exercise list — they are not, and do not need to be, globally
unique. Every place that compares `groupId` values (validation, the runtime
walker) already operates on an already-fetched, already-scoped list of
exercises for one workout/template/session; two unrelated groups in two
different workouts coincidentally sharing the same literal string value is
harmless because they are never compared against each other. No DB-level
uniqueness constraint should be added.

### Rest is per-member and fires every turn, not just at block-end
`restSecsOverride` already exists per `WorkoutTemplateExercise`/`ExerciseLog`
and today fires once, after a block's last set. For grouped exercises it
fires after **every** set performed for that member: `0` skips the rest
screen and switches turn immediately (the classic no-rest superset feel),
`>0` shows rest before switching. **Alternative considered**: a separate
group-level "inter-set rest" field. **Rejected** — the existing per-member
field already expresses "how long to pause after a set of this exercise";
reusing it avoids a redundant, harder-to-reason-about second rest concept
and keeps configuration symmetric with non-grouped exercises.

The field is not named `restSecsOverride` end-to-end, so it's worth naming
the actual chain: `MesocyclusExercise.restSecsOverride` (plan) →
`WorkoutTemplateExercise.restSecsOverride` (persisted) → resolved through
`resolveRestSecs(restSecsOverride ?? null, suggestedRestSecs) ?? 15` in
`apps/api/src/routes/workout.routes.ts:56-61` (uses `??`, so an explicit `0`
is preserved rather than falling back — verified) → exposed to the client as
`ActiveWorkoutExercise.restSecs` → read in `+page.svelte` as
`currentExercise.restSecs`. The walker change in `+page.svelte` consumes
`restSecs` (the resolved value), not `restSecsOverride` (the raw template
field) — an implementer should not expect to find `restSecsOverride` itself
inside the web client.

### Round-robin over *active* members, unequal `sets` allowed
The walker tracks active members (`completedSets < sets`) within a group and
cycles `whoseTurn` through them in stable group order. A member that reaches
its own `sets` target drops out of rotation; remaining members keep
alternating; the group completes once no member is active.
**Alternative considered**: require all group members to share an equal
`sets` count, validated at the schema level. **Rejected** — overly rigid for
legitimate asymmetric circuits (e.g. one exercise fatigues faster), and the
round-robin-over-active-members rule handles the equal case identically
while also covering the unequal case for free.

"Stable group order" means ascending `position` among the group's members —
no new ordering field is needed since `position` stays unique per member
(see the `groupId`-as-parallel-marker decision above).

### Groups exclude the workout's warmup and cooldown exercise
`plan-validation.ts`'s existing `validatePlan` checks `workout.exercises[0]`
for a "warmup" category tag and `workout.exercises.at(-1)` for "cooldown" —
by array index, independent of `groupId`. Nothing about the contiguous-group
invariant alone would stop a group from including index `0` or the last
index, which would let a plan group the warmup or cooldown exercise into an
alternating unit — structurally valid by the contiguity rule, but
nonsensical as a workout (and not otherwise caught). This change adds an
explicit invariant: a group SHALL NOT include the workout's first (warmup)
or last (cooldown) exercise. **Alternative considered**: leave this
uncaught and rely on plan authors (manual or future AI-generated) not to do
it. **Rejected** — it's a cheap, mechanical check to add at the same point
the contiguity check already runs, and silently allowing a malformed warmup
group is worse than a clear validation error.

### `whoseTurn` replaces `currentIndex` as the walker's position state
`apps/web/src/lib/context/workout-session.svelte.ts` and
`apps/web/src/routes/workout/+page.svelte` generalize from "exhaust the
current exercise's sets, then advance an index" to:

```
On "set done" for whoseTurn's member:
  1. increment that member's completedSets (as today)
  2. recompute active members = group members with completedSets < sets
  3. if active members is empty:
       behave exactly like today's "exercise complete" path — rest using
       the just-finished member's own restSecsOverride, then advance to
       the next position/group
  4. else:
       advance whoseTurn to the next active member, round-robin order;
       skip the rest screen entirely if the just-finished member's
       restSecsOverride is 0
```

Ungrouped exercises are the degenerate case of a "group" with one member, so
no branching is needed between grouped and ungrouped code paths — `whoseTurn`
is just always-one-member for today's existing exercises.

UI display needs no new concept: each member keeps its own "Set X of Y"
counter (already present), decorated with "(alternating with <partner
name>)" when `groupId` is set, and `whoseTurn` determines which
`ExerciseRow` renders as `active`.

### Offline resume: fewest-`completedSets` wins
On resume (app restart, reconnect), `whoseTurn` is recomputed as the active
member with the fewest `completedSets`, ties broken by stable group order
(ascending `position`, as defined above).
This is correct because in a functioning round-robin, active members'
completed counts never diverge by more than 1 — whoever is "most behind" is
always exactly who's due next. This is computed purely client-side from data
the API already returns (`completedSets`, `sets`, `groupId`,
`restSecsOverride` per exercise) — no new field or server-side "current
turn" state is introduced, and it reuses the existing optimistic
increment-after-queue pattern already at
`apps/web/src/routes/workout/+page.svelte:196`.
**Alternative considered**: persist `whoseTurn` explicitly server-side.
**Rejected** — adds a new piece of synced state and a new offline-conflict
surface for something fully derivable from existing data.

## Risks / Trade-offs

- **[Risk] Offline resume for groups is new, non-trivial logic in a part of
  the codebase with recent fragility** (the `fix(offline): unstick
  post-completion summary...` commit touched this exact resume path) **→
  Mitigation**: dedicated test coverage specifically for interrupted-mid-round
  resume across 2-member and 3+-member groups, including the
  unequal-`sets`-dropout case, before this ships.
- **[Risk] `groupId` ships with no authoring UI, so it's only reachable via
  direct API/session construction until a future editor or the AI path
  exists → Mitigation**: explicitly acceptable per scope decision; document
  this in tasks so it isn't mistaken for an oversight.
- **[Risk] Exercise substitution mid-session doesn't validate that a
  replacement still makes sense next to its group partner** (e.g. swapping
  out Biceps Curl for an unrelated exercise mid-alternating-group) **→
  Mitigation**: accepted as a known loose edge, consistent with how
  substitution already only scores candidates against the single swapped
  exercise's own tags; not blocking for this change.
- **[Trade-off] Walker state machine complexity increases** (more states to
  reason about: per-member progress, active-set membership, turn order) **→
  Mitigation**: implement the turn-advance/resume logic as pure functions
  independent of Svelte component state so they're directly unit-testable.

## Migration Plan

1. Add nullable `groupId` columns to `WorkoutTemplateExercise` and
   `ExerciseLog` (additive migration, no backfill — existing rows stay
   `NULL`, which is exactly today's ungrouped behavior).
2. Extend `packages/shared/src/plan-validation.ts` with optional `groupId`
   and group invariants.
3. Update `workout-session.repo.ts` to copy `groupId` onto `ExerciseLog` at
   session creation, and `workout.routes.ts` to project it into
   `ActiveWorkoutExercise`.
4. Update the web runtime walker and `ExerciseRow` display.
5. No feature flag is needed: a `NULL` `groupId` is fully backward
   compatible with every existing template/session, so this can ship
   incrementally layer-by-layer without changing behavior until something
   actually sets `groupId` (which, per scope, nothing in the rule engine or
   any shipped UI does yet).

**Rollback**: each layer is independently revertible since the column is
nullable and unused by existing code paths; no data backfill to undo.

## Open Questions

- Exact UI copy/visual treatment for a grouped `ExerciseRow` (e.g. precise
  wording for "(alternating with X)", how the partner's mini-progress is
  shown) is left to implementation — low risk, no architectural impact.
- If a future manual editor needs group-level metadata (e.g. a user-facing
  label for the group, beyond "linked exercises"), `groupId` may eventually
  need to graduate from a plain label to a real table row. Not needed now;
  flagged for whoever scopes that editor change.
