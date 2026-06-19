-- Güvenli: canlı DB'de tekrar çalıştırılabilir
DO $$ BEGIN
    CREATE TYPE "PlanType" AS ENUM ('TRIP', 'CITY_DAY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "planType" "PlanType" NOT NULL DEFAULT 'TRIP';
