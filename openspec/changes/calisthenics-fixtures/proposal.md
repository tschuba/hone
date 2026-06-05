## Why

The current fixture seed contains 50 exercises, of which roughly 22 are usable for a bodyweight + pull-up bar + rowing erg setup. The pulling category has only one exercise (Pull-up), and common calisthenics movements like dips, pike push-ups, chin-ups, and inverted rows are absent. The rule engine selects exercises by muscle-group bucket; with so few options per bucket, generated sessions will repeat the same exercises every cycle and fail to produce meaningful variety.

## What Changes

- Extend the fixture exercise list with ~25 targeted calisthenics movements covering the pulling, pushing, core, and conditioning buckets.
- Ensure each new exercise is tagged with the correct muscle-group values so the rule engine places it in the right session bucket.
- No changes to the rule engine, seeder infrastructure, or schema.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `exercise-library` (implicit): broader calisthenics coverage in the default fixture set.

## Impact

- Modifies `apps/api/src/cli/seed-exercises.ts` (FIXTURE_EXERCISES array and associated tags).
- Re-running `bun run cli seed-exercises --fixture-only` will seed the new exercises without duplicating existing ones (content-hash dedup is already in place).
