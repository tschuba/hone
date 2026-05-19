import { describe, expect, it } from "bun:test";
import { validatePlan } from "../../../../packages/shared/src/plan-validation";

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

describe("RuleEngineService", () => {
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

    const plan = await ruleEngine.generate({
      equipmentTags: ["bodyweight"],
      excludeModifiers: ["knee_load"],
      sessionMinutes: 30,
      userId: "u1",
      weeksCount: 4,
    });

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
});
