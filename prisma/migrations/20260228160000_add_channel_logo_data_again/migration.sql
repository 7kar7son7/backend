-- Add logo binary storage for serving from DB (no AKPA at request time)
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "logoData" BYTEA;
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "logoContentType" VARCHAR(64);
