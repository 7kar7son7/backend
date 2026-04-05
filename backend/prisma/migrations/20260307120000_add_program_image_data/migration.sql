-- Add program photo binary storage for serving from DB (no proxy/AKPA at request time)
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "imageData" BYTEA;
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "imageContentType" VARCHAR(64);
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "imageHasData" BOOLEAN NOT NULL DEFAULT false;
