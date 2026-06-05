import { db } from "../db/client";

type ExerciseDbClient = Pick<typeof db, "exercise">;

type ExerciseRepoContext = {
  tx?: ExerciseDbClient;
  userId: string;
};

type ExerciseListFilters = {
  excludeModifiers?: string[];
  limit?: number;
  tags?: string[];
};

export class ExerciseRepository {
  private readonly client: ExerciseDbClient;

  constructor(private readonly ctx: ExerciseRepoContext) {
    this.client = ctx.tx ?? db;
  }

  async list(filters: ExerciseListFilters) {
    return this.client.exercise.findMany({
      where: {
        isGlobal: true,
        // Equipment tag filtering (filters.tags) is intentionally not applied here.
        // Exercises do not yet have EQUIPMENT-category tags in the database, so
        // filtering by equipment pool tags always returns 0 results. The rule engine's
        // muscle-group bucket system handles exercise selection instead. This filter
        // can be re-enabled once exercises are tagged with EQUIPMENT categories.
        ...(filters.excludeModifiers?.length
          ? {
              NOT: {
                tags: {
                  some: {
                    tag: {
                      category: "MODIFIER",
                      value: { in: filters.excludeModifiers },
                    },
                  },
                },
              },
            }
          : {}),
      },
      take: Math.min(filters.limit ?? 20, 100),
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }
}
