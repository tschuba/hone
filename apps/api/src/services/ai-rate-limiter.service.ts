import type { Prisma } from "@prisma/client";

import { db } from "../db/client";

type AiJobSummary = {
  createdAt: Date;
  id: string;
  status: string;
  userId: string;
};

type AiJobStore = {
  countJobsSince(input: { since: Date; userId: string }): Promise<number>;
  createJob(input: {
    input?: Prisma.InputJsonValue;
    priority?: "FEEDBACK" | "NORMAL";
    type?: "FEEDBACK" | "MESOCYCLUS";
    userId: string;
  }): Promise<AiJobSummary>;
  findActiveJob(userId: string): Promise<AiJobSummary | null>;
  findRecentJob(input: {
    since: Date;
    userId: string;
  }): Promise<AiJobSummary | null>;
};

const defaultStore: AiJobStore = {
  async countJobsSince({ since, userId }) {
    return db.aiJob.count({
      where: {
        createdAt: { gte: since },
        userId,
      },
    });
  },

  async createJob({ input, priority, type, userId }) {
    return db.aiJob.create({
      data: {
        ...(input !== undefined ? { input } : {}),
        ...(priority ? { priority } : {}),
        ...(type ? { type } : {}),
        userId,
      },
      select: {
        createdAt: true,
        id: true,
        status: true,
        userId: true,
      },
    });
  },

  async findActiveJob(userId) {
    return db.aiJob.findFirst({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        userId,
      },
      select: {
        createdAt: true,
        id: true,
        status: true,
        userId: true,
      },
    });
  },

  async findRecentJob({ since, userId }) {
    return db.aiJob.findFirst({
      where: {
        createdAt: { gte: since },
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        id: true,
        status: true,
        userId: true,
      },
    });
  },
};

export class AiRateLimiter {
  constructor(
    private readonly store: AiJobStore = defaultStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async checkAndRecord(
    userId: string,
    input?: Prisma.InputJsonValue,
    priority?: "FEEDBACK" | "NORMAL",
    type?: "FEEDBACK" | "MESOCYCLUS",
  ) {
    const now = this.now();
    const sixtyMinsAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [recentJob, activeJob, todayCount] = await Promise.all([
      this.store.findRecentJob({ since: sixtyMinsAgo, userId }),
      this.store.findActiveJob(userId),
      this.store.countJobsSince({ since: startOfDay, userId }),
    ]);

    if (recentJob) {
      throw new Error("Cooldown active — try again later");
    }

    if (activeJob) {
      throw new Error("Job already in progress");
    }

    if (todayCount >= 5) {
      throw new Error("Daily limit reached (5 plans/day)");
    }

    return this.store.createJob({ input, priority, type, userId });
  }
}
