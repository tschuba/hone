import { describe, expect, it } from "bun:test";

import { type MesocyclusPlan, validatePlan } from "./plan-validation";

function makeValidPlan(): MesocyclusPlan {
  return {
    durationWeeks: 4,
    planSource: "rule_based",
    workouts: [
      {
        estimatedDurationMinutes: 28,
        exercises: [
          {
            exerciseId: "warmup-a",
            position: 1,
            reps: 10,
            sets: 1,
            tags: [{ category: "CATEGORY", value: "warmup" }],
          },
          {
            exerciseId: "strength-a",
            position: 2,
            reps: 8,
            sets: 3,
            tags: [{ category: "MUSCLE_GROUP", value: "back" }],
          },
          {
            durationSecs: 60,
            exerciseId: "cooldown-a",
            position: 3,
            sets: 1,
            tags: [{ category: "CATEGORY", value: "cooldown" }],
          },
        ],
        label: "A",
        position: 1,
      },
      {
        estimatedDurationMinutes: 30,
        exercises: [
          {
            exerciseId: "warmup-b",
            position: 1,
            reps: 12,
            sets: 1,
            tags: [{ category: "CATEGORY", value: "warmup" }],
          },
          {
            exerciseId: "strength-b",
            position: 2,
            reps: 10,
            sets: 3,
            tags: [{ category: "MUSCLE_GROUP", value: "chest" }],
          },
          {
            durationSecs: 45,
            exerciseId: "cooldown-b",
            position: 3,
            sets: 1,
            tags: [{ category: "CATEGORY", value: "cooldown" }],
          },
        ],
        label: "B",
        position: 2,
      },
    ],
    workoutsPerWeek: 2,
  };
}

describe("validatePlan", () => {
  it("rejects a workout whose first exercise is not warm-up", () => {
    const plan = makeValidPlan();
    plan.workouts[0].exercises[0] = {
      ...plan.workouts[0].exercises[0],
      tags: [{ category: "CATEGORY", value: "strength" }],
    };

    expect(() => validatePlan(plan)).toThrow(
      "Workout A: first exercise must be warm-up",
    );
  });

  it("rejects a workout whose last exercise is not cool-down", () => {
    const plan = makeValidPlan();
    plan.workouts[0].exercises[2] = {
      ...plan.workouts[0].exercises[2],
      tags: [{ category: "CATEGORY", value: "mobility" }],
    };

    expect(() => validatePlan(plan)).toThrow(
      "Workout A: last exercise must be cool-down",
    );
  });

  it("rejects exercises without reps or duration", () => {
    const plan = makeValidPlan();
    plan.workouts[0].exercises[1] = {
      exerciseId: "strength-a",
      position: 2,
      sets: 3,
      tags: [{ category: "MUSCLE_GROUP", value: "back" }],
    };

    expect(() => validatePlan(plan)).toThrow(
      "Workout A exercise 2: reps or durationSecs must be provided",
    );
  });

  it("accepts a valid rule-based plan", () => {
    const plan = makeValidPlan();

    expect(() => validatePlan(plan)).not.toThrow();
    expect(validatePlan(plan)).toEqual(plan);
  });
});
