import crypto from "node:crypto";

type SeedExerciseInput = {
  contentHash: string;
  imageAltText: string;
  nameDe?: string | null;
  nameEn: string;
  primaryMuscle: string;
};

type ExerciseSeedStore = {
  exercise: {
    findFirst(args: {
      where: {
        contentHash?: string | null;
        nameEn?: string;
      };
    }): Promise<{ contentHash: string | null; id: string } | null>;
    upsert(args: {
      create: {
        contentHash: string;
        imageAltText: string;
        nameDe?: string | null;
        nameEn: string;
      };
      update: {
        contentHash: string;
        imageAltText: string;
        nameDe?: string | null;
      };
      where: {
        nameEn: string;
      };
    }): Promise<unknown>;
  };
};

export function computeExerciseHash(exercise: {
  nameEn: string;
  primaryMuscle: string;
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        nameEn: exercise.nameEn,
        primaryMuscle: exercise.primaryMuscle,
      }),
    )
    .digest("hex");
}

export function buildImageAltText(exercise: {
  movementName: string;
  phase?: string | null;
  primaryMuscle: string;
}) {
  return [
    exercise.movementName,
    `${exercise.primaryMuscle} focus`,
    exercise.phase ?? "full movement",
  ].join(", ");
}

export class ExerciseSeederService {
  constructor(private readonly store: ExerciseSeedStore) {}

  async seedExercise(input: SeedExerciseInput) {
    const existingExercise = await this.store.exercise.findFirst({
      where: {
        contentHash: input.contentHash,
      },
    });

    if (existingExercise) {
      return {
        skipped: true as const,
      };
    }

    await this.store.exercise.upsert({
      where: {
        nameEn: input.nameEn,
      },
      update: {
        contentHash: input.contentHash,
        imageAltText: input.imageAltText,
        nameDe: input.nameDe,
      },
      create: {
        contentHash: input.contentHash,
        imageAltText: input.imageAltText,
        nameDe: input.nameDe,
        nameEn: input.nameEn,
      },
    });

    return {
      skipped: false as const,
    };
  }
}
