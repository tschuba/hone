import Ajv from "ajv";

export interface PlanTag {
  category: string;
  value: string;
}

export interface MesocyclusExercise {
  durationSecs?: number;
  exerciseId: string;
  position: number;
  reps?: number;
  restSecsOverride?: number;
  sets: number;
  tags: PlanTag[];
}

export interface WorkoutTemplate {
  estimatedDurationMinutes: number;
  exercises: MesocyclusExercise[];
  label: "A" | "B" | "C";
  position: number;
}

export interface MesocyclusPlan {
  durationWeeks: number;
  planSource: "rule_based" | "ai_generated";
  workouts: WorkoutTemplate[];
  workoutsPerWeek: number;
}

const ajv = new Ajv({ allErrors: true, strict: true });

const workoutSchema = {
  type: "object",
  additionalProperties: false,
  required: ["durationWeeks", "planSource", "workouts", "workoutsPerWeek"],
  properties: {
    durationWeeks: { type: "integer", minimum: 1, maximum: 12 },
    planSource: { enum: ["rule_based", "ai_generated"] },
    workoutsPerWeek: { type: "integer", minimum: 1, maximum: 7 },
    workouts: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "estimatedDurationMinutes",
          "exercises",
          "label",
          "position",
        ],
        properties: {
          estimatedDurationMinutes: {
            type: "integer",
            minimum: 1,
            maximum: 240,
          },
          exercises: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["exerciseId", "position", "sets", "tags"],
              properties: {
                durationSecs: { type: "integer", minimum: 1, maximum: 7200 },
                exerciseId: { type: "string", minLength: 1 },
                position: { type: "integer", minimum: 1 },
                reps: { type: "integer", minimum: 1, maximum: 1000 },
                restSecsOverride: {
                  type: "integer",
                  minimum: 0,
                  maximum: 7200,
                },
                sets: { type: "integer", minimum: 1, maximum: 100 },
                tags: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["category", "value"],
                    properties: {
                      category: { type: "string", minLength: 1 },
                      value: { type: "string", minLength: 1 },
                    },
                  },
                },
              },
            },
          },
          label: { enum: ["A", "B", "C"] },
          position: { type: "integer", minimum: 1 },
        },
      },
    },
  },
} as const;

const validate = ajv.compile<MesocyclusPlan>(workoutSchema);

function hasCategoryTag(
  exercise: MesocyclusExercise | undefined,
  value: string,
) {
  return exercise?.tags.some(
    (tag) => tag.category === "CATEGORY" && tag.value === value,
  );
}

export function validatePlan(raw: unknown): MesocyclusPlan {
  if (!validate(raw)) {
    throw new Error(`Plan schema invalid: ${ajv.errorsText(validate.errors)}`);
  }

  const plan = raw as MesocyclusPlan;

  for (const workout of plan.workouts) {
    const firstExercise = workout.exercises[0];

    if (!hasCategoryTag(firstExercise, "warmup")) {
      throw new Error(
        `Workout ${workout.label}: first exercise must be warm-up`,
      );
    }

    const lastExercise = workout.exercises.at(-1);

    if (!hasCategoryTag(lastExercise, "cooldown")) {
      throw new Error(
        `Workout ${workout.label}: last exercise must be cool-down`,
      );
    }

    for (const exercise of workout.exercises) {
      if (exercise.reps === undefined && exercise.durationSecs === undefined) {
        throw new Error(
          `Workout ${workout.label} exercise ${exercise.position}: reps or durationSecs must be provided`,
        );
      }
    }
  }

  return plan;
}
