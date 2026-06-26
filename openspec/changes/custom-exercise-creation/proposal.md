## Why

`Exercise.ownerId` and `Exercise.isGlobal` already exist in the schema for
user-owned exercises, but nothing creates them — `exercise.routes.ts` has
only `GET /`. Without this, a user can never add an exercise the global
catalog doesn't have, which limits what the exercise pickers built by the
sibling `manual-workout-builder` and `template-editing` changes can offer.
This change closes that gap with the smallest viable slice: private
exercise creation, no image upload, no moderation.

## What Changes

- Add `POST /exercises` to create a private `Exercise` (`isGlobal: false`,
  `ownerId: <requesting user>`) with `nameEn` (required), `nameDe`/
  `descriptionEn`/`suggestedRestSecs` (optional), a required manual pick of
  at least one `MUSCLE_GROUP` tag and one `CATEGORY` tag, plus
  automatically-derived `MODIFIER` safety tags (via the existing
  `Tier1Tagger`, run synchronously against the submitted name). `imageUrl`
  stays `null`; `imageAltText` is auto-derived from `nameEn` — no image
  upload in this change.
- Add `GET /tags` to list existing `Tag` rows (optionally filtered by
  category) so the creation form's tag-picker is sourced from the database
  rather than a hardcoded frontend vocabulary.
- Add `DELETE /exercises/:id`, soft-deleting (`deletedAt`) a user's own
  custom exercise. No edit/`PATCH` in this change.
- Fix `ExerciseRepository.list()` (`apps/api/src/repositories/exercise.repo.ts`)
  to add a `deletedAt: null` filter (currently missing entirely) and a new
  `includeOwned?: boolean` filter (default `false`) that, when `true`,
  includes the requesting user's own exercises alongside global ones.
  `exercise.routes.ts`'s `GET /` passes `includeOwned: true`.
  **`rule-engine.service.ts`'s call site is unchanged** — it passes no new
  parameter, so its candidate pool stays global-exercises-only, exactly as
  today. Custom exercises become visible in the manual pickers without
  becoming eligible for automatic plan generation.
- Out of scope for this change, explicitly: image upload (deferred
  indefinitely until a future change), promoting a custom exercise to
  global/shared (`isGlobal` stays `false` forever in this change — no
  moderation workflow, `ExerciseTagStatus.PENDING_REVIEW`/`Role.MODERATOR`
  stay unused), and editing an existing custom exercise (delete-and-recreate
  is the only correction path; this severs continuity for any future
  per-exercise history feature, which doesn't exist yet to actually break).

## Capabilities

### New Capabilities
- `custom-exercise-creation`: Defines how a user creates, tags, and
  soft-deletes their own private exercise, how it becomes visible to that
  user's exercise pickers without affecting automatic plan generation, and
  the validation invariants the creation form must enforce.

### Modified Capabilities
(none — `plan-generation`'s existing requirements are unaffected;
`rule-engine.service.ts`'s behavior is explicitly unchanged by this change)

## Impact

- **Schema**: no migration needed — `Exercise.ownerId`/`isGlobal` and
  `ExerciseTag.source`/`status` already exist and are unused today.
- **API**: `apps/api/src/routes/exercise.routes.ts` (new `POST /`,
  `DELETE /:id`, new `tags.routes.ts` or equivalent for `GET /tags`),
  `apps/api/src/repositories/exercise.repo.ts` (`list()`'s `includeOwned`
  and `deletedAt` fixes), reusing `apps/api/src/services/tier1-tagger.service.ts`
  for MODIFIER tagging and `apps/api/src/cli/seed-exercises.ts`'s
  `db.tag.upsert`-by-`(category,value)` pattern for tag resolution.
- **Unaffected**: `apps/api/src/services/rule-engine.service.ts` (confirmed
  call site unchanged), AI plan generation, `WorkoutTemplate`/session
  creation, the offline sync layer.
- **Consumers**: the exercise pickers in `manual-workout-builder` and
  `template-editing` automatically gain custom-exercise visibility once
  `GET /exercises` passes `includeOwned: true` — no per-picker change
  needed in either sibling change.
