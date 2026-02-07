-- CreateEnum
CREATE TYPE "NotificationSensitivity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "device_tokens" ADD COLUMN "notificationSensitivity" "NotificationSensitivity" DEFAULT 'MEDIUM';

