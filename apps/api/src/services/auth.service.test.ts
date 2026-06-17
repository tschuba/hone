import { beforeEach, describe, expect, it } from "bun:test";

import { AuthService } from "./auth.service";

const TEST_SECRET = "test-secret-for-auth-service-xxxxxxxxxxxxxxxx";

type TestUser = {
  email: string;
  id: string;
  passwordHash: string | null;
  role: string;
};

function createMockDb() {
  const users = new Map<string, TestUser>();

  return {
    session: {
      async create(_args: unknown) {
        return {};
      },
      async deleteMany(_args: unknown) {
        return { count: 0 };
      },
      async findFirst(_args: unknown) {
        return null;
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
    authService = new AuthService(createMockDb(), TEST_SECRET);
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
      "Password must be at least 12 characters",
    );
  });
});

describe("AuthService sessions", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(createMockDb(), TEST_SECRET);
  });

  it("issues a signed token that validates to the correct user", async () => {
    const user = await authService.createLocalUser(
      "session@example.com",
      "password12345",
    );
    const rawToken = await authService.createSession(user.id);
    const session = await authService.validateSession(rawToken);

    expect(session).not.toBeNull();
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
    const mockDb = createMockDb();
    const adminAuthService = new AuthService(mockDb, TEST_SECRET);
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

  it("rejects a tampered token", async () => {
    const user = await authService.createLocalUser(
      "tamper@example.com",
      "password12345",
    );
    const rawToken = await authService.createSession(user.id);
    const tampered = `${rawToken.slice(0, -4)}0000`;

    await expect(authService.validateSession(tampered)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const user = await authService.createLocalUser(
      "expired@example.com",
      "password12345",
    );
    const pastExpiry = Date.now() - 1000;
    const payload = `${user.id}.${pastExpiry}`;
    const crypto2 = await import("node:crypto");
    const sig = crypto2
      .createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");
    const expiredToken = `${payload}.${sig}`;

    await expect(authService.validateSession(expiredToken)).resolves.toBeNull();
  });

  it("issues a new session on each login", async () => {
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
    await expect(authService.validateSession(newToken)).resolves.not.toBeNull();
  });
});
