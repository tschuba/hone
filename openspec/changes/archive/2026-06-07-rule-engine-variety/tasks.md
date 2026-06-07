# Tasks

## 1. Shuffle Exercise Selection

- [x] 1.1 Replace `sortExercises` in `apps/api/src/services/rule-engine.service.ts` with a Fisher-Yates shuffle seeded from a value derived at plan-generation time (e.g. `Date.now()` or a UUID passed in via `GeneratePlanOptions`). The seed is not stored — variety is achieved by generating a new mesocyclus, not within one.
- [x] 1.2 Apply the shuffle to each bucket independently before `selectExercises` runs, so Session 1, 2, and 3 draw from independently shuffled pools.

## 2. Update Tests

- [x] 2.1 Update or replace any rule engine tests that assert exact exercise ordering. New tests should verify that: all selected exercises exist in the expected bucket, no exercise appears twice in a session, and repeated calls with different seeds produce different orderings with high probability.

## 3. Validation

- [x] 3.1 Generate two mesocyclus plans back-to-back; confirm session templates differ in exercise selection.
- [x] 3.2 Confirm each session still contains the correct number of exercises and no cross-bucket contamination (a Push session should not contain back exercises, etc.).
