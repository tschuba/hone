# Design: Rule Engine Variety

## Problem

`RuleEngineService.generate()` sorted the exercise pool alphabetically before selection. Because `selectExercises` always picks positions 0–3 from the sorted pool, every generated plan produced identical exercise selection for a given equipment filter. A user repeating a mesocyclus performed the exact same exercises every cycle.

## Solution

Replace the deterministic sort with a seeded Fisher-Yates shuffle. Each call to `generate()` uses a fresh seed (defaulting to `Date.now()`) so successive mesocyclus generations differ. Within a single generated plan the seed is fixed, so the plan is internally consistent.

## PRNG Design

A mulberry32-style integer hash function is used to create a lightweight seedable PRNG with no external dependencies:

```
createRandom(seed) → () => float in [0, 1)
```

This is sufficient for non-cryptographic shuffle randomness and avoids pulling in a library for a single use.

## Shuffle Strategy

Each bucket (A / B / C) is shuffled independently using the same advancing PRNG instance before `selectExercises` runs. This means:

- Session A draws from a shuffled back/core pool
- Session B draws from a shuffled push pool
- Session C draws from a shuffled pull pool

The fallback pool passed to `selectExercises` is also independently shuffled, ensuring fallback selection is also varied.

## API Change

`GeneratePlanOptions` gains an optional `seed?: number`. When omitted, `Date.now()` is used. Callers may pass an explicit seed to reproduce a specific plan (useful for tests and debugging).

## Files Changed

- `apps/api/src/services/rule-engine.service.ts` — replaces `sortExercises` with `createRandom` + `shuffleExercises`; adds `seed` to `GeneratePlanOptions`; updates `generate()` to shuffle per-bucket
- `apps/api/src/services/rule-engine.service.test.ts` — replaces deterministic ordering assertions with property-based tests
