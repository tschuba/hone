import {
  type MesocyclusPlan,
  validatePlan,
} from "../../../../packages/shared/src/plan-validation";

import { ExerciseRepository } from "../repositories/exercise.repo";

type RuleEngineTag = {
  tag: {
    category: string;
    value: string;
  };
};

type RuleEngineExerciseRecord = {
  id: string;
  nameEn: string;
  suggestedRestSecs?: number | null;
  tags: RuleEngineTag[];
};

type RuleEngineRepository = {
  list(filters: {
    excludeModifiers?: string[];
    limit?: number;
    tags?: string[];
  }): Promise<RuleEngineExerciseRecord[]>;
};

export type GeneratePlanOptions = {
  equipmentTags: string[];
  excludeModifiers?: string[];
  sessionMinutes: number;
  userId: string;
  weeksCount: number;
};

type WorkoutLabel = "A" | "B" | "C";

const WORKOUT_LABELS: WorkoutLabel[] = ["A", "B", "C"];
const BUCKET_TAGS: Record<WorkoutLabel, string[]> = {
  A: [
    "back",
    "core",
    "hamstrings",
    "hinge",
    "lats",
    "lower_back",
    "obliques",
    "upper_back",
  ],
  B: ["chest", "push", "rear_delts", "shoulders", "triceps"],
  C: ["biceps", "conditioning", "mobility", "pull"],
};

function sortExercises(exercises: RuleEngineExerciseRecord[]) {
  return [...exercises].sort((left, right) => {
    const byName = left.nameEn.localeCompare(right.nameEn);

    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizeTags(exercise: RuleEngineExerciseRecord) {
  return exercise.tags.map(({ tag }) => ({
    category: tag.category,
    value: tag.value,
  }));
}

function hasAnyBucketTag(exercise: RuleEngineExerciseRecord, values: string[]) {
  const tags = new Set(
    exercise.tags.map(({ tag }) =>
      `${tag.category}:${tag.value}`.toLowerCase(),
    ),
  );

  return values.some((value) => tags.has(`muscle_group:${value}`));
}

function dedupeExercises(exercises: RuleEngineExerciseRecord[]) {
  const seenIds = new Set<string>();

  return exercises.filter((exercise) => {
    if (seenIds.has(exercise.id)) {
      return false;
    }

    seenIds.add(exercise.id);
    return true;
  });
}

function decorateExercise(
  exercise: RuleEngineExerciseRecord,
  position: number,
  phase: "warmup" | "main" | "cooldown",
) {
  const baseTags = normalizeTags(exercise);
  const categoryTags = baseTags.filter((tag) => tag.category === "CATEGORY");
  const tags = categoryTags.some((tag) => tag.value === phase)
    ? baseTags
    : [...baseTags, { category: "CATEGORY", value: phase }];

  if (phase === "warmup") {
    return {
      durationSecs: 180,
      exerciseId: exercise.id,
      position,
      restSecsOverride: 15,
      sets: 1,
      tags,
    };
  }

  if (phase === "cooldown") {
    return {
      durationSecs: 120,
      exerciseId: exercise.id,
      position,
      restSecsOverride: 15,
      sets: 1,
      tags,
    };
  }

  return {
    exerciseId: exercise.id,
    position,
    reps: 10,
    restSecsOverride: exercise.suggestedRestSecs ?? 60,
    sets: 3,
    tags,
  };
}

function selectExercises(
  bucket: RuleEngineExerciseRecord[],
  fallbackPool: RuleEngineExerciseRecord[],
) {
  const selected = dedupeExercises([...bucket, ...fallbackPool]);

  if (selected.length === 0) {
    throw new Error("No exercises available for selected filters");
  }

  const warmup = selected[0];
  const mainA = selected[1] ?? selected[0];
  const mainB = selected[2] ?? selected[1] ?? selected[0];
  const cooldown = selected[3] ?? selected[2] ?? selected[1] ?? selected[0];

  return [warmup, mainA, mainB, cooldown];
}

function estimateDuration(sessionMinutes: number) {
  return Math.max(12, Math.min(sessionMinutes, 90));
}

export class RuleEngineService {
  constructor(
    private readonly createRepository: (
      userId: string,
    ) => RuleEngineRepository = (userId) => new ExerciseRepository({ userId }),
  ) {}

  async generate(opts: GeneratePlanOptions): Promise<MesocyclusPlan> {
    const repository = this.createRepository(opts.userId);
    const pool = sortExercises(
      await repository.list({
        excludeModifiers: opts.excludeModifiers,
        limit: 100,
        tags: opts.equipmentTags,
      }),
    );

    const workouts = WORKOUT_LABELS.map((label, index) => {
      const bucket = pool.filter((exercise) =>
        hasAnyBucketTag(exercise, BUCKET_TAGS[label]),
      );
      const [warmup, mainA, mainB, cooldown] = selectExercises(bucket, pool);

      return {
        estimatedDurationMinutes: estimateDuration(opts.sessionMinutes),
        exercises: [
          decorateExercise(warmup, 1, "warmup"),
          decorateExercise(mainA, 2, "main"),
          decorateExercise(mainB, 3, "main"),
          decorateExercise(cooldown, 4, "cooldown"),
        ],
        label,
        position: index + 1,
      };
    });

    return validatePlan({
      durationWeeks: opts.weeksCount,
      planSource: "rule_based",
      workouts,
      workoutsPerWeek: WORKOUT_LABELS.length,
    });
  }
}
