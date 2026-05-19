import { beforeEach, describe, expect, it, mock } from "bun:test";

import {
  ExerciseSeederService,
  buildImageAltText,
  computeExerciseHash,
} from "./exercise-tagger.service";

describe("exercise seeder service", () => {
  const findFirst = mock();
  const upsert = mock();
  const store = {
    exercise: {
      findFirst,
      upsert,
    },
  };

  beforeEach(() => {
    findFirst.mockReset();
    upsert.mockReset();
  });

  it("computes a stable content hash from name and primary muscle", () => {
    expect(
      computeExerciseHash({
        nameEn: "Push-up",
        primaryMuscle: "chest",
      }),
    ).toBe(
      computeExerciseHash({
        nameEn: "Push-up",
        primaryMuscle: "chest",
      }),
    );
  });

  it("builds non-empty image alt text", () => {
    expect(
      buildImageAltText({
        movementName: "Push-up",
        primaryMuscle: "chest",
      }),
    ).toBe("Push-up, chest focus, full movement");
  });

  it("skips re-seeding unchanged exercises", async () => {
    const service = new ExerciseSeederService(store);
    const contentHash = computeExerciseHash({
      nameEn: "Push-up",
      primaryMuscle: "chest",
    });

    findFirst.mockResolvedValueOnce(null);
    await service.seedExercise({
      contentHash,
      imageAltText: "Push-up, chest focus, full movement",
      nameEn: "Push-up",
      primaryMuscle: "chest",
    });

    expect(upsert).toHaveBeenCalledTimes(1);

    findFirst.mockResolvedValueOnce({
      contentHash,
      id: "exercise-1",
    });
    upsert.mockClear();

    const result = await service.seedExercise({
      contentHash,
      imageAltText: "Push-up, chest focus, full movement",
      nameEn: "Push-up",
      primaryMuscle: "chest",
    });

    expect(result).toEqual({ skipped: true });
    expect(upsert).not.toHaveBeenCalled();
  });
});
