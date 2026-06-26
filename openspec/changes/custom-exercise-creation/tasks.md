## 1. Repository Fixes

- [ ] 1.1 Add `includeOwned?: boolean` (default `false`) to
      `ExerciseListFilters` and `ExerciseRepository.list()` in
      `apps/api/src/repositories/exercise.repo.ts`: when `true`, change the
      where-clause to `OR: [{ isGlobal: true }, { ownerId: ctx.userId }]`;
      when omitted, keep today's `isGlobal: true` behavior unchanged
- [ ] 1.2 Add `deletedAt: null` to `list()`'s where-clause for both the
      global-only and `includeOwned` paths (currently missing entirely)
- [ ] 1.3 Add a regression test asserting `rule-engine.service.ts`'s
      `RuleEngineService.generate()` never selects a non-global exercise,
      even for a user who owns custom exercises matching the active
      bucket's tags — confirms the call site is genuinely unaffected

## 2. Tag Listing

- [ ] 2.1 Add `GET /tags` (optionally filtered by `?category=`) returning
      existing `Tag` rows, in a new route file or extending
      `exercise.routes.ts`
- [ ] 2.2 Add/update tests covering: listing all tags, filtering by
      category

## 3. Custom Exercise Creation

- [ ] 3.1 Add `POST /exercises` to `apps/api/src/routes/exercise.routes.ts`
      accepting `nameEn` (required), `nameDe`/`descriptionEn`/
      `suggestedRestSecs` (optional), `muscleGroupTagIds` (required, >=1),
      `categoryTagId` (required, exactly 1)
- [ ] 3.2 Implement the transactional create in a service/repository
      method: create the `Exercise` row (`isGlobal: false`,
      `ownerId: userId`, `imageUrl: null`, `imageAltText` derived from
      `nameEn`); create `ExerciseTag` rows directly referencing the
      submitted `tagId`s for the picked muscle-group/category tags
      (`source: MANUAL`, `confidence: 1.0`, `status: CONFIRMED`, all
      explicitly set — no `Tag` upsert needed here, `GET /tags` only
      returns already-existing tag IDs); call
      `Tier1Tagger.tag({ category: <chosen category tag value>, nameEn })`
      and for each returned modifier tag, upsert the `Tag` row (see 3.3)
      then create its `ExerciseTag` row with `confidence: tier1Tag.confidence`
      (verified `0.85` from `Tier1Tagger`, not the schema default of `1.0`)
      and the literal `source: "HEURISTIC"` (uppercase — do **not** pass
      `tier1Tag.source` through, it's the lowercase string `"heuristic"`
      and will fail Prisma's enum validation) — all in one `$transaction`
- [ ] 3.3 For the `Tier1Tagger`-derived modifier tags only, reuse
      `seed-exercises.ts`'s `db.tag.upsert`-by-`(category,value)` pattern
      (lines 258-270) to create the `Tag` row if it doesn't already exist,
      since a fresh database may not have seeded e.g. `knee_load` yet —
      manual muscle-group/category picks do not need this, they reference
      an existing `tagId` directly
- [ ] 3.4 Add/update tests covering: successful creation with valid tags,
      rejection with no muscle-group tag, rejection with no category tag,
      modifier tags correctly auto-derived for a name matching a known
      pattern, created exercise has `isGlobal: false`

## 4. Visibility Wiring

- [ ] 4.1 Update `exercise.routes.ts`'s `GET /` handler to pass
      `includeOwned: true` to `repository.list()`
- [ ] 4.2 Add/update tests confirming: the owner sees their own custom
      exercise in `GET /exercises`, a different user does not see it

## 5. Soft Delete

- [ ] 5.1 Add `DELETE /exercises/:id` to `exercise.routes.ts`, scoped to
      `ownerId` (404 if not found or not owned, 404 specifically for
      attempts to delete a global exercise since it has no `ownerId`
      matching the requester)
- [ ] 5.2 Implement the soft-delete (set `deletedAt`) in the
      repository/service layer
- [ ] 5.3 Add/update tests covering: owner deletes successfully, deleted
      exercise excluded from subsequent `GET /exercises`, existing
      `ExerciseLog` rows referencing the deleted exercise remain readable
      and unchanged, non-owner delete attempt rejected, global-exercise
      delete attempt rejected

## 6. Web: Creation Form

- [ ] 6.1 Add a creation form (new route or extending an existing exercise-
      browsing screen), reusing form/validation/error-handling patterns
      from `apps/web/src/routes/onboarding/+page.svelte`
- [ ] 6.2 Add a tag-picker UI sourced from `GET /tags`
- [ ] 6.3 Add client API methods to `apps/web/src/lib/api.ts` for
      `GET /tags`, `POST /exercises`, `DELETE /exercises/:id`

## 7. Tests & Verification

- [ ] 7.1 End-to-end check: create a custom exercise, confirm it appears in
      the exercise picker used by the `manual-workout-builder`/
      `template-editing` flows, confirm it never appears in a freshly
      generated plan
- [ ] 7.2 End-to-end check: delete the custom exercise, confirm it
      disappears from the picker while any session history referencing it
      remains intact
- [ ] 7.3 Run `bun run lint` and fix any issues before considering the
      change complete, per repository convention
