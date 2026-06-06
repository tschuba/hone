## 1. Extend Fixture Exercises

- [x] 1.1 Add pulling movements to `FIXTURE_EXERCISES` in `apps/api/src/cli/seed-exercises.ts`:
  Chin-up (biceps/lats), Australian Pull-up / Inverted Row (upper back), Hanging Knee Raise (core/pull), Scapular Pull-up (upper back).

- [x] 1.2 Add pushing movements:
  Dips (triceps/chest), Pike Push-up (shoulders), Diamond Push-up (triceps/chest), Wide Push-up (chest), Archer Push-up (chest/shoulders).

- [x] 1.3 Add core movements:
  Hollow Rock (core), L-sit Hold (core), Tuck L-sit (core), Dragon Flag negative (core), Mountain Climbers (core/conditioning), Crucifix Crunch (obliques).

- [x] 1.4 Add conditioning / full-body movements:
  Burpees (conditioning), Jump Squat (legs/conditioning), Bear Crawl (core/conditioning), Inchworm (core/mobility).

- [x] 1.5 Verify each new exercise has a `primaryMuscle` value that maps to an existing muscle-group tag used by the rule engine buckets (back, lats, biceps, chest, shoulders, triceps, core, conditioning).

- [x] 1.6 Tag knee-loading exercises with the `knee_load` modifier so the rule engine excludes them when the user's impact constraint is active. The following new exercises require this tag:
  Jump Squat, Burpees, Mountain Climbers, Bear Crawl (mild but tagged for safety).
  Existing fixtures that should already be tagged but must be verified: Forward Lunge, Reverse Lunge, Split Squat, Step Up, Single Leg Step-up, Box Squat, Wall Sit, Leg Extension, Goblet Squat.

## 2. Validation

- [x] 2.1 Run `bun run cli seed-exercises --fixture-only` against a clean database; confirm all new exercises are created and none of the existing 50 are duplicated.
- [x] 2.2 Generate a plan with equipment pool set to bodyweight + pull-up bar + rower; confirm all 3 session templates contain exercises from the new fixture set and no barbell/machine exercises appear.
- [x] 2.3 Generate a plan with the knee impact constraint enabled; confirm no `knee_load`-tagged exercises appear in any session template.
