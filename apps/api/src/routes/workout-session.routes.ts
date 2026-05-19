import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";
import { WorkoutSessionService } from "../services/workout-session.service";

type WorkoutSessionRouteService = {
  completeSession(input: {
    sessionId: string;
    userId: string;
  }): Promise<{
    completedAt: Date | null;
    id: string;
    status: string;
  }>;
  createSession(input: { templateId: string; userId: string }): Promise<{
    exerciseLogs: Array<{
      exerciseId: string;
      id: string;
      position: number;
    }>;
    id: string;
    status: string;
    templateId: string | null;
  }>;
  listExerciseSubstitutions(input: {
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }): Promise<
    Array<{
      id: string;
      imageAltText: string;
      imageUrl: string | null;
      name: string;
      tags: string[];
    }>
  >;
  listHistory(userId: string): Promise<
    Array<{
      completedAt: Date | null;
      id: string;
      startedAt: Date;
      status: string;
      templateId: string | null;
    }>
  >;
  skipSession(input: { mesocyclusId: string; userId: string }): Promise<{
    id: string;
    status: string;
  }>;
  substituteExercise(input: {
    exerciseId: string;
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }): Promise<{
    exerciseId: string;
    exerciseLogId: string;
    imageAltText: string;
    imageUrl: string | null;
    name: string;
    substitutedForExerciseId: string | null;
    substitutedForName: string | null;
  }>;
};

type WorkoutSessionRouteOptions = {
  authGuard?: MiddlewareHandler;
  service?: WorkoutSessionRouteService;
};

export function createWorkoutSessionRoutes(
  options: WorkoutSessionRouteOptions = {},
) {
  const workoutSessionRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const service = options.service ?? new WorkoutSessionService();

  workoutSessionRoutes.use("*", authGuard);

  workoutSessionRoutes.post("/", async (c) => {
    const body = await c.req.json<{ templateId?: string }>();

    if (!body.templateId) {
      return c.json({ status: 400, title: "templateId is required" }, 400);
    }

    try {
      const session = await service.createSession({
        templateId: body.templateId,
        userId: c.get("userId"),
      });

      return c.json(
        {
          exerciseLogs: session.exerciseLogs.map((exerciseLog) => ({
            exerciseId: exerciseLog.exerciseId,
            id: exerciseLog.id,
            position: exerciseLog.position,
          })),
          id: session.id,
          status: session.status,
          templateId: session.templateId,
        },
        201,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Template not found") {
        return c.json({ status: 404, title: error.message }, 404);
      }

      return c.json({ status: 400, title: "Unable to start session" }, 400);
    }
  });

  workoutSessionRoutes.get("/", async (c) => {
    const sessions = await service.listHistory(c.get("userId"));

    return c.json(
      {
        items: sessions.map((session) => ({
          completedAt: session.completedAt,
          id: session.id,
          startedAt: session.startedAt,
          status: session.status,
          templateId: session.templateId,
        })),
      },
      200,
    );
  });

  workoutSessionRoutes.post("/:sessionId/complete", async (c) => {
    try {
      const session = await service.completeSession({
        sessionId: c.req.param("sessionId"),
        userId: c.get("userId"),
      });

      return c.json(
        {
          completedAt: session.completedAt,
          id: session.id,
          status: session.status,
        },
        200,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        return c.json({ status: 404, title: error.message }, 404);
      }

      return c.json({ status: 400, title: "Unable to complete session" }, 400);
    }
  });

  workoutSessionRoutes.get(
    "/:sessionId/exercises/:exerciseLogId/substitutions",
    async (c) => {
      try {
        const items = await service.listExerciseSubstitutions({
          exerciseLogId: c.req.param("exerciseLogId"),
          sessionId: c.req.param("sessionId"),
          userId: c.get("userId"),
        });

        return c.json({ items }, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Exercise log not found"
        ) {
          return c.json({ status: 404, title: error.message }, 404);
        }

        return c.json(
          { status: 400, title: "Unable to load substitutions" },
          400,
        );
      }
    },
  );

  workoutSessionRoutes.post(
    "/:sessionId/exercises/:exerciseLogId/substitute",
    async (c) => {
      const body = await c.req.json<{ exerciseId?: string }>();

      if (!body.exerciseId) {
        return c.json({ status: 400, title: "exerciseId is required" }, 400);
      }

      try {
        const exerciseLog = await service.substituteExercise({
          exerciseId: body.exerciseId,
          exerciseLogId: c.req.param("exerciseLogId"),
          sessionId: c.req.param("sessionId"),
          userId: c.get("userId"),
        });

        return c.json(exerciseLog, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === "Exercise log not found" ||
            error.message === "Replacement exercise not found")
        ) {
          return c.json({ status: 404, title: error.message }, 404);
        }

        return c.json(
          { status: 400, title: "Unable to substitute exercise" },
          400,
        );
      }
    },
  );

  workoutSessionRoutes.post("/skip", async (c) => {
    const body = await c.req.json<{ mesocyclusId?: string }>();

    if (!body.mesocyclusId) {
      return c.json({ status: 400, title: "mesocyclusId is required" }, 400);
    }

    try {
      const session = await service.skipSession({
        mesocyclusId: body.mesocyclusId,
        userId: c.get("userId"),
      });

      return c.json(
        {
          id: session.id,
          status: session.status,
        },
        200,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Mesocyclus not found") {
        return c.json({ status: 404, title: error.message }, 404);
      }

      return c.json({ status: 400, title: "Unable to skip session" }, 400);
    }
  });

  return workoutSessionRoutes;
}
