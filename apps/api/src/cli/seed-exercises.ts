import { closeDatabase, db } from "../db/client";
import {
  ExerciseSeederService,
  buildImageAltText,
  computeExerciseHash,
} from "../services/exercise-tagger.service";
import { Tier1Tagger } from "../services/tier1-tagger.service";

type ExerciseFixture = {
  category: string;
  nameEn: string;
  primaryMuscle: string;
};

const FIXTURE_EXERCISES: ExerciseFixture[] = [
  { category: "chest", nameEn: "Push-up", primaryMuscle: "chest" },
  { category: "legs", nameEn: "Barbell Squat", primaryMuscle: "quads" },
  {
    category: "back",
    nameEn: "Romanian Deadlift",
    primaryMuscle: "hamstrings",
  },
  { category: "back", nameEn: "Pull-up", primaryMuscle: "lats" },
  { category: "legs", nameEn: "Forward Lunge", primaryMuscle: "glutes" },
  { category: "legs", nameEn: "Step Up", primaryMuscle: "quads" },
  { category: "legs", nameEn: "Leg Press", primaryMuscle: "quads" },
  {
    category: "shoulders",
    nameEn: "Overhead Press",
    primaryMuscle: "shoulders",
  },
  { category: "back", nameEn: "Bent Over Row", primaryMuscle: "upper back" },
  { category: "core", nameEn: "Dead Bug", primaryMuscle: "core" },
  { category: "core", nameEn: "Bird Dog", primaryMuscle: "core" },
  { category: "legs", nameEn: "Goblet Squat", primaryMuscle: "quads" },
  { category: "legs", nameEn: "Split Squat", primaryMuscle: "glutes" },
  { category: "legs", nameEn: "Reverse Lunge", primaryMuscle: "glutes" },
  { category: "legs", nameEn: "Hip Hinge", primaryMuscle: "hamstrings" },
  { category: "legs", nameEn: "Glute Bridge", primaryMuscle: "glutes" },
  { category: "legs", nameEn: "Calf Raise", primaryMuscle: "calves" },
  { category: "back", nameEn: "Seated Cable Row", primaryMuscle: "upper back" },
  { category: "back", nameEn: "Lat Pulldown", primaryMuscle: "lats" },
  { category: "chest", nameEn: "Incline Push-up", primaryMuscle: "chest" },
  { category: "chest", nameEn: "Dumbbell Bench Press", primaryMuscle: "chest" },
  {
    category: "shoulders",
    nameEn: "Lateral Raise",
    primaryMuscle: "shoulders",
  },
  {
    category: "shoulders",
    nameEn: "Rear Delt Fly",
    primaryMuscle: "rear delts",
  },
  { category: "arms", nameEn: "Biceps Curl", primaryMuscle: "biceps" },
  { category: "arms", nameEn: "Hammer Curl", primaryMuscle: "biceps" },
  { category: "arms", nameEn: "Triceps Pressdown", primaryMuscle: "triceps" },
  { category: "core", nameEn: "Side Plank", primaryMuscle: "obliques" },
  { category: "core", nameEn: "Front Plank", primaryMuscle: "core" },
  { category: "core", nameEn: "Pallof Press", primaryMuscle: "core" },
  { category: "legs", nameEn: "Box Squat", primaryMuscle: "quads" },
  { category: "legs", nameEn: "Single Leg Step-up", primaryMuscle: "glutes" },
  { category: "back", nameEn: "Good Morning", primaryMuscle: "lower back" },
  {
    category: "back",
    nameEn: "Chest Supported Row",
    primaryMuscle: "upper back",
  },
  { category: "back", nameEn: "Single Arm Row", primaryMuscle: "lats" },
  { category: "chest", nameEn: "Floor Press", primaryMuscle: "chest" },
  { category: "chest", nameEn: "Chest Fly", primaryMuscle: "chest" },
  { category: "legs", nameEn: "Wall Sit", primaryMuscle: "quads" },
  { category: "legs", nameEn: "Leg Extension", primaryMuscle: "quads" },
  { category: "legs", nameEn: "Hamstring Curl", primaryMuscle: "hamstrings" },
  {
    category: "legs",
    nameEn: "Single Leg Deadlift",
    primaryMuscle: "hamstrings",
  },
  { category: "shoulders", nameEn: "Arnold Press", primaryMuscle: "shoulders" },
  { category: "shoulders", nameEn: "Face Pull", primaryMuscle: "rear delts" },
  { category: "arms", nameEn: "Skull Crusher", primaryMuscle: "triceps" },
  { category: "arms", nameEn: "Cable Curl", primaryMuscle: "biceps" },
  { category: "core", nameEn: "Hollow Hold", primaryMuscle: "core" },
  { category: "core", nameEn: "Farmer Carry", primaryMuscle: "core" },
  { category: "conditioning", nameEn: "Row Erg", primaryMuscle: "full body" },
  { category: "conditioning", nameEn: "Bike Erg", primaryMuscle: "legs" },
  { category: "conditioning", nameEn: "Walking", primaryMuscle: "legs" },
  { category: "conditioning", nameEn: "March in Place", primaryMuscle: "legs" },

  // Pulling
  { category: "back", nameEn: "Chin-up", primaryMuscle: "biceps" },
  {
    category: "back",
    nameEn: "Australian Pull-up",
    primaryMuscle: "upper back",
  },
  { category: "core", nameEn: "Hanging Knee Raise", primaryMuscle: "core" },
  { category: "back", nameEn: "Scapular Pull-up", primaryMuscle: "upper back" },

  // Pushing
  { category: "chest", nameEn: "Dips", primaryMuscle: "triceps" },
  { category: "shoulders", nameEn: "Pike Push-up", primaryMuscle: "shoulders" },
  { category: "chest", nameEn: "Diamond Push-up", primaryMuscle: "triceps" },
  { category: "chest", nameEn: "Wide Push-up", primaryMuscle: "chest" },
  { category: "chest", nameEn: "Archer Push-up", primaryMuscle: "chest" },

  // Core
  { category: "core", nameEn: "Hollow Rock", primaryMuscle: "core" },
  { category: "core", nameEn: "L-sit Hold", primaryMuscle: "core" },
  { category: "core", nameEn: "Tuck L-sit", primaryMuscle: "core" },
  { category: "core", nameEn: "Dragon Flag Negative", primaryMuscle: "core" },
  {
    category: "conditioning",
    nameEn: "Mountain Climbers",
    primaryMuscle: "core",
  },
  { category: "core", nameEn: "Crucifix Crunch", primaryMuscle: "obliques" },

  // Conditioning / full-body
  {
    category: "conditioning",
    nameEn: "Burpees",
    primaryMuscle: "conditioning",
  },
  {
    category: "conditioning",
    nameEn: "Jump Squat",
    primaryMuscle: "conditioning",
  },
  { category: "conditioning", nameEn: "Bear Crawl", primaryMuscle: "core" },
  { category: "core", nameEn: "Inchworm", primaryMuscle: "core" },
];

async function waitForApiReady() {
  const response = await fetch("http://127.0.0.1:3001/health/ready");

  if (!response.ok) {
    throw new Error("API is not ready for exercise seeding");
  }
}

async function seedFixtures() {
  const seeder = new ExerciseSeederService({
    exercise: {
      async findFirst(args) {
        return db.exercise.findFirst(args);
      },
      async upsert(args) {
        const existingExercise = await db.exercise.findFirst({
          where: {
            nameEn: args.where.nameEn,
          },
        });

        if (existingExercise) {
          return db.exercise.update({
            where: {
              id: existingExercise.id,
            },
            data: args.update,
          });
        }

        return db.exercise.create({
          data: args.create,
        });
      },
    },
  });
  const tier1Tagger = new Tier1Tagger();

  for (const fixture of FIXTURE_EXERCISES) {
    const contentHash = computeExerciseHash(fixture);
    const result = await seeder.seedExercise({
      contentHash,
      imageAltText: buildImageAltText({
        movementName: fixture.nameEn,
        primaryMuscle: fixture.primaryMuscle,
      }),
      nameEn: fixture.nameEn,
      primaryMuscle: fixture.primaryMuscle,
    });

    const exercise = await db.exercise.findFirst({
      where: { nameEn: fixture.nameEn },
    });

    if (!exercise) {
      continue;
    }

    const muscleGroupTag = await db.tag.upsert({
      where: {
        category_value: {
          category: "MUSCLE_GROUP",
          value: fixture.primaryMuscle.toLowerCase().replace(/\s+/g, "_"),
        },
      },
      update: {},
      create: {
        category: "MUSCLE_GROUP",
        value: fixture.primaryMuscle.toLowerCase().replace(/\s+/g, "_"),
      },
    });

    await db.exerciseTag.upsert({
      where: {
        exerciseId_tagId: {
          exerciseId: exercise.id,
          tagId: muscleGroupTag.id,
        },
      },
      update: { confidence: 1.0, source: "HEURISTIC" },
      create: {
        confidence: 1.0,
        exerciseId: exercise.id,
        source: "HEURISTIC",
        tagId: muscleGroupTag.id,
      },
    });

    const categoryTag = await db.tag.upsert({
      where: {
        category_value: {
          category: "CATEGORY",
          value: fixture.category,
        },
      },
      update: {},
      create: {
        category: "CATEGORY",
        value: fixture.category,
      },
    });

    await db.exerciseTag.upsert({
      where: {
        exerciseId_tagId: {
          exerciseId: exercise.id,
          tagId: categoryTag.id,
        },
      },
      update: { confidence: 1.0, source: "HEURISTIC" },
      create: {
        confidence: 1.0,
        exerciseId: exercise.id,
        source: "HEURISTIC",
        tagId: categoryTag.id,
      },
    });

    if (result.skipped) {
      continue;
    }

    for (const tier1Tag of tier1Tagger.tag(fixture)) {
      const tag = await db.tag.upsert({
        where: {
          category_value: {
            category: tier1Tag.category,
            value: tier1Tag.value,
          },
        },
        update: {},
        create: {
          category: tier1Tag.category,
          value: tier1Tag.value,
        },
      });

      await db.exerciseTag.upsert({
        where: {
          exerciseId_tagId: {
            exerciseId: exercise.id,
            tagId: tag.id,
          },
        },
        update: {
          confidence: tier1Tag.confidence,
          source: "HEURISTIC",
        },
        create: {
          confidence: tier1Tag.confidence,
          exerciseId: exercise.id,
          source: "HEURISTIC",
          tagId: tag.id,
        },
      });
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));

  if (!args.has("--fixture-only")) {
    throw new Error("Only --fixture-only seeding is currently implemented");
  }

  if (!args.has("--no-wait")) {
    await waitForApiReady();
  }

  await seedFixtures();
  await closeDatabase();
}

main().catch(async (error) => {
  console.error("Exercise seeding failed", error);
  await closeDatabase();
  process.exit(1);
});
