import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { createAuthMiddleware } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { createAuthRoutes } from "./auth.routes";

function createTestApp(
  authService: {
    createLocalUser(
      email: string,
      password: string,
    ): Promise<{ email: string; id: string }>;
    createSession(userId: string): Promise<string>;
    invalidateSession(rawToken: string): Promise<void>;
    invalidateUserSessions(userId: string): Promise<void>;
    loginLocal(email: string, password: string): Promise<string>;
  },
  oidcService: {
    createAuthorizationRequest(): Promise<{
      authorizationUrl: string;
      codeVerifier: string;
      nonce: string;
      state: string;
    }>;
    handleCallback(input: {
      code: string;
      codeVerifier: string;
      nonce: string;
      state: string;
    }): Promise<{ email?: string; role: "ADMIN" | "USER"; sub: string }>;
    handleBackchannelLogout(logoutToken: string): Promise<{
      expiresAt: Date;
      jti: string;
      sub: string;
    }>;
  },
  storage: {
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
  },
  options: {
    session?: {
      sessionId: string;
      token: string;
      userId: string;
    };
  } = {},
) {
  const app = new Hono();
  app.use("*", csrfMiddleware);

  const authGuard = createAuthMiddleware({
    async validateSession(rawToken: string) {
      if (!options.session || rawToken !== options.session.token) {
        return null;
      }

      return {
        id: options.session.sessionId,
        user: { id: options.session.userId },
      };
    },
  });

  app.route(
    "/api/v1/auth",
    createAuthRoutes(authService, oidcService, {
      authGuard,
      oidcEnabled: true,
      storage,
    }),
  );
  return app;
}

describe("auth routes", () => {
  let app: Hono;
  let invalidatedToken: string | null;
  let invalidatedUserIds: string[];
  let loginCalls: Array<{ email: string; password: string }>;
  let oidcUsers = new Map<string, { id: string; role: "ADMIN" | "USER" }>();
  let updatedRoles: Array<{ role: "ADMIN" | "USER"; userId: string }>;
  let usedLogoutTokenJtis: string[];
  let sessionUserIds: string[];

  beforeEach(() => {
    invalidatedToken = null;
    invalidatedUserIds = [];
    loginCalls = [];
    oidcUsers = new Map();
    updatedRoles = [];
    usedLogoutTokenJtis = [];
    sessionUserIds = [];

    app = createTestApp(
      {
        async createLocalUser(email: string) {
          return { email, id: "user-1" };
        },
        async createSession(userId: string) {
          sessionUserIds.push(userId);
          return "session-token";
        },
        async invalidateSession(rawToken: string) {
          invalidatedToken = rawToken;
        },
        async invalidateUserSessions(userId: string) {
          invalidatedUserIds.push(userId);
        },
        async loginLocal(email: string, password: string) {
          loginCalls.push({ email, password });
          return "session-token";
        },
      },
      {
        async createAuthorizationRequest() {
          return {
            authorizationUrl: "https://issuer.example.test/authorize",
            codeVerifier: "code-verifier",
            nonce: "nonce-value",
            state: "state-value",
          };
        },
        async handleCallback() {
          return {
            email: "oidc@example.com",
            role: "USER",
            sub: "oidc-sub-1",
          };
        },
        async handleBackchannelLogout() {
          return {
            expiresAt: new Date("2026-05-19T00:00:00.000Z"),
            jti: "logout-jti-1",
            sub: "oidc-sub-1",
          };
        },
      },
      {
        async createOidcUser(input) {
          oidcUsers.set(input.oidcSub, { id: "oidc-user-1", role: input.role });
          return { id: "oidc-user-1" };
        },
        async findUserByOidcSub(oidcSub: string) {
          return oidcUsers.get(oidcSub) ?? null;
        },
        async markLogoutTokenUsed(input) {
          usedLogoutTokenJtis.push(input.jti);
          return true;
        },
        async updateUserRole(userId, role) {
          updatedRoles.push({ role, userId });
        },
      },
    );
  });

  it("issues a csrf token cookie", async () => {
    const response = await app.request("http://hone.test/api/v1/auth/csrf");

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("csrf_token=");
  });

  it("rejects register without matching csrf token", async () => {
    const response = await app.request(
      "http://hone.test/api/v1/auth/register",
      {
        body: JSON.stringify({
          email: "test@example.com",
          password: "password12345",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(403);
  });

  it("registers a user when csrf tokens match", async () => {
    const csrfResponse = await app.request("http://hone.test/api/v1/auth/csrf");
    const setCookieHeader = csrfResponse.headers.get("set-cookie");
    const csrfToken = (await csrfResponse.json()) as { csrfToken: string };

    const response = await app.request(
      "http://hone.test/api/v1/auth/register",
      {
        body: JSON.stringify({
          email: "test@example.com",
          password: "password12345",
        }),
        headers: {
          cookie: setCookieHeader ?? "",
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-csrf-token": csrfToken.csrfToken,
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("hone_session=");
    expect(response.headers.get("set-cookie")).toContain("csrf_token=");
  });

  it("logs in a user and sets a strict httpOnly session cookie", async () => {
    const csrfResponse = await app.request("http://hone.test/api/v1/auth/csrf");
    const setCookieHeader = csrfResponse.headers.get("set-cookie");
    const csrfToken = (await csrfResponse.json()) as { csrfToken: string };

    const response = await app.request("http://hone.test/api/v1/auth/login", {
      body: JSON.stringify({
        email: "test@example.com",
        password: "password12345",
      }),
      headers: {
        cookie: setCookieHeader ?? "",
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-csrf-token": csrfToken.csrfToken,
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(loginCalls).toEqual([
      { email: "test@example.com", password: "password12345" },
    ]);
    expect(response.headers.get("set-cookie")).toContain("hone_session=");
    expect(response.headers.get("set-cookie")).toContain("csrf_token=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
  });

  it("logs out a user and invalidates the cookie token", async () => {
    const csrfResponse = await app.request("http://hone.test/api/v1/auth/csrf");
    const setCookieHeader = csrfResponse.headers.get("set-cookie");
    const csrfToken = (await csrfResponse.json()) as { csrfToken: string };

    const response = await app.request("http://hone.test/api/v1/auth/logout", {
      headers: {
        cookie: `${setCookieHeader}; hone_session=existing-session-token`,
        origin: "http://localhost:3000",
        "x-csrf-token": csrfToken.csrfToken,
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(invalidatedToken).toBe("existing-session-token");
    expect(response.headers.get("set-cookie")).toContain("hone_session=");
    expect(response.headers.get("set-cookie")).toContain("csrf_token=");
  });

  it("starts the oidc redirect flow", async () => {
    const response = await app.request(
      "http://hone.test/api/v1/auth/oidc/start",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://issuer.example.test/authorize",
    );
    expect(response.headers.get("set-cookie")).toContain("oidc_state=");
  });

  it("completes the oidc callback flow and creates a session", async () => {
    const startResponse = await app.request(
      "http://hone.test/api/v1/auth/oidc/start",
    );
    const oidcStateCookie = startResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(
      "http://hone.test/api/v1/auth/oidc/callback?code=test-code&state=state-value",
      {
        headers: {
          cookie: oidcStateCookie,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(sessionUserIds).toEqual(["oidc-user-1"]);
    expect(response.headers.get("set-cookie")).toContain("hone_session=");
    expect(response.headers.get("set-cookie")).toContain("csrf_token=");
    expect(oidcUsers.get("oidc-sub-1")?.role).toBe("USER");
  });

  it("applies oidc role updates to existing users", async () => {
    oidcUsers.set("oidc-sub-1", { id: "oidc-user-1", role: "USER" });

    app = createTestApp(
      {
        async createLocalUser(email: string) {
          return { email, id: "user-1" };
        },
        async createSession(userId: string) {
          sessionUserIds.push(userId);
          return "session-token";
        },
        async invalidateSession(rawToken: string) {
          invalidatedToken = rawToken;
        },
        async invalidateUserSessions(userId: string) {
          invalidatedUserIds.push(userId);
        },
        async loginLocal(email: string, password: string) {
          loginCalls.push({ email, password });
          return "session-token";
        },
      },
      {
        async createAuthorizationRequest() {
          return {
            authorizationUrl: "https://issuer.example.test/authorize",
            codeVerifier: "code-verifier",
            nonce: "nonce-value",
            state: "state-value",
          };
        },
        async handleCallback() {
          return {
            email: "oidc@example.com",
            role: "ADMIN",
            sub: "oidc-sub-1",
          };
        },
        async handleBackchannelLogout() {
          return {
            expiresAt: new Date("2026-05-19T00:00:00.000Z"),
            jti: "logout-jti-1",
            sub: "oidc-sub-1",
          };
        },
      },
      {
        async createOidcUser(input) {
          oidcUsers.set(input.oidcSub, { id: "oidc-user-1", role: input.role });
          return { id: "oidc-user-1" };
        },
        async findUserByOidcSub(oidcSub: string) {
          return oidcUsers.get(oidcSub) ?? null;
        },
        async markLogoutTokenUsed(input) {
          usedLogoutTokenJtis.push(input.jti);
          return true;
        },
        async updateUserRole(userId, role) {
          updatedRoles.push({ role, userId });
        },
      },
    );

    const startResponse = await app.request(
      "http://hone.test/api/v1/auth/oidc/start",
    );
    const oidcStateCookie = startResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(
      "http://hone.test/api/v1/auth/oidc/callback?code=test-code&state=state-value",
      {
        headers: {
          cookie: oidcStateCookie,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(updatedRoles).toEqual([{ role: "ADMIN", userId: "oidc-user-1" }]);
  });

  it("rejects the oidc callback when state is missing", async () => {
    const response = await app.request(
      "http://hone.test/api/v1/auth/oidc/callback?code=test-code",
    );

    expect(response.status).toBe(400);
  });

  it("rejects the oidc callback when state does not match", async () => {
    const startResponse = await app.request(
      "http://hone.test/api/v1/auth/oidc/start",
    );
    const oidcStateCookie = startResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(
      "http://hone.test/api/v1/auth/oidc/callback?code=test-code&state=wrong-state",
      {
        headers: {
          cookie: oidcStateCookie,
        },
      },
    );

    expect(response.status).toBe(400);
  });

  it("accepts a backchannel logout token, dedupes it, and revokes user sessions", async () => {
    oidcUsers.set("oidc-sub-1", { id: "oidc-user-1", role: "USER" });

    const firstResponse = await app.request(
      "http://hone.test/api/v1/auth/backchannel-logout",
      {
        body: new URLSearchParams({
          logout_token: "logout-token-value",
        }).toString(),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    expect(firstResponse.status).toBe(200);
    expect(usedLogoutTokenJtis).toEqual(["logout-jti-1"]);
    expect(invalidatedUserIds).toEqual(["oidc-user-1"]);

    app = createTestApp(
      {
        async createLocalUser(email: string) {
          return { email, id: "user-1" };
        },
        async createSession(userId: string) {
          sessionUserIds.push(userId);
          return "session-token";
        },
        async invalidateSession(rawToken: string) {
          invalidatedToken = rawToken;
        },
        async invalidateUserSessions(userId: string) {
          invalidatedUserIds.push(userId);
        },
        async loginLocal(email: string, password: string) {
          loginCalls.push({ email, password });
          return "session-token";
        },
      },
      {
        async createAuthorizationRequest() {
          return {
            authorizationUrl: "https://issuer.example.test/authorize",
            codeVerifier: "code-verifier",
            nonce: "nonce-value",
            state: "state-value",
          };
        },
        async handleCallback() {
          return {
            email: "oidc@example.com",
            role: "USER",
            sub: "oidc-sub-1",
          };
        },
        async handleBackchannelLogout() {
          return {
            expiresAt: new Date("2026-05-19T00:00:00.000Z"),
            jti: "logout-jti-1",
            sub: "oidc-sub-1",
          };
        },
      },
      {
        async createOidcUser(input) {
          oidcUsers.set(input.oidcSub, { id: "oidc-user-1", role: input.role });
          return { id: "oidc-user-1" };
        },
        async findUserByOidcSub(oidcSub: string) {
          return oidcUsers.get(oidcSub) ?? null;
        },
        async markLogoutTokenUsed() {
          return false;
        },
        async updateUserRole(userId, role) {
          updatedRoles.push({ role, userId });
        },
      },
    );

    const duplicateResponse = await app.request(
      "http://hone.test/api/v1/auth/backchannel-logout",
      {
        body: new URLSearchParams({
          logout_token: "logout-token-value",
        }).toString(),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    expect(duplicateResponse.status).toBe(200);
    expect(invalidatedUserIds).toEqual(["oidc-user-1"]);
  });

  it("rejects backchannel logout requests without a token", async () => {
    const response = await app.request(
      "http://hone.test/api/v1/auth/backchannel-logout",
      {
        body: new URLSearchParams().toString(),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid backchannel logout tokens", async () => {
    app = createTestApp(
      {
        async createLocalUser(email: string) {
          return { email, id: "user-1" };
        },
        async createSession(userId: string) {
          sessionUserIds.push(userId);
          return "session-token";
        },
        async invalidateSession(rawToken: string) {
          invalidatedToken = rawToken;
        },
        async invalidateUserSessions(userId: string) {
          invalidatedUserIds.push(userId);
        },
        async loginLocal(email: string, password: string) {
          loginCalls.push({ email, password });
          return "session-token";
        },
      },
      {
        async createAuthorizationRequest() {
          return {
            authorizationUrl: "https://issuer.example.test/authorize",
            codeVerifier: "code-verifier",
            nonce: "nonce-value",
            state: "state-value",
          };
        },
        async handleCallback() {
          return {
            email: "oidc@example.com",
            role: "USER",
            sub: "oidc-sub-1",
          };
        },
        async handleBackchannelLogout() {
          throw new Error("invalid logout token");
        },
      },
      {
        async createOidcUser(input) {
          oidcUsers.set(input.oidcSub, { id: "oidc-user-1", role: input.role });
          return { id: "oidc-user-1" };
        },
        async findUserByOidcSub(oidcSub: string) {
          return oidcUsers.get(oidcSub) ?? null;
        },
        async markLogoutTokenUsed(input) {
          usedLogoutTokenJtis.push(input.jti);
          return true;
        },
        async updateUserRole(userId, role) {
          updatedRoles.push({ role, userId });
        },
      },
    );

    const response = await app.request(
      "http://hone.test/api/v1/auth/backchannel-logout",
      {
        body: new URLSearchParams({ logout_token: "bad-token" }).toString(),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(401);
    expect(invalidatedUserIds).toEqual([]);
  });

  it("rejects unauthenticated /me requests", async () => {
    const response = await app.request("http://hone.test/api/v1/auth/me");

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user from /me", async () => {
    app = createTestApp(
      {
        async createLocalUser(email: string) {
          return { email, id: "user-1" };
        },
        async createSession(userId: string) {
          sessionUserIds.push(userId);
          return "session-token";
        },
        async invalidateSession(rawToken: string) {
          invalidatedToken = rawToken;
        },
        async invalidateUserSessions(userId: string) {
          invalidatedUserIds.push(userId);
        },
        async loginLocal(email: string, password: string) {
          loginCalls.push({ email, password });
          return "session-token";
        },
      },
      {
        async createAuthorizationRequest() {
          return {
            authorizationUrl: "https://issuer.example.test/authorize",
            codeVerifier: "code-verifier",
            nonce: "nonce-value",
            state: "state-value",
          };
        },
        async handleCallback() {
          return {
            email: "oidc@example.com",
            role: "USER",
            sub: "oidc-sub-1",
          };
        },
        async handleBackchannelLogout() {
          return {
            expiresAt: new Date("2026-05-19T00:00:00.000Z"),
            jti: "logout-jti-1",
            sub: "oidc-sub-1",
          };
        },
      },
      {
        async createOidcUser(input) {
          oidcUsers.set(input.oidcSub, { id: "oidc-user-1", role: input.role });
          return { id: "oidc-user-1" };
        },
        async findUserByOidcSub(oidcSub: string) {
          return oidcUsers.get(oidcSub) ?? null;
        },
        async markLogoutTokenUsed(input) {
          usedLogoutTokenJtis.push(input.jti);
          return true;
        },
        async updateUserRole(userId, role) {
          updatedRoles.push({ role, userId });
        },
      },
      {
        session: {
          sessionId: "session-42",
          token: "session-token-42",
          userId: "user-42",
        },
      },
    );

    const response = await app.request("http://hone.test/api/v1/auth/me", {
      headers: {
        cookie: "hone_session=session-token-42",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "user-42" });
  });
});
