import { describe, expect, it } from "bun:test";
import { validatePlan } from "../../../../packages/shared/src/plan-validation";

import type { GeneratePlanOptions } from "./rule-engine.service";
import { RuleEngineService } from "./rule-engine.service";

const BODYWEIGHT_POOL = [
  {
    id: "exercise-back-1",
    nameEn: "Bird Dog",
    suggestedRestSecs: 30,
    tags: [
      { tag: { category: "EQUIPMENT", value: "bodyweight" } },
      { tag: { category: "MUSCLE_GROUP", value: "core" } },
    ],
  },
  {
    id: "exercise-back-2",
    nameEn: "Pull-up",
    suggestedRestSecs: 75,
    tags: [
      { tag: { category: "EQUIPMENT", value: "bodyweight" } },
      { tag: { category: "MUSCLE_GROUP", value: "lats" } },
    ],
  },
  {
    id: "exercise-push-1",
    nameEn: "Push-up",
    suggestedRestSecs: 60,
    tags: [
      { tag: { category: "EQUIPMENT", value: "bodyweight" } },
      { tag: { category: "MUSCLE_GROUP", value: "chest" } },
    ],
  },
  {
    id: "exercise-push-2",
    nameEn: "Pike Press",
    suggestedRestSecs: 60,
    tags: [
      { tag: { category: "EQUIPMENT", value: "bodyweight" } },
      { tag: { category: "MUSCLE_GROUP", value: "shoulders" } },
    ],
  },
  {
    id: "exercise-pull-1",
    nameEn: "Biceps Curl Iso",
    suggestedRestSecs: 45,
    tags: [
      { tag: { category: "EQUIPMENT", value: "bodyweight" } },
      { tag: { category: "MUSCLE_GROUP", value: "biceps" } },
    ],
  },
  {
    id: "exercise-pull-2",
    nameEn: "March in Place",
    suggestedRestSecs: 30,
    tags: [
      { tag: { category: "EQUIPMENT", value: "bodyweight" } },
      { tag: { category: "MUSCLE_GROUP", value: "conditioning" } },
    ],
  },
];

// Pool with 4 exercises per bucket for cross-contamination checks
const FULL_BUCKET_POOL = [
  // Bucket A: back/core/lats/upper_back
  {
    id: "a1",
    nameEn: "Bird Dog",
    suggestedRestSecs: 30,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "core" } }],
  },
  {
    id: "a2",
    nameEn: "Deadbug",
    suggestedRestSecs: 30,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "back" } }],
  },
  {
    id: "a3",
    nameEn: "Pull-up",
    suggestedRestSecs: 75,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "lats" } }],
  },
  {
    id: "a4",
    nameEn: "Row",
    suggestedRestSecs: 60,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "upper_back" } }],
  },
  // Bucket B: chest/shoulders/triceps/rear_delts
  {
    id: "b1",
    nameEn: "Push-up",
    suggestedRestSecs: 60,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "chest" } }],
  },
  {
    id: "b2",
    nameEn: "Pike Press",
    suggestedRestSecs: 60,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "shoulders" } }],
  },
  {
    id: "b3",
    nameEn: "Triceps Dip",
    suggestedRestSecs: 60,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "triceps" } }],
  },
  {
    id: "b4",
    nameEn: "Face Pull",
    suggestedRestSecs: 45,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "rear_delts" } }],
  },
  // Bucket C: biceps/conditioning/mobility/pull
  {
    id: "c1",
    nameEn: "Biceps Curl",
    suggestedRestSecs: 45,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "biceps" } }],
  },
  {
    id: "c2",
    nameEn: "March in Place",
    suggestedRestSecs: 30,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "conditioning" } }],
  },
  {
    id: "c3",
    nameEn: "Hip Hinge Stretch",
    suggestedRestSecs: 20,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "mobility" } }],
  },
  {
    id: "c4",
    nameEn: "Ring Row",
    suggestedRestSecs: 60,
    tags: [{ tag: { category: "MUSCLE_GROUP", value: "pull" } }],
  },
];

const BUCKET_A_IDS = new Set(["a1", "a2", "a3", "a4"]);
const BUCKET_B_IDS = new Set(["b1", "b2", "b3", "b4"]);
const BUCKET_C_IDS = new Set(["c1", "c2", "c3", "c4"]);
const BUCKET_IDS_BY_LABEL: Record<string, Set<string>> = {
  A: BUCKET_A_IDS,
  B: BUCKET_B_IDS,
  C: BUCKET_C_IDS,
};

describe("RuleEngineService", () => {
  const makeEngine = () =>
    new RuleEngineService(() => ({
      list: async () => BODYWEIGHT_POOL,
    }));

  const defaultOpts = (
    overrides: Partial<GeneratePlanOptions> = {},
  ): GeneratePlanOptions => ({
    equipmentTags: ["bodyweight"],
    sessionMinutes: 30,
    userId: "u1",
    weeksCount: 4,
    ...overrides,
  });

  it("produces A/B/C rotation from bodyweight pool", async () => {
    let receivedFilters:
      | {
          excludeModifiers?: string[];
          limit?: number;
          tags?: string[];
        }
      | undefined;

    const ruleEngine = new RuleEngineService(() => ({
      list: async (filters) => {
        receivedFilters = filters;
        return BODYWEIGHT_POOL;
      },
    }));

    const plan = await ruleEngine.generate(
      defaultOpts({ excludeModifiers: ["knee_load"] }),
    );

    expect(receivedFilters).toEqual({
      excludeModifiers: ["knee_load"],
      limit: 100,
      tags: ["bodyweight"],
    });
    expect(plan.workouts.map((workout) => workout.label)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(() => validatePlan(plan)).not.toThrow();
  });

  it("selects only exercises that exist in the pool", async () => {
    const ruleEngine = makeEngine();
    const plan = await ruleEngine.generate(defaultOpts({ seed: 1 }));

    const knownIds = new Set(BODYWEIGHT_POOL.map((e) => e.id));
    for (const workout of plan.workouts) {
      for (const exercise of workout.exercises) {
        expect(knownIds.has(exercise.exerciseId)).toBe(true);
      }
    }
  });

  it("does not repeat exercises within a session", async () => {
    const ruleEngine = makeEngine();
    const plan = await ruleEngine.generate(defaultOpts({ seed: 1 }));

    for (const workout of plan.workouts) {
      const ids = workout.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("produces the same plan when called with the same seed", async () => {
    const ruleEngine = makeEngine();

    const plan1 = await ruleEngine.generate(defaultOpts({ seed: 42 }));
    const plan2 = await ruleEngine.generate(defaultOpts({ seed: 42 }));

    const exerciseIds = (plan: typeof plan1) =>
      plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId));

    expect(exerciseIds(plan1)).toEqual(exerciseIds(plan2));
  });

  it("produces different orderings with different seeds with high probability", async () => {
    const ruleEngine = makeEngine();

    const plans = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        ruleEngine.generate(defaultOpts({ seed: i + 1 })),
      ),
    );

    const orderings = new Set(
      plans.map((plan) =>
        plan.workouts
          .flatMap((w) => w.exercises.map((e) => e.exerciseId))
          .join(","),
      ),
    );

    expect(orderings.size).toBeGreaterThan(1);
  });

  it("generates different session templates across back-to-back mesocyclus plans", async () => {
    const ruleEngine = new RuleEngineService(() => ({
      list: async () => FULL_BUCKET_POOL,
    }));

    const plan1 = await ruleEngine.generate({ ...defaultOpts(), seed: 100 });
    const plan2 = await ruleEngine.generate({ ...defaultOpts(), seed: 200 });

    const ids1 = plan1.workouts
      .flatMap((w) => w.exercises.map((e) => e.exerciseId))
      .join(",");
    const ids2 = plan2.workouts
      .flatMap((w) => w.exercises.map((e) => e.exerciseId))
      .join(",");

    expect(ids1).not.toBe(ids2);
  });

  it("produces correct exercise count per session with no cross-bucket contamination", async () => {
    const ruleEngine = new RuleEngineService(() => ({
      list: async () => FULL_BUCKET_POOL,
    }));

    const plan = await ruleEngine.generate({ ...defaultOpts(), seed: 1 });

    for (const workout of plan.workouts) {
      expect(workout.exercises).toHaveLength(4);

      const bucketIds = BUCKET_IDS_BY_LABEL[workout.label];
      for (const exercise of workout.exercises) {
        expect(bucketIds.has(exercise.exerciseId)).toBe(true);
      }
    }
  });
});
