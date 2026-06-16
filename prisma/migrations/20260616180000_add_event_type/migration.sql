-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('AD_BREAK_END', 'AD_BREAK_START');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "eventType" "EventType" NOT NULL DEFAULT 'AD_BREAK_END';

-- CreateIndex
CREATE INDEX "events_programId_status_eventType_idx" ON "events"("programId", "status", "eventType");
