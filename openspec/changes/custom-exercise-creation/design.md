## Context

`Exercise.ownerId` (nullable) and `Exercise.isGlobal` (boolean) exist in
`apps/api/prisma/schema.prisma` but are completely unused — every seeded
exercise has `isGlobal: true`, `ownerId: null`, and `exercise.routes.ts`
has only `GET /`. `ExerciseRepository.list()` hardcodes `isGlobal: true`
and has no `deletedAt` filter at all. It is called from exactly two places:
`exercise.routes.ts`'s `GET /` (the manual exercise picker's data source,
consumed by the sibling `manual-workout-builder`/`template-editing`
changes) and `rule-engine.service.ts`'s `RuleEngineService.generate()` (the
automatic plan-generation candidate pool).

There is no automatic way to infer `MUSCLE_GROUP`/`CATEGORY` tags from an
exercise's name or description — `tier1-tagger.service.ts` only
pattern-matches `nameEn` for `MODIFIER`-category safety tags (knee_load,
back_load); `seed-exercises.ts` assigns `MUSCLE_GROUP`/`CATEGORY` from
explicit per-exercise fixture data, never derived. The rule engine's
`BUCKET_TAGS` selection depends on `CATEGORY` tags existing correctly, so
any newly created exercise needs them assigned at creation time, by the
user, not inferred.

## Goals / Non-Goals

**Goals:**
- Let a user create a private (`isGlobal: false`) exercise with the tags it
  needs to be usable by the manual exercise pickers.
- Make custom exercises visible to their owner's pickers without changing
  the rule engine's automatic generation pool.
- Keep this safe under soft-delete, consistent with the rest of the schema.

**Non-Goals:**
- No image upload — `imageUrl` stays `null` for all custom exercises in
  this change.
- No path to `isGlobal: true` — no moderation/review workflow
  (`ExerciseTagStatus.PENDING_REVIEW`, `Role.MODERATOR` stay unused).
- No edit/`PATCH` of an existing custom exercise — delete and recreate is
  the only correction path for v1.
- No changes to `rule-engine.service.ts`'s behavior or candidate pool.

## Decisions

### `includeOwned` parameter on `ExerciseRepository.list()`, not a separate method
Add `includeOwned?: boolean` (default `false`) to `list()`'s filters. When
`true`, the where-clause becomes
`OR: [{ isGlobal: true }, { ownerId: ctx.userId }]` (mirroring
`workout-session.repo.ts`'s `findExerciseForUser`); when omitted/`false`,
behavior is identical to today (`isGlobal: true` only).
`rule-engine.service.ts`'s call site passes no new parameter, so its
candidate pool is unaffected — confirmed by inspecting both of `list()`'s
two call sites directly. `exercise.routes.ts`'s `GET /` passes
`includeOwned: true`.

**Alternative considered**: a separate `listForUser()` method to avoid
adding a boolean parameter to the shared method. **Rejected** — the two
call sites share all other filtering logic (`excludeModifiers`, `limit`,
the tags `include`); duplicating that to avoid one boolean parameter is
more maintenance burden than the parameter itself.

### Fix the missing `deletedAt` filter as part of this change
`list()` currently has no `deletedAt: null` filter at all (unlike
`findExerciseForUser`, which has one). This has been silently harmless
because no global exercise has ever been soft-deleted. Once custom
exercises can be soft-deleted via the new `DELETE /exercises/:id`, this gap
becomes real — without the fix, a deleted custom exercise would keep
appearing in the picker. Add `deletedAt: null` to `list()`'s where-clause
in the same change, for both the global-only and `includeOwned` paths.

### Tagging: manual pick for MUSCLE_GROUP/CATEGORY, automatic for MODIFIER
The creation form requires the user to pick at least one `MUSCLE_GROUP` tag
and exactly one `CATEGORY` tag from values returned by the new
`GET /tags` endpoint (sourced from the `Tag` table, not a hardcoded
frontend list — keeps the picker's vocabulary from drifting out of sync
with `BUCKET_TAGS`). Because `GET /tags` only ever returns *already-existing*
`Tag` row IDs, resolving a manual pick is a direct reference to that
`tagId` — **no `Tag` upsert is needed or correct for manual picks**, only a
new `ExerciseTag` join row: `{ exerciseId, tagId, source: MANUAL,
confidence: 1.0, status: CONFIRMED }` (confidence/status set explicitly,
not relied on as schema defaults, so it's clear `1.0`/`CONFIRMED` are
deliberate and `PENDING_REVIEW` is intentionally unused).

Separately, `Tier1Tagger.tag({ category, nameEn })` runs synchronously
against the submitted `nameEn` at creation time to derive zero or more
`MODIFIER` safety tags. Unlike manual picks, **the resulting tag value may
not yet have a `Tag` row** (e.g. a fresh database that hasn't seeded
`knee_load` yet), so this path *does* need the same defensive
`db.tag.upsert`-by-`(category,value)` pattern `seed-exercises.ts` uses
(lines 258-270) before creating the `ExerciseTag` join row. Two details to
get exactly right, verified against the real seed script
(`seed-exercises.ts:257-290`) and `Tier1Tagger`'s actual return shape:
- **Confidence**: `Tier1Tagger.tag()` returns `confidence: 0.85` per
  matched pattern (hardcoded in `tier1-tagger.service.ts`) — write that
  value onto the `ExerciseTag` row (`confidence: tier1Tag.confidence`), not
  the schema default of `1.0`, mirroring `seed-exercises.ts:280/284`.
- **Source casing trap**: `Tier1Tagger`'s TS type returns
  `source: "heuristic"` (lowercase) — this does **not** match the Prisma
  `ExerciseTagSource.HEURISTIC` enum value. The seed script does not pass
  `tier1Tag.source` through; it writes the literal uppercase
  `source: "HEURISTIC"` directly (`seed-exercises.ts:281/286`). Do the same
  — do not naively copy `tier1Tag.source` into the `ExerciseTag` row.

`Tier1Tagger` is pure/stateless and only pattern-matches `nameEn`; it's safe
to call this way despite normally running in the seed script. Its input
type requires a `category` field even though matching ignores it — thread
the form's chosen `CATEGORY` tag value into that field rather than passing
a dummy, since it's already available and avoids an unused/confusing
literal.

All of this — the `Exercise` row, the manual `ExerciseTag` rows (direct
reference, no upsert), and the heuristic path's `Tag` upserts plus
`ExerciseTag` rows — is created in one transaction.

### `imageAltText` auto-derived from `nameEn`, no separate form field
Since `imageUrl` stays `null` and the web UI already conditionally renders
images (`{#if currentExercise.imageUrl}` in
`apps/web/src/routes/workout/+page.svelte`), no new rendering work is
needed. `imageAltText` (non-nullable in the schema) is derived directly
from `nameEn` at creation time rather than asking the user for a separate
field — keeps the creation form to name + optional fields + required tags,
nothing else.

### Soft-delete only, reusing the existing pattern
`DELETE /exercises/:id` sets `deletedAt`, scoped to `ownerId` (a user can
only delete their own exercises; global exercises are never deletable
through this endpoint). Confirmed safe: `ExerciseLog.exercise` is a
required relation with the schema's default (`Restrict`) delete behavior,
so a *hard* delete would throw a foreign-key error if the exercise were
ever logged — soft-delete avoids this entirely since the row stays in
place; only the `deletedAt` filter fix (above) keeps it out of future
listings. Existing `ExerciseLog` rows referencing a soft-deleted exercise
are unaffected (history is preserved, exactly as it already works for
other soft-deleted entities in this schema).

## Risks / Trade-offs

- **[Risk] No edit path means a typo in `nameEn` or a wrong tag pick can
  only be fixed by delete-and-recreate** **→ Mitigation**: accepted for
  v1; explicitly noted in proposal.md as a stated limitation. The
  continuity loss (new `Exercise.id` on recreate) only matters once a
  per-exercise history feature exists, which it doesn't yet.
- **[Risk] The `includeOwned` parameter is easy to get backwards** (e.g. a
  future call site forgetting to omit it and accidentally widening the
  rule engine's pool) **→ Mitigation**: name it descriptively, default to
  `false`, and add an explicit test asserting `rule-engine.service.ts`'s
  generated plans never include a non-global exercise even when the
  calling user has custom exercises.
- **[Trade-off] A new `GET /tags` endpoint is fairly minimal** (no
  pagination, no search) **→ Accepted**: the `Tag` table is small
  (muscle groups + categories + modifiers), a flat list is sufficient for
  a picker UI.

## Migration Plan

1. Fix `ExerciseRepository.list()` (`includeOwned` param, `deletedAt`
   filter) — purely additive/corrective, no behavior change for existing
   callers that don't pass the new param.
2. Add `GET /tags`.
3. Add `POST /exercises` (transactional create with manual + heuristic
   tags).
4. Add `DELETE /exercises/:id`.
5. Update `exercise.routes.ts`'s `GET /` to pass `includeOwned: true`.
6. Build the web creation form, reusing existing form/validation patterns
   (e.g. from `apps/web/src/routes/onboarding/+page.svelte`).
7. No schema migration, no feature flag — all fields already exist and are
   additive in behavior.

**Rollback**: each layer is independently revertible; no data shape changes
to undo.

## Open Questions

- Exact creation-form layout/copy is left to implementation.
- Whether `GET /tags` should be scoped under `exercise.routes.ts` or a new
  `tags.routes.ts` file is an organizational detail, not architectural.
