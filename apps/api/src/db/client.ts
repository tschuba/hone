import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const softDeleteModels = new Set([
  "User",
  "EquipmentPool",
  "Exercise",
  "Tag",
  "ExerciseTag",
  "Mesocyclus",
  "WorkoutTemplate",
  "WorkoutTemplateExercise",
  "WorkoutSession",
  "ExerciseLog",
  "SetLog",
  "AiJob",
  "AiGenerationLog",
  "AiPrompt",
  "SafetyKeyword",
  "BodyMetric",
]);

type PrismaGlobals = {
  db?: typeof db;
  pool?: pg.Pool;
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as typeof globalThis & PrismaGlobals;

const pool =
  globalForPrisma.pool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

function withDeletedAtFilter(args: Record<string, unknown> | undefined) {
  const nextArgs = args ? { ...args } : {};
  const existingWhere =
    typeof nextArgs.where === "object" && nextArgs.where !== null
      ? (nextArgs.where as Record<string, unknown>)
      : undefined;

  return {
    ...nextArgs,
    where: {
      ...(existingWhere ?? {}),
      deletedAt: null,
    },
  };
}

export const db = prisma.$extends({
  query: {
    $allModels: {
      async count({ model, args, query }) {
        if (!softDeleteModels.has(model)) {
          return query(args);
        }

        return query(
          withDeletedAtFilter(args as Record<string, unknown> | undefined),
        );
      },

      async findFirst({ model, args, query }) {
        if (!softDeleteModels.has(model)) {
          return query(args);
        }

        return query(
          withDeletedAtFilter(args as Record<string, unknown> | undefined),
        );
      },

      async findMany({ model, args, query }) {
        if (!softDeleteModels.has(model)) {
          return query(args);
        }

        return query(
          withDeletedAtFilter(args as Record<string, unknown> | undefined),
        );
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
  globalForPrisma.db = db;
}

export async function closeDatabase() {
  await prisma.$disconnect();
  await pool.end();
}
