import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { prisma } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";
import { AiRateLimiter } from "../services/ai-rate-limiter.service";

type FeedbackRouteOptions = {
  aiRateLimiter?: {
    checkAndRecord(
      userId: string,
      input?: unknown,
      priority?: "FEEDBACK" | "NORMAL",
      type?: "FEEDBACK" | "MESOCYCLUS",
    ): Promise<{ id: string }>;
  };
  authGuard?: MiddlewareHandler;
  notifier?: {
    notify(jobId: string): Promise<void>;
  };
};

const defaultNotifier = {
  async notify(jobId: string) {
    await prisma.$executeRaw`SELECT pg_notify('ai_job_created', ${jobId})`;
  },
};

export function createFeedbackRoutes(options: FeedbackRouteOptions = {}) {
  const feedbackRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const aiRateLimiter = options.aiRateLimiter ?? new AiRateLimiter();
  const notifier = options.notifier ?? defaultNotifier;

  feedbackRoutes.use("*", authGuard);

  feedbackRoutes.post("/", async (c) => {
    const body = await c.req.json<{
      difficulty?: string;
      mesocyclusId?: string;
      variety?: string;
    }>();

    if (!body.difficulty || !body.variety || !body.mesocyclusId) {
      return c.json(
        {
          status: 400,
          title: "difficulty, variety, and mesocyclusId are required",
        },
        400,
      );
    }

    try {
      const job = await aiRateLimiter.checkAndRecord(
        c.get("userId"),
        {
          difficulty: body.difficulty,
          mesocyclusId: body.mesocyclusId,
          type: "feedback",
          variety: body.variety,
        },
        "FEEDBACK",
        "FEEDBACK",
      );

      await notifier.notify(job.id);

      return c.json({ jobId: job.id, ok: true }, 201);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Cooldown active — try again later") {
          return c.json({ status: 409, title: error.message }, 409);
        }

        return c.json({ status: 400, title: error.message }, 400);
      }

      throw error;
    }
  });

  return feedbackRoutes;
}
