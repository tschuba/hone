type CleanupDb = {
  session: {
    deleteMany(args: {
      where: {
        expiresAt: {
          lt: Date;
        };
      };
    }): Promise<unknown>;
  };
  usedLogoutToken: {
    deleteMany(args: {
      where: {
        expiresAt: {
          lt: Date;
        };
      };
    }): Promise<unknown>;
  };
};

export async function cleanupExpiredAuthArtifacts(
  db: CleanupDb,
  now = new Date(),
) {
  await Promise.all([
    db.session.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
    db.usedLogoutToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
  ]);
}
