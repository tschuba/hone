import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import {
  type ProfileConstraints,
  type ProfileGoal,
  profileConstraintsSchema,
  profileGoalsSchema,
} from "../../../../packages/shared/src/config";

import { db } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";

type ProfileRecord = {
  constraints: ProfileConstraints;
  goals: ProfileGoal[];
};

type ProfileStorage = {
  exportUserData(userId: string): Promise<unknown>;
  findUserById(userId: string): Promise<ProfileRecord | null>;
  updateUser(input: {
    constraints: ProfileConstraints;
    goals: ProfileGoal[];
    userId: string;
  }): Promise<ProfileRecord>;
};

type ProfileRouteOptions = {
  authGuard?: MiddlewareHandler;
  storage?: ProfileStorage;
};

const defaultStorage: ProfileStorage = {
  async exportUserData(userId) {
    return db.user.findFirst({
      where: { id: userId },
      include: {
        aiJobs: {
          include: {
            generationLogs: true,
          },
        },
        bodyMetrics: true,
        equipmentPools: true,
        mesocycluses: {
          include: {
            nextTemplate: true,
            templates: {
              include: {
                exercises: {
                  include: {
                    exercise: true,
                  },
                },
              },
            },
            workoutSessions: {
              include: {
                exerciseLogs: {
                  include: {
                    exercise: true,
                    setLogs: true,
                    substitutedForExercise: true,
                  },
                },
                template: true,
              },
            },
          },
        },
        sessions: true,
        workoutSessions: {
          include: {
            exerciseLogs: {
              include: {
                exercise: true,
                setLogs: true,
                substitutedForExercise: true,
              },
            },
            mesocyclus: true,
            template: true,
          },
        },
      },
    });
  },
  async findUserById(userId) {
    const user = await db.user.findFirst({
      where: { id: userId },
      select: {
        constraints: true,
        goals: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      constraints: profileConstraintsSchema.parse(user.constraints),
      goals: profileGoalsSchema.parse(user.goals),
    };
  },
  async updateUser(input) {
    const user = await db.user.update({
      where: { id: input.userId },
      data: {
        constraints: input.constraints,
        goals: input.goals,
      },
      select: {
        constraints: true,
        goals: true,
      },
    });

    return {
      constraints: profileConstraintsSchema.parse(user.constraints),
      goals: profileGoalsSchema.parse(user.goals),
    };
  },
};

export function createProfileRoutes(options: ProfileRouteOptions = {}) {
  const profileRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const storage = options.storage ?? defaultStorage;

  profileRoutes.use("*", authGuard);

  profileRoutes.get("/me", async (c) => {
    const profile = await storage.findUserById(c.get("userId"));

    if (!profile) {
      return c.json({ status: 404, title: "User not found" }, 404);
    }

    return c.json(profile, 200);
  });

  profileRoutes.get("/me/export", async (c) => {
    const exportData = await storage.exportUserData(c.get("userId"));

    if (!exportData) {
      return c.json({ status: 404, title: "User not found" }, 404);
    }

    return c.json(exportData, 200);
  });

  profileRoutes.put("/me", async (c) => {
    const body = await c.req.json<{
      constraints?: unknown;
      goals?: unknown;
    }>();

    const goals = profileGoalsSchema.parse(body.goals ?? []);
    const constraints = profileConstraintsSchema.parse(body.constraints ?? {});

    const profile = await storage.updateUser({
      constraints,
      goals,
      userId: c.get("userId"),
    });

    return c.json(profile, 200);
  });

  return profileRoutes;
}
