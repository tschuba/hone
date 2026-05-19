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
        ...(filters.tags?.length
          ? {
              tags: {
                some: {
                  tag: {
                    value: {
                      in: filters.tags,
                    },
                  },
                },
              },
            }
          : {}),
        ...(filters.excludeModifiers?.length
          ? {
              tags: {
                none: {
                  tag: {
                    category: "MODIFIER",
                    value: {
                      in: filters.excludeModifiers,
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
