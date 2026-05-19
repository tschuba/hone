import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { db } from "../db/client";
import type { AuthVariables } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";
import { EquipmentPoolService } from "../services/equipment-pool.service";

type EquipmentPoolRecord = {
  id: string;
  name: string;
  tags: string[];
};

type EquipmentRouteService = Pick<
  EquipmentPoolService,
  "create" | "list" | "update"
> & {
  delete(input: { poolId: string; userId: string }): Promise<unknown>;
};

type EquipmentRouteOptions = {
  authGuard?: MiddlewareHandler;
  service?: EquipmentRouteService;
};

export function createEquipmentRoutes(options: EquipmentRouteOptions = {}) {
  const equipmentRoutes = new Hono<{ Variables: AuthVariables }>();
  const authGuard = options.authGuard ?? authMiddleware;
  const service =
    options.service ??
    new EquipmentPoolService({
      equipmentPool: db.equipmentPool,
    });

  equipmentRoutes.use("*", authGuard);

  equipmentRoutes.get("/", async (c) => {
    const items = await service.list(c.get("userId"));
    return c.json({ items }, 200);
  });

  equipmentRoutes.post("/", async (c) => {
    const body = await c.req.json<{ name?: string; tags?: string[] }>();

    if (!body.name || !Array.isArray(body.tags) || body.tags.length === 0) {
      return c.json(
        {
          status: 400,
          title: "Name and at least one equipment tag are required",
        },
        400,
      );
    }

    const pool = await service.create({
      name: body.name,
      tags: body.tags,
      userId: c.get("userId"),
    });

    return c.json(pool, 201);
  });

  equipmentRoutes.put("/:poolId", async (c) => {
    const body = await c.req.json<{ name?: string; tags?: string[] }>();

    try {
      const pool = await service.update({
        name: body.name,
        poolId: c.req.param("poolId"),
        tags: body.tags,
        userId: c.get("userId"),
      });

      return c.json(pool, 200);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Equipment pool not found"
      ) {
        return c.json({ status: 404, title: error.message }, 404);
      }

      return c.json(
        { status: 400, title: "Unable to update equipment pool" },
        400,
      );
    }
  });

  equipmentRoutes.delete("/:poolId", async (c) => {
    try {
      await service.delete({
        poolId: c.req.param("poolId"),
        userId: c.get("userId"),
      });

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Cannot delete the last equipment pool") {
          return c.json({ status: 409, title: error.message }, 409);
        }

        if (error.message === "Equipment pool not found") {
          return c.json({ status: 404, title: error.message }, 404);
        }
      }

      return c.json(
        { status: 400, title: "Unable to delete equipment pool" },
        400,
      );
    }
  });

  return equipmentRoutes;
}
