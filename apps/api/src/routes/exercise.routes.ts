import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";
import { ExerciseRepository } from "../repositories/exercise.repo";

type ExerciseRouteRecord = {
  id: string;
  imageAltText: string;
  nameEn: string;
  tags: Array<{
    tag: {
      category: string;
      value: string;
    };
  }>;
};

type ExerciseRouteListService = {
  list(filters: {
    excludeModifiers?: string[];
    limit?: number;
    tags?: string[];
  }): Promise<ExerciseRouteRecord[]>;
};

type ExerciseRouteOptions = {
  authGuard?: MiddlewareHandler;
  createRepository?: (userId: string) => ExerciseRouteListService;
};

function readCsvQueryValue(value: string | undefined) {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createExerciseRoutes(options: ExerciseRouteOptions = {}) {
  const exerciseRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const createRepository =
    options.createRepository ??
    ((userId: string) => new ExerciseRepository({ userId }));

  exerciseRoutes.use("*", authGuard);

  exerciseRoutes.get("/", async (c) => {
    const repository = createRepository(c.get("userId"));
    const tags = readCsvQueryValue(c.req.query("tags"));
    const excludeModifiers = readCsvQueryValue(c.req.query("excludeModifiers"));
    const limitParam = c.req.query("limit");
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const limit =
      parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? parsedLimit
        : undefined;

    const exercises = await repository.list({
      excludeModifiers,
      limit,
      tags,
    });

    return c.json(
      {
        items: exercises.map((exercise) => ({
          id: exercise.id,
          imageAltText: exercise.imageAltText,
          nameEn: exercise.nameEn,
          tags: exercise.tags.map(({ tag }) => ({
            category: tag.category,
            value: tag.value,
          })),
        })),
      },
      200,
    );
  });

  return exerciseRoutes;
}
