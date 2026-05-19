import { describe, expect, it } from "bun:test";

import { cleanupExpiredAuthArtifacts } from "./auth-cleanup";

describe("cleanupExpiredAuthArtifacts", () => {
  it("cleans expired sessions and used logout tokens with the same cutoff", async () => {
    const calls: Array<{ table: string; expiresAt: Date }> = [];
    const now = new Date("2026-05-18T12:00:00.000Z");

    await cleanupExpiredAuthArtifacts(
      {
        session: {
          async deleteMany(args) {
            calls.push({
              expiresAt: args.where.expiresAt.lt,
              table: "session",
            });
            return { count: 1 };
          },
        },
        usedLogoutToken: {
          async deleteMany(args) {
            calls.push({
              expiresAt: args.where.expiresAt.lt,
              table: "usedLogoutToken",
            });
            return { count: 1 };
          },
        },
      },
      now,
    );

    expect(calls).toEqual([
      { expiresAt: now, table: "session" },
      { expiresAt: now, table: "usedLogoutToken" },
    ]);
  });
});
