import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createExerciseRoutes } from "./exercise.routes";

function createTestApp(
  listImpl: (filters: {
    excludeModifiers?: string[];
    limit?: number;
    tags?: string[];
  }) => Promise<
    Array<{
      id: string;
      imageAltText: string;
      nameEn: string;
      tags: Array<{
        tag: {
          category: string;
          value: string;
        };
      }>;
    }>
  >,
) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/exercises",
    createExerciseRoutes({
      authGuard: async (c, next) => {
        c.set("sessionId", "session-1");
        c.set("userId", "user-1");
        await next();
      },
      createRepository: () => ({
        list: listImpl,
      }),
    }),
  );

  return app;
}

describe("exercise routes", () => {
  it("lists exercises with normalized tags", async () => {
    const app = createTestApp(async () => [
      {
        id: "exercise-1",
        imageAltText: "Push-up, chest focus, full movement",
        nameEn: "Push-up",
        tags: [
          {
            tag: {
              category: "MUSCLE_GROUP",
              value: "chest",
            },
          },
        ],
      },
    ]);

    const response = await app.request("http://hone.test/api/v1/exercises");
    const body = (await response.json()) as {
      items: Array<{
        id: string;
        imageAltText: string;
        nameEn: string;
        tags: Array<{ category: string; value: string }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      {
        id: "exercise-1",
        imageAltText: "Push-up, chest focus, full movement",
        nameEn: "Push-up",
        tags: [
          {
            category: "MUSCLE_GROUP",
            value: "chest",
          },
        ],
      },
    ]);
  });

  it("passes excludeModifiers filters through to the repository", async () => {
    let receivedFilters:
      | {
          excludeModifiers?: string[];
          limit?: number;
          tags?: string[];
        }
      | undefined;

    const app = createTestApp(async (filters) => {
      receivedFilters = filters;
      return [];
    });

    const response = await app.request(
      "http://hone.test/api/v1/exercises?excludeModifiers=knee_load,back_load&tags=chest,bodyweight&limit=10",
    );

    expect(response.status).toBe(200);
    expect(receivedFilters).toEqual({
      excludeModifiers: ["knee_load", "back_load"],
      limit: 10,
      tags: ["chest", "bodyweight"],
    });
  });
});
