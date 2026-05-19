import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { config } from "@hone/shared";

import { db } from "../db/client";
import { authMiddleware } from "../middleware/auth";
import { generateCsrfToken } from "../middleware/csrf";
import { authenticatedRateLimitMiddleware } from "../middleware/rate-limit";
import { AuthService } from "../services/auth.service";
import { OidcService } from "../services/oidc.service";

type AuthRouteService = {
  createLocalUser(
    email: string,
    password: string,
  ): Promise<{ email: string; id: string }>;
  createSession(userId: string): Promise<string>;
  invalidateSession(rawToken: string): Promise<void>;
  invalidateUserSessions(userId: string): Promise<void>;
  loginLocal(email: string, password: string): Promise<string>;
};

type OidcRouteService = Pick<
  OidcService,
  "createAuthorizationRequest" | "handleBackchannelLogout" | "handleCallback"
>;

type OidcStateCookie = {
  codeVerifier: string;
  nonce: string;
  state: string;
};

type AuthRouteOptions = {
  authGuard?: MiddlewareHandler;
  oidcEnabled?: boolean;
  storage?: AuthRouteStorage;
};

type AuthRouteStorage = {
  createOidcUser(input: {
    email: string;
    oidcSub: string;
    role: "ADMIN" | "USER";
  }): Promise<{ id: string }>;
  findUserByOidcSub(oidcSub: string): Promise<{ id: string } | null>;
  markLogoutTokenUsed(input: {
    expiresAt: Date;
    jti: string;
  }): Promise<boolean>;
  updateUserRole(userId: string, role: "ADMIN" | "USER"): Promise<void>;
};

const defaultAuthRouteStorage: AuthRouteStorage = {
  async createOidcUser(input) {
    return db.user.create({
      data: input,
    });
  },
  async findUserByOidcSub(oidcSub) {
    return db.user.findFirst({
      where: { oidcSub },
    });
  },
  async markLogoutTokenUsed(input) {
    try {
      await db.usedLogoutToken.create({
        data: input,
      });

      return true;
    } catch {
      return false;
    }
  },
  async updateUserRole(userId, role) {
    await db.user.update({
      where: { id: userId },
      data: { role },
    });
  },
};

function sessionCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Strict" as const,
    secure: config.NODE_ENV === "production",
  };
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    path: "/",
    sameSite: "Strict" as const,
    secure: config.NODE_ENV === "production",
  };
}

function rotateCsrfToken(c: Parameters<typeof setCookie>[0]) {
  const token = generateCsrfToken();

  setCookie(c, "csrf_token", token, csrfCookieOptions());

  return token;
}

export function createAuthRoutes(
  authService: AuthRouteService = new AuthService(db),
  oidcService: OidcRouteService = new OidcService(),
  options: AuthRouteOptions = {},
) {
  const authRoutes = new Hono();
  const authGuard = options.authGuard ?? authMiddleware;
  const oidcEnabled = options.oidcEnabled ?? !config.USE_LOCAL_AUTH_ONLY;
  const storage = options.storage ?? defaultAuthRouteStorage;

  authRoutes.get("/oidc/start", async (c) => {
    if (!oidcEnabled) {
      return c.json({ status: 503, title: "OIDC is disabled" }, 503);
    }

    try {
      const request = await oidcService.createAuthorizationRequest();

      setCookie(
        c,
        "oidc_state",
        JSON.stringify({
          codeVerifier: request.codeVerifier,
          nonce: request.nonce,
          state: request.state,
        } satisfies OidcStateCookie),
        sessionCookieOptions(),
      );

      return c.redirect(request.authorizationUrl, 302);
    } catch {
      return c.json({ status: 503, title: "OIDC is not configured" }, 503);
    }
  });

  authRoutes.get("/csrf", (c) => {
    const token = rotateCsrfToken(c);

    return c.json({ csrfToken: token }, 200);
  });

  authRoutes.post("/register", async (c) => {
    const { email, password } = await c.req.json<{
      email?: string;
      password?: string;
    }>();

    if (!email || !password) {
      return c.json(
        { status: 400, title: "Email and password are required" },
        400,
      );
    }

    try {
      const user = await authService.createLocalUser(email, password);
      const sessionToken = await authService.createSession(user.id);

      setCookie(c, "hone_session", sessionToken, sessionCookieOptions());
      rotateCsrfToken(c);

      return c.json({ email: user.email, id: user.id }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "Password too short") {
        return c.json({ status: 400, title: error.message }, 400);
      }

      return c.json({ status: 409, title: "Unable to register user" }, 409);
    }
  });

  authRoutes.post("/login", async (c) => {
    const { email, password } = await c.req.json<{
      email?: string;
      password?: string;
    }>();

    if (!email || !password) {
      return c.json(
        { status: 400, title: "Email and password are required" },
        400,
      );
    }

    try {
      const sessionToken = await authService.loginLocal(email, password);

      setCookie(c, "hone_session", sessionToken, sessionCookieOptions());
      rotateCsrfToken(c);

      return c.json({ ok: true }, 200);
    } catch {
      return c.json({ status: 401, title: "Invalid credentials" }, 401);
    }
  });

  authRoutes.post("/logout", async (c) => {
    const rawToken = getCookie(c, "hone_session");

    if (rawToken) {
      await authService.invalidateSession(rawToken);
    }

    deleteCookie(c, "hone_session", { path: "/" });
    rotateCsrfToken(c);

    return c.json({ ok: true }, 200);
  });

  authRoutes.get("/oidc/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const oidcStateCookie = getCookie(c, "oidc_state");

    if (!code || !state || !oidcStateCookie) {
      return c.json({ status: 400, title: "Missing OIDC callback state" }, 400);
    }

    let parsedCookie: OidcStateCookie;

    try {
      parsedCookie = JSON.parse(oidcStateCookie) as OidcStateCookie;
    } catch {
      return c.json({ status: 400, title: "Invalid OIDC callback state" }, 400);
    }

    if (parsedCookie.state !== state) {
      return c.json({ status: 400, title: "OIDC state mismatch" }, 400);
    }

    try {
      const claims = await oidcService.handleCallback({
        code,
        codeVerifier: parsedCookie.codeVerifier,
        nonce: parsedCookie.nonce,
        state,
      });

      let user = await storage.findUserByOidcSub(claims.sub);

      if (!user) {
        user = await storage.createOidcUser({
          email: claims.email ?? `${claims.sub}@oidc.local`,
          oidcSub: claims.sub,
          role: claims.role,
        });
      } else {
        await storage.updateUserRole(user.id, claims.role);
      }

      const sessionToken = await authService.createSession(user.id);

      setCookie(c, "hone_session", sessionToken, sessionCookieOptions());
      rotateCsrfToken(c);
      deleteCookie(c, "oidc_state", { path: "/" });

      return c.json({ ok: true }, 200);
    } catch {
      return c.json({ status: 401, title: "OIDC callback failed" }, 401);
    }
  });

  authRoutes.post("/backchannel-logout", async (c) => {
    if (!oidcEnabled) {
      return c.json({ status: 503, title: "OIDC is disabled" }, 503);
    }

    const body = await c.req.parseBody();
    const logoutToken =
      typeof body.logout_token === "string" ? body.logout_token : undefined;

    if (!logoutToken) {
      return c.json({ status: 400, title: "Missing logout token" }, 400);
    }

    try {
      const logout = await oidcService.handleBackchannelLogout(logoutToken);
      const isNewToken = await storage.markLogoutTokenUsed({
        expiresAt: logout.expiresAt,
        jti: logout.jti,
      });

      if (!isNewToken) {
        return c.json({ ok: true }, 200);
      }

      const user = await storage.findUserByOidcSub(logout.sub);

      if (user) {
        await authService.invalidateUserSessions(user.id);
      }

      return c.json({ ok: true }, 200);
    } catch {
      return c.json({ status: 401, title: "Invalid logout token" }, 401);
    }
  });

  authRoutes.get("/me", authGuard, authenticatedRateLimitMiddleware, (c) => {
    return c.json({ userId: c.get("userId") }, 200);
  });

  return authRoutes;
}
