-- CreateEnum
CREATE TYPE "FollowType" AS ENUM ('CHANNEL', 'PROGRAM');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'VALIDATED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventChoice" AS ENUM ('OPTION1', 'OPTION2');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('PUSH', 'LOCAL_FALLBACK');

-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('FAST_CONFIRM', 'REMINDER_CONFIRM', 'DAILY_STREAK', 'STREAK_BONUS', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "category" TEXT,
    "countryCode" VARCHAR(8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followed_items" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "type" "FollowType" NOT NULL,
    "channelId" UUID,
    "programId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "initiatorDeviceId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "followerCountLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_confirmations" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "choice" "EventChoice" NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delaySeconds" INTEGER,
    "reminderUsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "event_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_log" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutedNight" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_balance" (
    "deviceId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_balance_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "point_entries" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" "PointReason" NOT NULL,
    "eventId" UUID,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventFollowers" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EventFollowers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_externalId_key" ON "channels"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "programs_externalId_key" ON "programs"("externalId");

-- CreateIndex
CREATE INDEX "programs_channelId_startsAt_idx" ON "programs"("channelId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "follow_device_channel_unique" ON "followed_items"("deviceId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "follow_device_program_unique" ON "followed_items"("deviceId", "programId");

-- CreateIndex
CREATE INDEX "events_programId_status_idx" ON "events"("programId", "status");

-- CreateIndex
CREATE INDEX "event_confirmations_deviceId_confirmedAt_idx" ON "event_confirmations"("deviceId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_device_unique" ON "event_confirmations"("eventId", "deviceId");

-- CreateIndex
CREATE INDEX "reminder_log_deviceId_sentAt_idx" ON "reminder_log"("deviceId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_unique_attempt" ON "reminder_log"("eventId", "deviceId", "attempt");

-- CreateIndex
CREATE INDEX "point_entries_deviceId_createdAt_idx" ON "point_entries"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "_EventFollowers_B_index" ON "_EventFollowers"("B");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_items" ADD CONSTRAINT "followed_items_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_items" ADD CONSTRAINT "followed_items_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_confirmations" ADD CONSTRAINT "event_confirmations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "point_balance"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventFollowers" ADD CONSTRAINT "_EventFollowers_A_fkey" FOREIGN KEY ("A") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventFollowers" ADD CONSTRAINT "_EventFollowers_B_fkey" FOREIGN KEY ("B") REFERENCES "followed_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
