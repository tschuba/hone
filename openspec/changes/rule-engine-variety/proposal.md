## Why

The rule engine sorts the exercise pool alphabetically and always selects the same four exercises per session (positions 0–3). With no randomisation, every Session 1 in every cycle of a mesocyclus is identical. A user doing a 4-cycle mesocyclus performs the exact same exercises 4 times in a row before the plan ends. Adding more exercises to the fixture library does not help because the extra exercises are never reached.

## What Changes

- Replace the deterministic alphabetical sort in `selectExercises` with a seeded shuffle so the exercise selection varies between mesocyclus generations.
- Ensure the shuffle is stable within a single generated plan — the same seed produces the same result, so a mesocyclus is consistent once generated. Variety comes from generating a new mesocyclus, not from session-to-session drift within one.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `plan-generation` (implicit): exercise selection within each session bucket now varies between generated plans.

## Impact

- Modifies `apps/api/src/services/rule-engine.service.ts` (`sortExercises` and/or `selectExercises`).
- Existing tests for deterministic output will need to be updated to account for seeded randomness, or refactored to test distribution properties rather than exact ordering.
