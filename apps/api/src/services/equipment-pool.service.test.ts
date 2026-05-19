import { beforeEach, describe, expect, it, mock } from "bun:test";

import { EquipmentPoolService } from "./equipment-pool.service";

describe("EquipmentPoolService", () => {
  const count = mock();
  const create = mock();
  const findFirst = mock();
  const findMany = mock();
  const update = mock();

  const store = {
    equipmentPool: {
      count,
      create,
      findFirst,
      findMany,
      update,
    },
  };

  beforeEach(() => {
    count.mockReset();
    create.mockReset();
    findFirst.mockReset();
    findMany.mockReset();
    update.mockReset();
  });

  it("prevents deleting the last equipment pool", async () => {
    const service = new EquipmentPoolService(store);
    count.mockResolvedValueOnce(1);

    await expect(
      service.delete({ poolId: "only-pool-id", userId: "u1" }),
    ).rejects.toThrow("Cannot delete the last equipment pool");
  });
});
