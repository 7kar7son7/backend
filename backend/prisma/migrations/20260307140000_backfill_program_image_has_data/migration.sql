-- Ustaw imageHasData = true dla wszystkich programów, które już mają imageData w bazie
UPDATE "programs"
SET "imageHasData" = true
WHERE "imageData" IS NOT NULL AND "imageHasData" = false;
