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

const app = new Hono();

app.use("/api/v1/auth/login", authRateLimitMiddleware);
app.use("/api/v1/auth/register", authRateLimitMiddleware);
app.use("*", rateLimitMiddleware);
app.use("*", csrfMiddleware);
app.route("/api/v1/auth", createAuthRoutes());

let bootstrapAdminUnclaimed = false;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
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

app.get("/health", (c) => {
  return c.json({
    bootstrapAdminUnclaimed,
    status: "ok",
  });
});

app.get("/health/ready", async (c) => {
  try {
    await checkDatabase();

    return c.json({
      bootstrapAdminUnclaimed,
      status: "ok",
    });
  } catch (error) {
    console.error("Readiness check failed", error);

    return c.json(
      {
        bootstrapAdminUnclaimed,
        status: "error",
      },
      503,
    );
  }
});

async function start() {
  await prisma.$connect();
  await refreshBootstrapAdminState();
  await cleanupExpiredAuthArtifacts(prisma);

  cleanupTimer = setInterval(
    () => {
      cleanupExpiredAuthArtifacts(prisma).catch((error) => {
        console.error("Auth cleanup failed", error);
      });
    },
    5 * 60 * 1000,
  );

  const server = Bun.serve({
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: config.PORT,
  });

  console.log(`Hone API listening on http://0.0.0.0:${config.PORT}`);

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);

    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }

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
