ALTER TABLE "public"."tips"
ADD COLUMN "net_paise" bigint;

UPDATE "public"."tips"
SET "net_paise" = "amount_paise"
WHERE "net_paise" IS NULL;

ALTER TABLE "public"."tips"
ALTER COLUMN "net_paise" SET NOT NULL;
