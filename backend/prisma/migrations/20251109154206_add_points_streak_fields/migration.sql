-- AlterEnum
ALTER TYPE "PointReason" ADD VALUE 'DOUBLE_CONFIRM';

-- AlterTable
ALTER TABLE "point_balance" ADD COLUMN     "lastActive" TIMESTAMP(3),
ADD COLUMN     "streakLength" INTEGER NOT NULL DEFAULT 0;
