import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import type { AuthVariables } from "../middleware/auth";
import { createEquipmentRoutes } from "./equipment.routes";

function createTestApp(service: {
  create(input: { name: string; tags: string[]; userId: string }): Promise<{
    id: string;
    name: string;
    tags: string[];
  }>;
  delete(input: { poolId: string; userId: string }): Promise<unknown>;
  list(
    userId: string,
  ): Promise<Array<{ id: string; name: string; tags: string[] }>>;
  update(input: {
    name?: string;
    poolId: string;
    tags?: string[];
    userId: string;
  }): Promise<{ id: string; name: string; tags: string[] }>;
}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.route(
    "/api/v1/equipment-pools",
    createEquipmentRoutes({
      authGuard: async (c, next) => {
        c.set("sessionId", "session-1");
        c.set("userId", "user-1");
        await next();
      },
      service,
    }),
  );

  return app;
}

describe("equipment routes", () => {
  it("lists equipment pools", async () => {
    const app = createTestApp({
      async create() {
        return { id: "pool-1", name: "Home", tags: ["dumbbell"] };
      },
      async delete() {
        return;
      },
      async list() {
        return [{ id: "pool-1", name: "Home", tags: ["dumbbell"] }];
      },
      async update() {
        return { id: "pool-1", name: "Home", tags: ["dumbbell"] };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/equipment-pools",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: "pool-1", name: "Home", tags: ["dumbbell"] }],
    });
  });

  it("creates equipment pools", async () => {
    let createdInput:
      | { name: string; tags: string[]; userId: string }
      | undefined;

    const app = createTestApp({
      async create(input) {
        createdInput = input;
        return { id: "pool-1", name: input.name, tags: input.tags };
      },
      async delete() {
        return;
      },
      async list() {
        return [];
      },
      async update() {
        return { id: "pool-1", name: "Home", tags: ["dumbbell"] };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/equipment-pools",
      {
        body: JSON.stringify({ name: "Home", tags: ["dumbbell", "mat"] }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(response.status).toBe(201);
    expect(createdInput).toEqual({
      name: "Home",
      tags: ["dumbbell", "mat"],
      userId: "user-1",
    });
  });

  it("returns 409 when deleting the last equipment pool", async () => {
    const app = createTestApp({
      async create() {
        return { id: "pool-1", name: "Home", tags: ["dumbbell"] };
      },
      async delete() {
        throw new Error("Cannot delete the last equipment pool");
      },
      async list() {
        return [];
      },
      async update() {
        return { id: "pool-1", name: "Home", tags: ["dumbbell"] };
      },
    });

    const response = await app.request(
      "http://hone.test/api/v1/equipment-pools/pool-1",
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(409);
  });
});
