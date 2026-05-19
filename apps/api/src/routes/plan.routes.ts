import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { prisma } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";
import { AiRateLimiter } from "../services/ai-rate-limiter.service";
import type { GeneratePlanOptions } from "../services/rule-engine.service";
import { RuleEngineService } from "../services/rule-engine.service";

type ProfileConstraints = {
  impactFilter: boolean;
};

type ProfileGoal = {
  scope: "profile";
  value: string;
};

type MesocyclusExerciseInput = {
  durationSecs?: number;
  exerciseId: string;
  position: number;
  reps?: number;
  restSecsOverride?: number;
  sets: number;
};

type MesocyclusPlanInput = {
  durationWeeks: number;
  workouts: Array<{
    estimatedDurationMinutes: number;
    exercises: MesocyclusExerciseInput[];
    label: "A" | "B" | "C";
    position: number;
  }>;
  workoutsPerWeek: number;
};

type PlanContext = {
  constraints: ProfileConstraints;
  equipmentPool: {
    id: string;
    name: string;
    tags: string[];
  };
  goals: ProfileGoal[];
};

type PlanStorage = {
  createMesocyclus(input: {
    plan: MesocyclusPlanInput;
    userId: string;
  }): Promise<{ id: string }>;
  getPlanContext(input: {
    equipmentPoolId?: string;
    userId: string;
  }): Promise<PlanContext | null>;
};

type PlanRouteOptions = {
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
  ruleEngine?: {
    generate(input: GeneratePlanOptions): Promise<MesocyclusPlanInput>;
  };
  storage?: PlanStorage;
};

const defaultStorage: PlanStorage = {
  async getPlanContext({ equipmentPoolId, userId }) {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: {
        constraints: true,
        goals: true,
      },
    });

    if (!user) {
      return null;
    }

    const equipmentPool = equipmentPoolId
      ? await prisma.equipmentPool.findFirst({
          where: {
            id: equipmentPoolId,
            userId,
          },
          select: {
            id: true,
            name: true,
            tags: true,
          },
        })
      : await prisma.equipmentPool.findFirst({
          where: { userId },
          orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            tags: true,
          },
        });

    if (!equipmentPool) {
      return null;
    }

    return {
      constraints: {
        impactFilter:
          typeof (user.constraints as { impactFilter?: unknown } | null)
            ?.impactFilter === "boolean"
            ? Boolean(
                (user.constraints as { impactFilter?: boolean }).impactFilter,
              )
            : false,
      },
      equipmentPool,
      goals: Array.isArray(user.goals)
        ? user.goals.filter(
            (goal): goal is ProfileGoal =>
              typeof goal === "object" &&
              goal !== null &&
              (goal as { scope?: unknown }).scope === "profile" &&
              typeof (goal as { value?: unknown }).value === "string",
          )
        : [],
    };
  },

  async createMesocyclus({ plan, userId }) {
    return prisma.mesocyclus.create({
      data: {
        durationWeeks: plan.durationWeeks,
        planSource: "RULE_BASED",
        templates: {
          create: plan.workouts.map((workout) => ({
            label: workout.label,
            position: workout.position,
            title: `Workout ${workout.label}`,
            exercises: {
              create: workout.exercises.map((exercise) => ({
                durationSecs: exercise.durationSecs,
                exerciseId: exercise.exerciseId,
                position: exercise.position,
                reps: exercise.reps,
                restSecsOverride: exercise.restSecsOverride,
                sets: exercise.sets,
              })),
            },
          })),
        },
        userId,
        workoutsPerWeek: plan.workoutsPerWeek,
      },
      select: {
        id: true,
      },
    });
  },
};

const defaultNotifier = {
  async notify(jobId: string) {
    await prisma.$queryRaw`SELECT pg_notify('ai_job_created', ${jobId})`;
  },
};

function parsePositiveInteger(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function createPlanRoutes(options: PlanRouteOptions = {}) {
  const planRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const aiRateLimiter = options.aiRateLimiter ?? new AiRateLimiter();
  const notifier = options.notifier ?? defaultNotifier;
  const ruleEngine = options.ruleEngine ?? new RuleEngineService();
  const storage = options.storage ?? defaultStorage;

  planRoutes.use("*", authGuard);

  planRoutes.post("/", async (c) => {
    const body = await c.req.json<{
      equipmentPoolId?: string;
      sessionMinutes?: number;
      weeksCount?: number;
    }>();

    const userId = c.get("userId");
    const context = await storage.getPlanContext({
      equipmentPoolId: body.equipmentPoolId,
      userId,
    });

    if (!context) {
      return c.json(
        { status: 404, title: "User or equipment pool not found" },
        404,
      );
    }

    const sessionMinutes = parsePositiveInteger(body.sessionMinutes, 30);
    const weeksCount = parsePositiveInteger(body.weeksCount, 4);
    const excludeModifiers = context.constraints.impactFilter
      ? ["back_load", "knee_load"]
      : undefined;

    const planOptions: GeneratePlanOptions = {
      equipmentTags: context.equipmentPool.tags,
      excludeModifiers,
      sessionMinutes,
      userId,
      weeksCount,
    };
    try {
      const plan = await ruleEngine.generate(planOptions);
      const mesocyclus = await storage.createMesocyclus({ plan, userId });
      const job = await aiRateLimiter.checkAndRecord(
        userId,
        {
          currentWeek: 1,
          durationWeeks: weeksCount,
          equipmentPoolId: context.equipmentPool.id,
          equipmentTags: context.equipmentPool.tags,
          excludeModifiers,
          mesocyclusId: mesocyclus.id,
          profile: {
            constraints: context.constraints,
            goals: context.goals,
          },
          sessionMinutes,
          type: "mesocyclus",
        },
        "NORMAL",
        "MESOCYCLUS",
      );

      await notifier.notify(job.id);

      return c.json(
        {
          jobId: job.id,
          mesocyclusId: mesocyclus.id,
          planSource: "rule_based",
          status: "queued",
        },
        201,
      );
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ status: 400, title: error.message }, 400);
      }

      throw error;
    }
  });

  return planRoutes;
}
