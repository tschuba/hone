import { beforeEach, describe, expect, it } from "bun:test";

import { AuthService } from "./auth.service";

type TestUser = {
  email: string;
  id: string;
  passwordHash: string | null;
  role: string;
};

type TestSession = {
  expiresAt: Date;
  id: string;
  sessionHash: string;
  userId: string;
};

type SessionDeleteWhere = { sessionHash: string } | { userId: string };

function createMockDb() {
  const users = new Map<string, TestUser>();
  const sessions = new Map<string, TestSession>();

  return {
    session: {
      async create({
        data,
      }: {
        data: { expiresAt: Date; sessionHash: string; userId: string };
      }) {
        const session = {
          ...data,
          id: crypto.randomUUID(),
        } satisfies TestSession;

        sessions.set(session.sessionHash, session);
        return session;
      },
      async deleteMany({ where }: { where: SessionDeleteWhere }) {
        if ("sessionHash" in where) {
          const deleted = sessions.delete(where.sessionHash);
          return { count: deleted ? 1 : 0 };
        }

        let count = 0;

        for (const [sessionHash, session] of sessions.entries()) {
          if (session.userId === where.userId) {
            sessions.delete(sessionHash);
            count += 1;
          }
        }

        return { count };
      },
      async findFirst({
        where,
      }: {
        include: { user: true };
        where: { expiresAt: { gt: Date }; sessionHash: string };
      }) {
        const session = sessions.get(where.sessionHash);

        if (!session || session.expiresAt <= where.expiresAt.gt) {
          return null;
        }

        const user = users.get(session.userId);

        if (!user) {
          return null;
        }

        return {
          ...session,
          user,
        };
      },
    },
    user: {
      async create({
        data,
      }: {
        data: { email: string; passwordHash: string };
      }) {
        const user = {
          ...data,
          id: crypto.randomUUID(),
          role: "USER",
        } satisfies TestUser;

        users.set(user.id, user);
        return user;
      },
      async findFirst({ where }: { where: { email?: string; id?: string } }) {
        for (const user of users.values()) {
          if (
            (where.email && user.email === where.email) ||
            (where.id && user.id === where.id)
          ) {
            return user;
          }
        }

        return null;
      },
    },
  };
}

describe("AuthService.createLocalUser", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(createMockDb());
  });

  it("hashes password with argon2", async () => {
    const user = await authService.createLocalUser(
      "test@example.com",
      "password12345",
    );

    expect(user.passwordHash).not.toBe("password12345");
    expect(user.passwordHash).toMatch(/^\$argon2/);
  });

  it("rejects weak passwords", async () => {
    await expect(authService.createLocalUser("a@b.com", "123")).rejects.toThrow(
      "Password too short",
    );
  });
});

describe("AuthService sessions", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(createMockDb());
  });

  it("stores only a hashed session token", async () => {
    const user = await authService.createLocalUser(
      "session@example.com",
      "password12345",
    );
    const rawToken = await authService.createSession(user.id);
    const session = await authService.validateSession(rawToken);

    expect(session).not.toBeNull();
    expect(session?.sessionHash).not.toBe(rawToken);
    expect(session?.user.id).toBe(user.id);
  });

  it("uses an 8 hour expiry for user sessions", async () => {
    const before = Date.now();
    const user = await authService.createLocalUser(
      "duration-user@example.com",
      "password12345",
    );
    const rawToken = await authService.createSession(user.id);
    const session = await authService.validateSession(rawToken);
    const expiryDelta = (session?.expiresAt.getTime() ?? 0) - before;

    expect(expiryDelta).toBeGreaterThanOrEqual(8 * 60 * 60 * 1000 - 2_000);
    expect(expiryDelta).toBeLessThanOrEqual(8 * 60 * 60 * 1000 + 2_000);
  });

  it("uses a 1 hour expiry for admin sessions", async () => {
    const before = Date.now();
    const user = await authService.createLocalUser(
      "duration-admin@example.com",
      "password12345",
    );
    const mockDb = createMockDb();
    const adminAuthService = new AuthService(mockDb);
    const adminUser = await adminAuthService.createLocalUser(
      "admin@example.com",
      "password12345",
    );

    const storedAdminUser = await mockDb.user.findFirst({
      where: { id: adminUser.id },
    });

    if (!storedAdminUser) {
      throw new Error("Expected admin user to exist");
    }

    storedAdminUser.role = "ADMIN";

    const rawToken = await adminAuthService.createSession(adminUser.id);
    const session = await adminAuthService.validateSession(rawToken);
    const expiryDelta = (session?.expiresAt.getTime() ?? 0) - before;

    expect(expiryDelta).toBeGreaterThanOrEqual(1 * 60 * 60 * 1000 - 2_000);
    expect(expiryDelta).toBeLessThanOrEqual(1 * 60 * 60 * 1000 + 2_000);
  });

  it("invalidates an existing session", async () => {
    const user = await authService.createLocalUser(
      "logout@example.com",
      "password12345",
    );
    const rawToken = await authService.createSession(user.id);

    await authService.invalidateSession(rawToken);

    await expect(authService.validateSession(rawToken)).resolves.toBeNull();
  });

  it("invalidates all sessions for a user", async () => {
    const user = await authService.createLocalUser(
      "revoke@example.com",
      "password12345",
    );
    const firstToken = await authService.createSession(user.id);
    const secondToken = await authService.createSession(user.id);

    await authService.invalidateUserSessions(user.id);

    await expect(authService.validateSession(firstToken)).resolves.toBeNull();
    await expect(authService.validateSession(secondToken)).resolves.toBeNull();
  });

  it("issues a new session after login and invalidates the old one", async () => {
    const user = await authService.createLocalUser(
      "user@test.com",
      "password12345",
    );
    const oldToken = await authService.createSession(user.id);

    const newToken = await authService.loginLocal(
      "user@test.com",
      "password12345",
    );

    expect(newToken).not.toBe(oldToken);
    await expect(authService.validateSession(oldToken)).resolves.toBeNull();
    await expect(authService.validateSession(newToken)).resolves.not.toBeNull();
  });
});
