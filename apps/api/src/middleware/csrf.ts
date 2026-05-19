import crypto from "node:crypto";

import { config } from "@hone/shared";

import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

const appOrigin = new URL(config.APP_URL).origin;

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export const csrfMiddleware = createMiddleware(async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    await next();
    return;
  }

  if (c.req.path.endsWith("/backchannel-logout")) {
    await next();
    return;
  }

  const origin = c.req.header("origin");

  if (origin !== appOrigin) {
    return c.json({ status: 403, title: "Invalid request origin" }, 403);
  }

  const cookieToken = getCookie(c, "csrf_token");
  const headerToken = c.req.header("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return c.json({ status: 403, title: "CSRF token mismatch" }, 403);
  }

  await next();
});
