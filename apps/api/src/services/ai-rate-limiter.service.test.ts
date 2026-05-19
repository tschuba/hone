import { describe, expect, it } from "bun:test";

import { AiRateLimiter } from "./ai-rate-limiter.service";

describe("AiRateLimiter", () => {
  it("rejects a second job within 60-minute cooldown", async () => {
    const now = new Date("2026-05-19T10:00:00.000Z");
    const jobs: Array<{
      createdAt: Date;
      id: string;
      status: string;
      userId: string;
    }> = [];

    const rateLimiter = new AiRateLimiter(
      {
        async countJobsSince({ since, userId }) {
          return jobs.filter(
            (job) => job.userId === userId && job.createdAt >= since,
          ).length;
        },
        async createJob({ userId }) {
          const job = {
            createdAt: new Date(now),
            id: `job-${jobs.length + 1}`,
            status: "DONE",
            userId,
          };
          jobs.push(job);
          return job;
        },
        async findActiveJob(userId) {
          return (
            jobs.find(
              (job) =>
                job.userId === userId &&
                ["PENDING", "PROCESSING"].includes(job.status),
            ) ?? null
          );
        },
        async findRecentJob({ since, userId }) {
          return (
            [...jobs]
              .reverse()
              .find((job) => job.userId === userId && job.createdAt >= since) ??
            null
          );
        },
      },
      () => new Date(now),
    );

    await rateLimiter.checkAndRecord("user-1");

    await expect(rateLimiter.checkAndRecord("user-1")).rejects.toThrow(
      "Cooldown active — try again later",
    );
  });

  it("rejects an active pending job even outside cooldown", async () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const rateLimiter = new AiRateLimiter(
      {
        async countJobsSince() {
          return 1;
        },
        async createJob() {
          throw new Error("createJob should not be called");
        },
        async findActiveJob(userId) {
          return {
            createdAt: new Date("2026-05-19T09:00:00.000Z"),
            id: "job-1",
            status: "PENDING",
            userId,
          };
        },
        async findRecentJob() {
          return null;
        },
      },
      () => new Date(now),
    );

    await expect(rateLimiter.checkAndRecord("user-1")).rejects.toThrow(
      "Job already in progress",
    );
  });

  it("rejects the sixth job of the day", async () => {
    const now = new Date("2026-05-19T18:00:00.000Z");
    const rateLimiter = new AiRateLimiter(
      {
        async countJobsSince() {
          return 5;
        },
        async createJob() {
          throw new Error("createJob should not be called");
        },
        async findActiveJob() {
          return null;
        },
        async findRecentJob() {
          return null;
        },
      },
      () => new Date(now),
    );

    await expect(rateLimiter.checkAndRecord("user-1")).rejects.toThrow(
      "Daily limit reached (5 plans/day)",
    );
  });
});
