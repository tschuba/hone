type EquipmentPoolRecord = {
  id: string;
  name: string;
  tags: string[];
};

type EquipmentPoolStore = {
  equipmentPool: {
    count(args: { where: { userId: string } }): Promise<number>;
    create(args: {
      data: { name: string; tags: string[]; userId: string };
    }): Promise<EquipmentPoolRecord>;
    findFirst(args: {
      where: { id: string; userId: string };
    }): Promise<EquipmentPoolRecord | null>;
    findMany(args: {
      orderBy: { createdAt: "asc" | "desc" };
      where: { userId: string };
    }): Promise<EquipmentPoolRecord[]>;
    update(args: {
      data: { deletedAt?: Date; name?: string; tags?: string[] };
      where: { id: string };
    }): Promise<EquipmentPoolRecord>;
  };
};

export class EquipmentPoolService {
  constructor(private readonly store: EquipmentPoolStore) {}

  list(userId: string) {
    return this.store.equipmentPool.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  create(input: { name: string; tags: string[]; userId: string }) {
    return this.store.equipmentPool.create({
      data: input,
    });
  }

  async update(input: {
    name?: string;
    poolId: string;
    tags?: string[];
    userId: string;
  }) {
    const existingPool = await this.store.equipmentPool.findFirst({
      where: {
        id: input.poolId,
        userId: input.userId,
      },
    });

    if (!existingPool) {
      throw new Error("Equipment pool not found");
    }

    return this.store.equipmentPool.update({
      where: { id: existingPool.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      },
    });
  }

  async delete(input: { poolId: string; userId: string }) {
    const count = await this.store.equipmentPool.count({
      where: { userId: input.userId },
    });

    if (count <= 1) {
      throw new Error("Cannot delete the last equipment pool");
    }

    const existingPool = await this.store.equipmentPool.findFirst({
      where: {
        id: input.poolId,
        userId: input.userId,
      },
    });

    if (!existingPool) {
      throw new Error("Equipment pool not found");
    }

    return this.store.equipmentPool.update({
      where: { id: existingPool.id },
      data: { deletedAt: new Date() },
    });
  }
}
