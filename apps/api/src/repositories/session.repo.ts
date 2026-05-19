import { db } from "../db/client";

export class SessionRepository {
  async create(input: {
    expiresAt: Date;
    sessionHash: string;
    userId: string;
  }) {
    return db.session.create({
      data: input,
    });
  }

  async deleteBySessionHash(sessionHash: string) {
    return db.session.deleteMany({
      where: { sessionHash },
    });
  }

  async findActiveBySessionHash(sessionHash: string) {
    return db.session.findFirst({
      where: {
        expiresAt: { gt: new Date() },
        sessionHash,
      },
      include: { user: true },
    });
  }
}
