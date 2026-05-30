import { Role } from "@prisma/client";
import { Hono } from "hono";

import { config } from "@hone/shared";

import { closeDatabase, db, prisma } from "./db/client";
import { cleanupExpiredAuthArtifacts } from "./maintenance/auth-cleanup";
import { csrfMiddleware } from "./middleware/csrf";
import {
  authRateLimitMiddleware,
  rateLimitMiddleware,
} from "./middleware/rate-limit";
import { createAuthRoutes } from "./routes/auth.routes";
import { createEquipmentRoutes } from "./routes/equipment.routes";
import { createExerciseRoutes } from "./routes/exercise.routes";
import { createFeedbackRoutes } from "./routes/feedback.routes";
import { createPlanRoutes } from "./routes/plan.routes";
import { createProfileRoutes } from "./routes/profile.routes";
import { createSetLogRoutes } from "./routes/set-log.routes";
import { createWorkoutSessionRoutes } from "./routes/workout-session.routes";
import { createWorkoutRoutes } from "./routes/workout.routes";
import { AiJobWorker } from "./workers/ai-job-worker";

const app = new Hono();

app.use("/api/v1/auth/login", authRateLimitMiddleware);
app.use("/api/v1/auth/register", authRateLimitMiddleware);
app.use("*", rateLimitMiddleware);
app.use("*", async (c, next) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64url");

  await next();

  c.header(
    "Content-Security-Policy",
    `default-src 'self'; object-src 'none'; base-uri 'self'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
  );
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
});
app.use("*", csrfMiddleware);
app.route("/api/v1/auth", createAuthRoutes());
app.route("/api/v1/equipment-pools", createEquipmentRoutes());
app.route("/api/v1/exercises", createExerciseRoutes());
app.route("/api/v1/feedback", createFeedbackRoutes());
app.route("/api/v1/plans", createPlanRoutes());
app.route("/api/v1/users", createProfileRoutes());
app.route("/api/v1/workout", createWorkoutRoutes());
app.route("/api/v1/workout-sessions", createSetLogRoutes());
app.route("/api/v1/workout-sessions", createWorkoutSessionRoutes());

let bootstrapAdminUnclaimed = false;
let aiJobWorker: AiJobWorker | null = null;
let aiWorkerAvailable = false;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let dbAvailable = false;
let infraRetryTimer: ReturnType<typeof setInterval> | null = null;
let initializingInfra = false;
let lastInfraLogState: "degraded" | "ok" | null = null;
let shuttingDown = false;

async function refreshBootstrapAdminState() {
  if (!config.BOOTSTRAP_ADMIN_EMAIL) {
    bootstrapAdminUnclaimed = false;
    return;
  }

  const bootstrapAdmin = await db.user.findFirst({
    where: {
      email: config.BOOTSTRAP_ADMIN_EMAIL,
      role: Role.ADMIN,
    },
  });

  bootstrapAdminUnclaimed = Boolean(bootstrapAdmin && !bootstrapAdmin.oidcSub);

  if (bootstrapAdminUnclaimed) {
    console.warn("[WARN] Bootstrap admin not yet claimed via OIDC");
  }
}

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function isDatabaseUnavailableError(error: unknown) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  return (
    code === "ECONNREFUSED" ||
    message.includes("ECONNREFUSED") ||
    message.includes("Can't reach database server")
  );
}

function logDegradedMode(error: unknown, prefix: string) {
  if (lastInfraLogState === "degraded") {
    return;
  }

  const reason = isDatabaseUnavailableError(error)
    ? `database unavailable (${getErrorCode(error) ?? "unknown"})`
    : getErrorMessage(error);

  console.warn(`${prefix}; ${reason}`);
  lastInfraLogState = "degraded";
}

function logRecoveredMode() {
  if (lastInfraLogState === "ok") {
    return;
  }

  console.info(
    "Hone API recovered from degraded mode; database connection restored",
  );
  lastInfraLogState = "ok";
}

function getHealthStatus() {
  return dbAvailable && aiWorkerAvailable ? "ok" : "degraded";
}

async function stopBackgroundServices() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  if (aiJobWorker) {
    await aiJobWorker.stop();
    aiJobWorker = null;
  }

  aiWorkerAvailable = false;
}

async function initializeInfrastructure() {
  if (initializingInfra || shuttingDown) {
    return;
  }

  initializingInfra = true;

  try {
    await prisma.$connect();
    await checkDatabase();
    dbAvailable = true;

    await refreshBootstrapAdminState();
    await cleanupExpiredAuthArtifacts(prisma);

    if (!aiJobWorker) {
      const worker = new AiJobWorker();
      await worker.start();
      aiJobWorker = worker;
    }

    aiWorkerAvailable = true;
    logRecoveredMode();

    if (!cleanupTimer) {
      cleanupTimer = setInterval(
        () => {
          cleanupExpiredAuthArtifacts(prisma).catch(async (error) => {
            logDegradedMode(
              error,
              "Auth cleanup failed, switching to degraded mode",
            );
            dbAvailable = false;
            bootstrapAdminUnclaimed = false;
            await stopBackgroundServices();
          });
        },
        5 * 60 * 1000,
      );
    }
  } catch (error) {
    logDegradedMode(
      error,
      dbAvailable || aiWorkerAvailable
        ? "Infrastructure became unavailable, switching to degraded mode"
        : "Starting Hone API in degraded mode",
    );

    dbAvailable = false;
    bootstrapAdminUnclaimed = false;
    await stopBackgroundServices();
  } finally {
    initializingInfra = false;
  }
}

app.get("/health", (c) => {
  return c.json({
    bootstrapAdminUnclaimed,
    status: getHealthStatus(),
  });
});

app.get("/health/ready", async (c) => {
  try {
    await checkDatabase();

    return c.json({
      bootstrapAdminUnclaimed,
      db: "ok",
      status: getHealthStatus(),
    });
  } catch (error) {
    dbAvailable = false;
    bootstrapAdminUnclaimed = false;
    aiWorkerAvailable = false;

    return c.json(
      {
        bootstrapAdminUnclaimed,
        db: "unavailable",
        status: "degraded",
      },
      503,
    );
  }
});

app.onError((error, c) => {
  if (isDatabaseUnavailableError(error)) {
    dbAvailable = false;
    bootstrapAdminUnclaimed = false;
    aiWorkerAvailable = false;
    logDegradedMode(
      error,
      "Database request failed, switching to degraded mode",
    );

    void stopBackgroundServices().catch((stopError) => {
      console.error(
        "Failed to stop background services after database error",
        stopError,
      );
    });

    return c.json(
      {
        status: 503,
        title: "Database unavailable",
      },
      503,
    );
  }

  console.error("Unhandled API error", error);

  return c.json(
    {
      status: 500,
      title: "Internal server error",
    },
    500,
  );
});

async function start() {
  const server = Bun.serve({
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: config.PORT,
  });

  console.log(`Hone API listening on http://0.0.0.0:${config.PORT}`);

  await initializeInfrastructure();

  infraRetryTimer = setInterval(() => {
    initializeInfrastructure().catch((error) => {
      console.error("Infrastructure retry failed", error);
    });
  }, 10_000);

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);

    if (infraRetryTimer) {
      clearInterval(infraRetryTimer);
      infraRetryTimer = null;
    }

    await stopBackgroundServices();

    server.stop(true);
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      console.error("Shutdown failed", error);
      process.exit(1);
    });
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      console.error("Shutdown failed", error);
      process.exit(1);
    });
  });
}

start().catch(async (error) => {
  console.error("Failed to start Hone API", error);
  await closeDatabase();
  process.exit(1);
});
