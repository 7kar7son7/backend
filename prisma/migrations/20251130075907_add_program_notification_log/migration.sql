-- CreateEnum
CREATE TYPE "ProgramReminderType" AS ENUM ('FIFTEEN_MIN', 'FIVE_MIN', 'STARTED');

-- CreateTable
CREATE TABLE "program_notification_log" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "reminderType" "ProgramReminderType" NOT NULL,
    "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_notification_log_programId_sentAt_idx" ON "program_notification_log"("programId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "program_reminder_unique" ON "program_notification_log"("programId", "reminderType");

-- AddForeignKey
ALTER TABLE "program_notification_log" ADD CONSTRAINT "program_notification_log_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
