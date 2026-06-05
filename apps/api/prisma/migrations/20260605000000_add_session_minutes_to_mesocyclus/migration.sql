-- AlterTable
ALTER TABLE "mesocycluses" ADD COLUMN "session_minutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "mesocycluses" ADD COLUMN "equipment_pool_id" TEXT;
