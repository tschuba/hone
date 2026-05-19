import { db } from "../db/client";
import {
  type ExerciseLogWithExercise,
  type MesocyclusWithTemplates,
  WorkoutSessionRepository,
} from "../repositories/workout-session.repo";

type WorkoutSessionStore = Pick<typeof db, "$transaction">;

type WorkoutSubstitutionCandidate = {
  id: string;
  imageAltText: string;
  imageUrl: string | null;
  name: string;
  tags: string[];
};

function normalizeCandidateTags(
  exerciseLog: NonNullable<ExerciseLogWithExercise>,
) {
  return exerciseLog.exercise.tags
    .filter(
      ({ tag }) =>
        tag.category === "EQUIPMENT" || tag.category === "MUSCLE_GROUP",
    )
    .map(({ tag }) => `${tag.category}:${tag.value}`);
}

function scoreCandidate(
  candidate: {
    tags: Array<{
      tag: {
        category: string;
        value: string;
      };
    }>;
  },
  desiredTags: Set<string>,
) {
  return candidate.tags.reduce((score, { tag }) => {
    return desiredTags.has(`${tag.category}:${tag.value}`) ? score + 1 : score;
  }, 0);
}

function toCandidate(exercise: {
  id: string;
  imageAltText: string;
  imageUrl: string | null;
  nameDe: string | null;
  nameEn: string;
  tags: Array<{
    tag: {
      category: string;
      value: string;
    };
  }>;
}): WorkoutSubstitutionCandidate {
  return {
    id: exercise.id,
    imageAltText: exercise.imageAltText,
    imageUrl: exercise.imageUrl,
    name: exercise.nameDe ?? exercise.nameEn,
    tags: exercise.tags.map(({ tag }) => tag.value),
  };
}

async function resolveSubstitutionCandidates(
  repository: WorkoutSessionRepository,
  exerciseLog: NonNullable<ExerciseLogWithExercise>,
  userId: string,
) {
  const desiredTags = new Set(normalizeCandidateTags(exerciseLog));
  const excludedExerciseIds = [
    exerciseLog.exerciseId,
    exerciseLog.substitutedForExerciseId,
  ].filter((value): value is string => Boolean(value));
  const candidates = await repository.listCandidateExercises({
    excludeExerciseIds: excludedExerciseIds,
    tagValues: [...desiredTags].map((value) => value.split(":")[1] ?? value),
    userId,
  });

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, desiredTags),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const byName = (
        left.candidate.nameDe ?? left.candidate.nameEn
      ).localeCompare(right.candidate.nameDe ?? right.candidate.nameEn);

      if (byName !== 0) {
        return byName;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    })
    .slice(0, 8)
    .map(({ candidate }) => toCandidate(candidate));
}

function resolveNextTemplateId(
  mesocyclus: NonNullable<MesocyclusWithTemplates>,
  currentTemplateId?: string | null,
) {
  if (mesocyclus.templates.length === 0) {
    return null;
  }

  const activeTemplateId = currentTemplateId ?? mesocyclus.nextTemplateId;

  if (!activeTemplateId) {
    return mesocyclus.templates[0]?.id ?? null;
  }

  const currentIndex = mesocyclus.templates.findIndex(
    (template) => template.id === activeTemplateId,
  );

  if (currentIndex === -1) {
    return mesocyclus.templates[0]?.id ?? null;
  }

  const nextIndex = (currentIndex + 1) % mesocyclus.templates.length;
  return mesocyclus.templates[nextIndex]?.id ?? null;
}

export class WorkoutSessionService {
  constructor(private readonly store: WorkoutSessionStore = db) {}

  async createSession(input: { templateId: string; userId: string }) {
    return this.store.$transaction(async (tx) => {
      const repository = new WorkoutSessionRepository(tx);
      const template = await repository.findTemplateForUser(input);

      if (!template) {
        throw new Error("Template not found");
      }

      return repository.createSession({
        exerciseLogs: template.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          position: exercise.position,
        })),
        mesocyclusId: template.mesocyclusId,
        templateId: template.id,
        userId: input.userId,
      });
    });
  }

  async completeSession(input: { sessionId: string; userId: string }) {
    return this.store.$transaction(async (tx) => {
      const repository = new WorkoutSessionRepository(tx);
      const session = await repository.findForCompletion(input);

      if (!session) {
        throw new Error("Session not found");
      }

      const completedAt = new Date();
      const completedSession = await repository.markCompleted(
        session.id,
        completedAt,
      );

      if (session.mesocyclus) {
        await repository.updateMesocyclusNextTemplate({
          mesocyclusId: session.mesocyclus.id,
          nextTemplateId: resolveNextTemplateId(
            session.mesocyclus,
            session.templateId,
          ),
        });
      }

      return completedSession;
    });
  }

  async skipSession(input: { mesocyclusId: string; userId: string }) {
    return this.store.$transaction(async (tx) => {
      const repository = new WorkoutSessionRepository(tx);
      const mesocyclus = await repository.findMesocyclusForUser(input);

      if (!mesocyclus) {
        throw new Error("Mesocyclus not found");
      }

      const currentTemplateId =
        mesocyclus.nextTemplateId ?? mesocyclus.templates[0]?.id ?? null;
      const skippedSession = await repository.createAbandonedSession({
        mesocyclusId: mesocyclus.id,
        templateId: currentTemplateId,
        userId: input.userId,
      });

      await repository.updateMesocyclusNextTemplate({
        mesocyclusId: mesocyclus.id,
        nextTemplateId: resolveNextTemplateId(mesocyclus, currentTemplateId),
      });

      return skippedSession;
    });
  }

  async listHistory(userId: string) {
    return this.store.$transaction(async (tx) => {
      const repository = new WorkoutSessionRepository(tx);
      return repository.findSessionHistory(userId);
    });
  }

  async listExerciseSubstitutions(input: {
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }) {
    return this.store.$transaction(async (tx) => {
      const repository = new WorkoutSessionRepository(tx);
      const exerciseLog = await repository.findForSubstitution(input);

      if (!exerciseLog) {
        throw new Error("Exercise log not found");
      }

      return resolveSubstitutionCandidates(
        repository,
        exerciseLog,
        input.userId,
      );
    });
  }

  async substituteExercise(input: {
    exerciseId: string;
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }) {
    return this.store.$transaction(async (tx) => {
      const repository = new WorkoutSessionRepository(tx);
      const exerciseLog = await repository.findForSubstitution(input);

      if (!exerciseLog) {
        throw new Error("Exercise log not found");
      }

      const candidates = await resolveSubstitutionCandidates(
        repository,
        exerciseLog,
        input.userId,
      );
      const nextExercise = candidates.find(
        (candidate) => candidate.id === input.exerciseId,
      );

      if (!nextExercise) {
        throw new Error("Replacement exercise not found");
      }

      const updatedExerciseLog = await repository.updateExerciseSubstitution({
        exerciseId: input.exerciseId,
        exerciseLogId: input.exerciseLogId,
        substitutedForExerciseId:
          exerciseLog.substitutedForExerciseId ?? exerciseLog.exerciseId,
      });

      return {
        exerciseId: updatedExerciseLog.exerciseId,
        exerciseLogId: updatedExerciseLog.id,
        imageAltText: updatedExerciseLog.exercise.imageAltText,
        imageUrl: updatedExerciseLog.exercise.imageUrl,
        name:
          updatedExerciseLog.exercise.nameDe ??
          updatedExerciseLog.exercise.nameEn,
        substitutedForExerciseId: updatedExerciseLog.substitutedForExerciseId,
        substitutedForName: updatedExerciseLog.substitutedForExercise
          ? (updatedExerciseLog.substitutedForExercise.nameDe ??
            updatedExerciseLog.substitutedForExercise.nameEn)
          : null,
      };
    });
  }
}

export type { WorkoutSessionStore };
