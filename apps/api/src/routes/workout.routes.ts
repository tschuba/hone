import { WorkoutSessionStatus } from "@prisma/client";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { db } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";

type WorkoutTodayExercise = {
  completedSets: number;
  durationSecs: number | null;
  exerciseId: string;
  exerciseLogId: string | null;
  imageAltText: string;
  imageUrl: string | null;
  name: string;
  position: number;
  reps: number | null;
  restSecs: number;
  sets: number;
  substitutedForExerciseId: string | null;
  substitutedForName: string | null;
};

type WorkoutTodayResponse =
  | { status: "empty" }
  | {
      exercises: WorkoutTodayExercise[];
      mesocyclusId: string | null;
      sessionId: string;
      status: "active_session";
      templateId: string;
      templateLabel: string;
      templateTitle: string | null;
    }
  | {
      exercises: WorkoutTodayExercise[];
      mesocyclusId: string;
      sessionId: null;
      status: "planned";
      templateId: string;
      templateLabel: string;
      templateTitle: string | null;
    };

type WorkoutStorage = {
  findActiveSession(userId: string): Promise<WorkoutTodayResponse | null>;
  findPlannedWorkout(userId: string): Promise<WorkoutTodayResponse | null>;
};

type WorkoutRouteOptions = {
  authGuard?: MiddlewareHandler;
  storage?: WorkoutStorage;
};

function resolveRestSecs(
  restSecsOverride: number | null,
  suggestedRestSecs: number | null,
) {
  return restSecsOverride ?? suggestedRestSecs ?? 15;
}

const defaultStorage: WorkoutStorage = {
  async findActiveSession(userId) {
    const session = await db.workoutSession.findFirst({
      where: {
        status: WorkoutSessionStatus.ACTIVE,
        userId,
      },
      orderBy: {
        startedAt: "desc",
      },
      include: {
        exerciseLogs: {
          orderBy: {
            position: "asc",
          },
          include: {
            exercise: true,
            setLogs: true,
            substitutedForExercise: true,
          },
        },
        mesocyclus: true,
        template: {
          include: {
            exercises: {
              orderBy: {
                position: "asc",
              },
              include: {
                exercise: true,
              },
            },
          },
        },
      },
    });

    if (!session?.template) {
      return null;
    }

    const template = session.template;

    return {
      exercises: session.exerciseLogs.map((exerciseLog) => {
        const templateExercise =
          template.exercises.find(
            (exercise) => exercise.position === exerciseLog.position,
          ) ?? null;

        return {
          completedSets: exerciseLog.setLogs.length,
          durationSecs: templateExercise?.durationSecs ?? null,
          exerciseId: exerciseLog.exerciseId,
          exerciseLogId: exerciseLog.id,
          imageAltText: exerciseLog.exercise.imageAltText,
          imageUrl: exerciseLog.exercise.imageUrl,
          name: exerciseLog.exercise.nameDe ?? exerciseLog.exercise.nameEn,
          position: exerciseLog.position,
          reps: templateExercise?.reps ?? null,
          restSecs: resolveRestSecs(
            templateExercise?.restSecsOverride ?? null,
            exerciseLog.exercise.suggestedRestSecs,
          ),
          sets:
            templateExercise?.sets ?? Math.max(exerciseLog.setLogs.length, 1),
          substitutedForExerciseId: exerciseLog.substitutedForExerciseId,
          substitutedForName: exerciseLog.substitutedForExercise
            ? (exerciseLog.substitutedForExercise.nameDe ??
              exerciseLog.substitutedForExercise.nameEn)
            : null,
        };
      }),
      mesocyclusId: session.mesocyclusId,
      sessionId: session.id,
      status: "active_session",
      templateId: template.id,
      templateLabel: template.label,
      templateTitle: template.title,
    } satisfies WorkoutTodayResponse;
  },

  async findPlannedWorkout(userId) {
    const mesocyclus = await db.mesocyclus.findFirst({
      where: {
        status: "ACTIVE",
        userId,
      },
      include: {
        nextTemplate: {
          include: {
            exercises: {
              orderBy: {
                position: "asc",
              },
              include: {
                exercise: true,
              },
            },
          },
        },
        templates: {
          orderBy: {
            position: "asc",
          },
          include: {
            exercises: {
              orderBy: {
                position: "asc",
              },
              include: {
                exercise: true,
              },
            },
          },
        },
      },
    });

    const template =
      mesocyclus?.nextTemplate ?? mesocyclus?.templates[0] ?? null;

    if (!mesocyclus || !template) {
      return null;
    }

    return {
      exercises: template.exercises.map((templateExercise) => ({
        completedSets: 0,
        durationSecs: templateExercise.durationSecs,
        exerciseId: templateExercise.exerciseId,
        exerciseLogId: null,
        imageAltText: templateExercise.exercise.imageAltText,
        imageUrl: templateExercise.exercise.imageUrl,
        name:
          templateExercise.exercise.nameDe ?? templateExercise.exercise.nameEn,
        position: templateExercise.position,
        reps: templateExercise.reps,
        restSecs: resolveRestSecs(
          templateExercise.restSecsOverride,
          templateExercise.exercise.suggestedRestSecs,
        ),
        sets: templateExercise.sets,
        substitutedForExerciseId: null,
        substitutedForName: null,
      })),
      mesocyclusId: mesocyclus.id,
      sessionId: null,
      status: "planned",
      templateId: template.id,
      templateLabel: template.label,
      templateTitle: template.title,
    } satisfies WorkoutTodayResponse;
  },
};

export function createWorkoutRoutes(options: WorkoutRouteOptions = {}) {
  const workoutRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const storage = options.storage ?? defaultStorage;

  workoutRoutes.use("*", authGuard);

  workoutRoutes.get("/today", async (c) => {
    const userId = c.get("userId");
    const activeSession = await storage.findActiveSession(userId);

    if (activeSession) {
      return c.json(activeSession, 200);
    }

    const plannedWorkout = await storage.findPlannedWorkout(userId);

    if (plannedWorkout) {
      return c.json(plannedWorkout, 200);
    }

    return c.json({ status: "empty" } satisfies WorkoutTodayResponse, 200);
  });

  return workoutRoutes;
}

export type { WorkoutTodayExercise, WorkoutTodayResponse };
