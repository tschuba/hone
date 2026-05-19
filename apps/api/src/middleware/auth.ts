import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { db } from "../db/client";
import { AuthService } from "../services/auth.service";

export type AuthVariables = {
  sessionId: string;
  userId: string;
};

type AuthMiddlewareSession = {
  id: string;
  user: {
    id: string;
  };
};

type AuthMiddlewareService = {
  validateSession(rawToken: string): Promise<AuthMiddlewareSession | null>;
};

export function createAuthMiddleware(
  authService: AuthMiddlewareService = new AuthService(db),
) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const rawToken = getCookie(c, "hone_session");

    if (!rawToken) {
      return c.json({ status: 401, title: "Unauthorized" }, 401);
    }

    const session = await authService.validateSession(rawToken);

    if (!session) {
      return c.json({ status: 401, title: "Unauthorized" }, 401);
    }

    c.set("sessionId", session.id);
    c.set("userId", session.user.id);

    await next();
  });
}

export const authMiddleware = createAuthMiddleware();
