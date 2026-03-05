-- Remove logoData/logoContentType if they exist (revert add_channel_logo_data)
ALTER TABLE "channels" DROP COLUMN IF EXISTS "logoData";
ALTER TABLE "channels" DROP COLUMN IF EXISTS "logoContentType";
