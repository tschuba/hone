import crypto from "node:crypto";
import argon2 from "argon2";

const ADMIN_SESSION_DURATION_MS = 1 * 60 * 60 * 1000;
const ARGON2_OPTS = {
  memoryCost: 32768,
  parallelism: 2,
  timeCost: 4,
} as const;
const USER_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

type UserRecord = {
  email: string;
  id: string;
  passwordHash: string | null;
  role: string;
};

type SessionRecord = {
  expiresAt: Date;
  id: string;
  sessionHash: string;
  user: UserRecord;
  userId: string;
};

type AuthDb = {
  session: {
    create(args: {
      data: {
        expiresAt: Date;
        sessionHash: string;
        userId: string;
      };
    }): Promise<unknown>;
    deleteMany(args: {
      where: { sessionHash: string } | { userId: string };
    }): Promise<unknown>;
    findFirst(args: {
      include: { user: true };
      where: {
        expiresAt: { gt: Date };
        sessionHash: string;
      };
    }): Promise<SessionRecord | null>;
  };
  user: {
    create(args: {
      data: {
        email: string;
        passwordHash: string;
      };
    }): Promise<UserRecord>;
    findFirst(args: {
      where: {
        email?: string;
        id?: string;
      };
    }): Promise<UserRecord | null>;
  };
};

function getSessionDurationMs(role: UserRecord["role"]) {
  return role === "ADMIN"
    ? ADMIN_SESSION_DURATION_MS
    : USER_SESSION_DURATION_MS;
}

export class AuthService {
  constructor(private readonly db: AuthDb) {}

  async createLocalUser(email: string, password: string) {
    if (password.length < 12) {
      throw new Error("Password must be at least 12 characters");
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTS);

    return this.db.user.create({
      data: {
        email,
        passwordHash,
      },
    });
  }

  async verifyLocalPassword(passwordHash: string, candidate: string) {
    return argon2.verify(passwordHash, candidate);
  }

  async createSession(userId: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + getSessionDurationMs(user.role));

    await this.db.session.create({
      data: {
        expiresAt,
        sessionHash,
        userId,
      },
    });

    return rawToken;
  }

  async loginLocal(email: string, password: string) {
    const user = await this.db.user.findFirst({
      where: { email },
    });

    if (!user?.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const isValid = await this.verifyLocalPassword(user.passwordHash, password);

    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    await this.db.session.deleteMany({
      where: { userId: user.id },
    });

    return this.createSession(user.id);
  }

  async invalidateSession(rawToken: string) {
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await this.db.session.deleteMany({
      where: { sessionHash },
    });
  }

  async invalidateUserSessions(userId: string) {
    await this.db.session.deleteMany({
      where: { userId },
    });
  }

  async validateSession(rawToken: string) {
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    return this.db.session.findFirst({
      where: {
        expiresAt: { gt: new Date() },
        sessionHash,
      },
      include: { user: true },
    });
  }
}
