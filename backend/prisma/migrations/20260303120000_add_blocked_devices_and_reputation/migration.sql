-- CreateEnum
CREATE TYPE "BlockedDeviceStatus" AS ENUM ('FLAGGED', 'BLOCKED');

-- CreateTable
CREATE TABLE "blocked_devices" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "BlockedDeviceStatus" NOT NULL DEFAULT 'FLAGGED',
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blocked_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_reputation" (
    "deviceId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "device_reputation_pkey" PRIMARY KEY ("deviceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_devices_deviceId_key" ON "blocked_devices"("deviceId");

-- CreateIndex
CREATE INDEX "blocked_devices_deviceId_status_idx" ON "blocked_devices"("deviceId", "status");
