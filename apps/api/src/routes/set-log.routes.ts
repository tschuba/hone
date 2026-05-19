import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { db } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";

type SetLogRecord = {
  durationSecs: number | null;
  exerciseLogId: string;
  id: string;
  reps: number | null;
  setNr: number;
  uuid: string;
};

type SetLogStorage = {
  findOpenSession(input: {
    sessionId: string;
    userId: string;
  }): Promise<{ id: string } | null>;
  findSessionExerciseLog(input: {
    exerciseLogId: string;
    sessionId: string;
    userId: string;
  }): Promise<{ id: string } | null>;
  upsertSet(input: {
    durationSecs?: number;
    exerciseLogId: string;
    reps?: number;
    setNr: number;
    uuid: string;
  }): Promise<SetLogRecord>;
};

type SetLogRouteOptions = {
  authGuard?: MiddlewareHandler;
  storage?: SetLogStorage;
};

const defaultStorage: SetLogStorage = {
  async findOpenSession({ sessionId, userId }) {
    return db.workoutSession.findFirst({
      where: {
        id: sessionId,
        status: "ACTIVE",
        userId,
      },
      select: {
        id: true,
      },
    });
  },

  async findSessionExerciseLog({ exerciseLogId, sessionId, userId }) {
    return db.exerciseLog.findFirst({
      where: {
        id: exerciseLogId,
        workoutSession: {
          id: sessionId,
          status: "ACTIVE",
          userId,
        },
      },
      select: {
        id: true,
      },
    });
  },

  async upsertSet(input) {
    return db.setLog.upsert({
      where: { uuid: input.uuid },
      create: {
        durationSecs: input.durationSecs,
        exerciseLogId: input.exerciseLogId,
        reps: input.reps,
        setNr: input.setNr,
        uuid: input.uuid,
      },
      update: {},
    });
  },
};

export function createSetLogRoutes(options: SetLogRouteOptions = {}) {
  const setLogRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const storage = options.storage ?? defaultStorage;

  setLogRoutes.use("*", authGuard);

  setLogRoutes.post("/:sessionId/sets", async (c) => {
    const body = await c.req.json<{
      durationSecs?: number;
      exerciseLogId?: string;
      reps?: number;
      setNr?: number;
      uuid?: string;
    }>();

    if (
      !body.uuid ||
      !body.exerciseLogId ||
      typeof body.setNr !== "number" ||
      !Number.isInteger(body.setNr)
    ) {
      return c.json(
        { status: 400, title: "uuid, exerciseLogId, and setNr are required" },
        400,
      );
    }

    const session = await storage.findOpenSession({
      sessionId: c.req.param("sessionId"),
      userId: c.get("userId"),
    });

    if (!session) {
      return c.json({ status: 404, title: "Not found" }, 404);
    }

    const exerciseLog = await storage.findSessionExerciseLog({
      exerciseLogId: body.exerciseLogId,
      sessionId: session.id,
      userId: c.get("userId"),
    });

    if (!exerciseLog) {
      return c.json({ status: 404, title: "Not found" }, 404);
    }

    const set = await storage.upsertSet({
      durationSecs: body.durationSecs,
      exerciseLogId: body.exerciseLogId,
      reps: body.reps,
      setNr: body.setNr,
      uuid: body.uuid,
    });

    return c.json(set, 200);
  });

  return setLogRoutes;
}
