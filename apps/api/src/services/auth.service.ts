import crypto from "node:crypto";
import argon2 from "argon2";

import { config } from "@hone/shared";

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
    }): Promise<unknown>;
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

function signPayload(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export class AuthService {
  constructor(
    private readonly db: AuthDb,
    private readonly sessionSecret: string = config.SESSION_SECRET,
  ) {}

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

    const expiresAt = new Date(Date.now() + getSessionDurationMs(user.role));
    const payload = `${userId}.${expiresAt.getTime()}`;
    const sig = signPayload(payload, this.sessionSecret);

    return `${payload}.${sig}`;
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

    return this.createSession(user.id);
  }

  async invalidateSession(_rawToken: string) {
    // stateless — cookie is cleared by the route
  }

  async invalidateUserSessions(_userId: string) {
    // stateless — no server-side session state to revoke
  }

  async validateSession(rawToken: string) {
    const lastDot = rawToken.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payload = rawToken.slice(0, lastDot);
    const sig = rawToken.slice(lastDot + 1);

    const expectedSig = signPayload(payload, this.sessionSecret);
    const expectedBuf = Buffer.from(expectedSig, "hex");
    const actualBuf = Buffer.from(sig, "hex");

    if (
      expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }

    const dotIndex = payload.indexOf(".");
    if (dotIndex === -1) return null;

    const userId = payload.slice(0, dotIndex);
    const expiryMs = Number(payload.slice(dotIndex + 1));

    if (!userId || Number.isNaN(expiryMs) || Date.now() > expiryMs) {
      return null;
    }

    const expiresAt = new Date(expiryMs);

    return {
      id: sig,
      expiresAt,
      user: { id: userId },
    };
  }
}
