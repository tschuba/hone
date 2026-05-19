import { db } from "../db/client";

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

type MesocyclusWithTemplates = Awaited<
  ReturnType<WorkoutSessionRepository["findMesocyclusForUser"]>
>;

type ExerciseLogWithExercise = Awaited<
  ReturnType<WorkoutSessionRepository["findForSubstitution"]>
>;

export class WorkoutSessionRepository {
  constructor(private readonly client: TxClient | typeof db = db) {}

  createSession(input: {
    exerciseLogs: Array<{
      exerciseId: string;
      position: number;
    }>;
    mesocyclusId: string | null;
    templateId: string;
    userId: string;
  }) {
    return this.client.workoutSession.create({
      data: {
        exerciseLogs: {
          create: input.exerciseLogs.map((exerciseLog) => ({
            exerciseId: exerciseLog.exerciseId,
            position: exerciseLog.position,
          })),
        },
        mesocyclusId: input.mesocyclusId,
        status: "ACTIVE",
        templateId: input.templateId,
        userId: input.userId,
      },
      include: {
        exerciseLogs: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });
  }

  findSessionHistory(userId: string) {
    return this.client.workoutSession.findMany({
      where: {
        userId,
      },
      orderBy: [
        {
          startedAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: 20,
    });
  }

  findTemplateForUser(input: { templateId: string; userId: string }) {
    return this.client.workoutTemplate.findFirst({
      where: {
        id: input.templateId,
        mesocyclus: {
          userId: input.userId,
        },
      },
      include: {
        exercises: {
          orderBy: {
            position: "asc",
          },
        },
        mesocyclus: true,
      },
    });
  }

  findMesocyclusForUser(input: { mesocyclusId: string; userId: string }) {
    return this.client.mesocyclus.findFirst({
      where: {
        id: input.mesocyclusId,
        userId: input.userId,
      },
      include: {
        nextTemplate: true,
        templates: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });
  }

  findForCompletion(input: { sessionId: string; userId: string }) {
    return this.client.workoutSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
      },
      include: {
        mesocyclus: {
          include: {
            nextTemplate: true,
            templates: {
              orderBy: {
                position: "asc",
              },
            },
          },
        },
      },
    });
  }

  createAbandonedSession(input: {
    mesocyclusId: string;
    templateId: string | null;
    userId: string;
  }) {
    return this.client.workoutSession.create({
      data: {
        completedAt: new Date(),
        mesocyclusId: input.mesocyclusId,
        status: "ABANDONED",
        templateId: input.templateId,
        userId: input.userId,
      },
    });
  }

  markCompleted(sessionId: string, completedAt: Date) {
    return this.client.workoutSession.update({
      where: { id: sessionId },
      data: {
        completedAt,
        status: "COMPLETED",
      },
    });
  }

  updateMesocyclusNextTemplate(input: {
    mesocyclusId: string;
    nextTemplateId: string | null;
  }) {
    return this.client.mesocyclus.update({
      where: { id: input.mesocyclusId },
      data: {
        nextTemplateId: input.nextTemplateId,
      },
    });
  }

  findForSubstitution(input: {
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }) {
    return this.client.exerciseLog.findFirst({
      where: {
        id: input.exerciseLogId,
        workoutSession: {
          id: input.sessionId,
          status: "ACTIVE",
          userId: input.userId,
        },
      },
      include: {
        exercise: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        substitutedForExercise: true,
        workoutSession: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  listCandidateExercises(input: {
    excludeExerciseIds: string[];
    tagValues: string[];
    userId: string;
  }) {
    return this.client.exercise.findMany({
      where: {
        deletedAt: null,
        id: {
          notIn: input.excludeExerciseIds,
        },
        OR: [{ isGlobal: true }, { ownerId: input.userId }],
        ...(input.tagValues.length > 0
          ? {
              tags: {
                some: {
                  tag: {
                    value: {
                      in: input.tagValues,
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      take: 24,
    });
  }

  updateExerciseSubstitution(input: {
    exerciseId: string;
    exerciseLogId: string;
    substitutedForExerciseId: string;
  }) {
    return this.client.exerciseLog.update({
      where: {
        id: input.exerciseLogId,
      },
      data: {
        exerciseId: input.exerciseId,
        substitutedForExerciseId: input.substitutedForExerciseId,
      },
      include: {
        exercise: true,
        substitutedForExercise: true,
      },
    });
  }
}

export type { ExerciseLogWithExercise, MesocyclusWithTemplates };
