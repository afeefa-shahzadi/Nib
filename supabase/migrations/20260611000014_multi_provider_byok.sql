-- Up
ALTER TABLE "public"."profiles" RENAME COLUMN "mistral_api_key" TO "byok_api_key";
ALTER TABLE "public"."profiles" ADD COLUMN "byok_provider" text DEFAULT 'mistral';
ALTER TABLE "public"."profiles" ADD COLUMN "byok_model" text;

-- Down
-- ALTER TABLE "public"."profiles" DROP COLUMN "byok_model";
-- ALTER TABLE "public"."profiles" DROP COLUMN "byok_provider";
-- ALTER TABLE "public"."profiles" RENAME COLUMN "byok_api_key" TO "mistral_api_key";
