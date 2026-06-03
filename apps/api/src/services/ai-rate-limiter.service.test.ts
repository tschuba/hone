import { describe, expect, it } from "bun:test";

import { AiRateLimiter } from "./ai-rate-limiter.service";

describe("AiRateLimiter", () => {
  it("rejects a second job of the same type within 60-minute cooldown", async () => {
    const now = new Date("2026-05-19T10:00:00.000Z");
    const jobs: Array<{
      createdAt: Date;
      id: string;
      status: string;
      type?: string;
      userId: string;
    }> = [];

    const rateLimiter = new AiRateLimiter(
      {
        async countJobsSince({ since, type, userId }) {
          return jobs.filter(
            (job) =>
              job.userId === userId &&
              job.createdAt >= since &&
              (!type || job.type === type),
          ).length;
        },
        async createJob({ type, userId }) {
          const job = {
            createdAt: new Date(now),
            id: `job-${jobs.length + 1}`,
            status: "DONE",
            type,
            userId,
          };
          jobs.push(job);
          return job;
        },
        async findActiveJob(userId, type) {
          return (
            jobs.find(
              (job) =>
                job.userId === userId &&
                ["PENDING", "PROCESSING"].includes(job.status) &&
                (!type || job.type === type),
            ) ?? null
          );
        },
        async findRecentJob({ since, type, userId }) {
          return (
            [...jobs]
              .reverse()
              .find(
                (job) =>
                  job.userId === userId &&
                  job.createdAt >= since &&
                  (!type || job.type === type),
              ) ?? null
          );
        },
      },
      () => new Date(now),
    );

    await rateLimiter.checkAndRecord(
      "user-1",
      undefined,
      "FEEDBACK",
      "FEEDBACK",
    );

    await expect(
      rateLimiter.checkAndRecord("user-1", undefined, "FEEDBACK", "FEEDBACK"),
    ).rejects.toThrow("Cooldown active — try again later");
  });

  it("allows feedback submission when only a plan job is recent", async () => {
    const now = new Date("2026-05-19T10:00:00.000Z");
    const planJob = {
      createdAt: new Date("2026-05-19T09:30:00.000Z"),
      id: "plan-job-1",
      status: "DONE",
      type: "MESOCYCLUS",
      userId: "user-1",
    };

    const rateLimiter = new AiRateLimiter(
      {
        async countJobsSince({ since, type, userId }) {
          if (type === "FEEDBACK") return 0;
          return userId === "user-1" && planJob.createdAt >= since ? 1 : 0;
        },
        async createJob({ type, userId }) {
          return {
            createdAt: new Date(now),
            id: "feedback-job-1",
            status: "PENDING",
            type,
            userId,
          };
        },
        async findActiveJob(_userId, type) {
          return type === "FEEDBACK" ? null : planJob;
        },
        async findRecentJob({ since, type, userId }) {
          if (type === "FEEDBACK") return null;
          return userId === "user-1" && planJob.createdAt >= since
            ? planJob
            : null;
        },
      },
      () => new Date(now),
    );

    const job = await rateLimiter.checkAndRecord(
      "user-1",
      undefined,
      "FEEDBACK",
      "FEEDBACK",
    );

    expect(job.id).toBe("feedback-job-1");
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
