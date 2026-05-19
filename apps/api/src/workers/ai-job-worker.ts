import type { Prisma } from "@prisma/client";
import pg from "pg";

import { prisma } from "../db/client";
import {
  type AiProvider,
  UnconfiguredAiProvider,
} from "../services/ai-provider";
import { detectInjection } from "../services/injection-detector.service";

type AiJobRecord = {
  attemptCount: number;
  heartbeatAt: Date | null;
  id: string;
  input: unknown;
  lastError: string | null;
  lockedUntil: Date | null;
  maxAttempts: number;
  output: unknown;
  priority: string;
  status: string;
  userId: string;
  workerId: string | null;
};

type AiJobStore = {
  createGenerationLog(input: {
    fallbackUsed: boolean;
    injectionDetected: boolean;
    jobId: string;
    modelId: string;
    provider: string;
  }): Promise<void>;
  claimNextJob(input: {
    lockUntil: Date;
    now: Date;
    workerId: string;
  }): Promise<AiJobRecord | null>;
  completeJob(input: { jobId: string; output: unknown }): Promise<void>;
  extendHeartbeat(input: {
    jobId: string;
    lockedUntil: Date;
    now: Date;
    workerId: string;
  }): Promise<boolean>;
  failJob(input: {
    attemptCount: number;
    jobId: string;
    lastError: string;
    maxAttempts: number;
  }): Promise<void>;
  recoverOrphanedJobs(): Promise<void>;
  releaseJob(input: {
    jobId: string;
    lastError: string;
    workerId: string;
  }): Promise<void>;
};

type AiJobListener = {
  close(): Promise<void>;
  listen(onNotify: () => void | Promise<void>): Promise<void>;
  unlisten(): Promise<void>;
};

type AiJobWorkerOptions = {
  clearIntervalImpl?: typeof clearInterval;
  heartbeatIntervalMs?: number;
  listener?: AiJobListener;
  lockDurationMs?: number;
  now?: () => Date;
  provider?: AiProvider;
  setIntervalImpl?: typeof setInterval;
  store?: AiJobStore;
  workerId?: string;
};

class PostgresAiJobListener implements AiJobListener {
  private readonly client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  private listening = false;

  async listen(onNotify: () => void | Promise<void>) {
    if (!this.listening) {
      await this.client.connect();
      this.client.on("notification", () => {
        void onNotify();
      });
      this.listening = true;
    }

    await this.client.query("LISTEN ai_job_created");
  }

  async unlisten() {
    if (!this.listening) {
      return;
    }

    await this.client.query("UNLISTEN ai_job_created");
  }

  async close() {
    if (!this.listening) {
      return;
    }

    this.listening = false;
    await this.client.end();
  }
}

const defaultStore: AiJobStore = {
  async createGenerationLog({
    fallbackUsed,
    injectionDetected,
    jobId,
    modelId,
    provider,
  }) {
    await prisma.aiGenerationLog.create({
      data: {
        fallbackUsed,
        injectionDetected,
        jobId,
        modelId,
        provider,
      },
    });
  },

  async recoverOrphanedJobs() {
    await prisma.$executeRaw`
      UPDATE ai_jobs
      SET status = CASE
        WHEN attempt_count + 1 >= max_attempts THEN 'DEAD'::"AiJobStatus"
        ELSE 'PENDING'::"AiJobStatus"
      END,
      attempt_count = attempt_count + 1,
      last_error = 'worker_crash',
      locked_until = NULL,
      heartbeat_at = NULL,
      worker_id = NULL
      WHERE status = 'PROCESSING'::"AiJobStatus"
      AND locked_until < NOW()
      AND deleted_at IS NULL
    `;
  },

  async claimNextJob({ lockUntil, now, workerId }) {
    const [job] = await prisma.$queryRaw<AiJobRecord[]>`
      UPDATE ai_jobs
      SET status = 'PROCESSING'::"AiJobStatus",
          worker_id = ${workerId},
          locked_until = ${lockUntil},
          heartbeat_at = ${now}
      WHERE id = (
        SELECT id
        FROM ai_jobs
        WHERE status = 'PENDING'::"AiJobStatus"
          AND deleted_at IS NULL
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        user_id AS "userId",
        status,
        priority,
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        worker_id AS "workerId",
        locked_until AS "lockedUntil",
        heartbeat_at AS "heartbeatAt",
        input,
        output,
        last_error AS "lastError"
    `;

    return job ?? null;
  },

  async extendHeartbeat({ jobId, lockedUntil, now, workerId }) {
    const result = await prisma.aiJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        workerId,
      },
      data: {
        heartbeatAt: now,
        lockedUntil,
      },
    });

    return result.count > 0;
  },

  async completeJob({ jobId, output }) {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        heartbeatAt: null,
        lastError: null,
        lockedUntil: null,
        output: output as Prisma.InputJsonValue,
        status: "DONE",
        workerId: null,
      },
    });
  },

  async failJob({ attemptCount, jobId, lastError, maxAttempts }) {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        attemptCount: {
          increment: 1,
        },
        heartbeatAt: null,
        lastError,
        lockedUntil: null,
        status: attemptCount + 1 >= maxAttempts ? "DEAD" : "PENDING",
        workerId: null,
      },
    });
  },

  async releaseJob({ jobId, lastError, workerId }) {
    await prisma.aiJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        workerId,
      },
      data: {
        heartbeatAt: null,
        lastError,
        lockedUntil: null,
        status: "PENDING",
        workerId: null,
      },
    });
  },
};

export class AiJobWorker {
  private readonly clearIntervalImpl: typeof clearInterval;
  private currentJobId: string | null = null;
  private readonly heartbeatIntervalMs: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listener: AiJobListener;
  private readonly lockDurationMs: number;
  private readonly now: () => Date;
  private polling = false;
  private readonly provider: AiProvider;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly store: AiJobStore;
  private readonly workerId: string;

  constructor(options: AiJobWorkerOptions = {}) {
    this.clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 110_000;
    this.listener = options.listener ?? new PostgresAiJobListener();
    this.lockDurationMs = options.lockDurationMs ?? 3 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
    this.provider = options.provider ?? new UnconfiguredAiProvider();
    this.setIntervalImpl = options.setIntervalImpl ?? setInterval;
    this.store = options.store ?? defaultStore;
    this.workerId = options.workerId ?? crypto.randomUUID();
  }

  async start() {
    await this.store.recoverOrphanedJobs();
    await this.listener.listen(() => this.pollPendingJobs());
    await this.pollPendingJobs();
  }

  async stop() {
    this.stopHeartbeat();

    if (this.currentJobId) {
      await this.store.releaseJob({
        jobId: this.currentJobId,
        lastError: "worker_shutdown",
        workerId: this.workerId,
      });
      this.currentJobId = null;
    }

    await this.listener.unlisten();
    await this.listener.close();
  }

  private async pollPendingJobs() {
    if (this.polling) {
      return;
    }

    this.polling = true;

    try {
      while (true) {
        const now = this.now();
        const job = await this.store.claimNextJob({
          lockUntil: new Date(now.getTime() + this.lockDurationMs),
          now,
          workerId: this.workerId,
        });

        if (!job) {
          break;
        }

        await this.processJob(job);
      }
    } finally {
      this.polling = false;
    }
  }

  private async processJob(job: AiJobRecord) {
    this.currentJobId = job.id;
    this.startHeartbeat(job.id);

    try {
      if (hasInjection(job.input)) {
        await this.store.createGenerationLog({
          fallbackUsed: false,
          injectionDetected: true,
          jobId: job.id,
          modelId: "safety-detector",
          provider: "local",
        });
        throw new Error("prompt_injection_detected");
      }

      const output = await this.provider.generate(job.input);
      await this.store.createGenerationLog({
        fallbackUsed: false,
        injectionDetected: false,
        jobId: job.id,
        modelId: "default-provider",
        provider: "local",
      });
      await this.store.completeJob({
        jobId: job.id,
        output,
      });
    } catch (error) {
      await this.store.failJob({
        attemptCount: job.attemptCount,
        jobId: job.id,
        lastError:
          error instanceof Error ? error.message : "Unknown AI worker error",
        maxAttempts: job.maxAttempts,
      });
    } finally {
      this.stopHeartbeat();
      this.currentJobId = null;
    }
  }

  private startHeartbeat(jobId: string) {
    this.stopHeartbeat();

    this.heartbeatTimer = this.setIntervalImpl(() => {
      const now = this.now();

      void this.store
        .extendHeartbeat({
          jobId,
          lockedUntil: new Date(now.getTime() + this.lockDurationMs),
          now,
          workerId: this.workerId,
        })
        .then((updated) => {
          if (!updated) {
            this.stopHeartbeat();
          }
        })
        .catch(() => {
          this.stopHeartbeat();
        });
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (!this.heartbeatTimer) {
      return;
    }

    this.clearIntervalImpl(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}

function hasInjection(input: unknown): boolean {
  if (typeof input === "string") {
    return detectInjection(input);
  }

  if (Array.isArray(input)) {
    return input.some((value) => hasInjection(value));
  }

  if (typeof input === "object" && input !== null) {
    return Object.values(input).some((value) => hasInjection(value));
  }

  return false;
}
