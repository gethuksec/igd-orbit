-- IGDERP-271: working locations become multi-select per contract (rule A ANY-match).
-- New join table contract_working_locations; existing single assignments are
-- backfilled, then contracts.working_location_id is dropped.

CREATE TABLE IF NOT EXISTS "contract_working_locations" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "working_location_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_working_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_working_locations_contract_id_working_location_id_key"
  ON "contract_working_locations"("contract_id", "working_location_id");
CREATE INDEX IF NOT EXISTS "contract_working_locations_contract_id_idx"
  ON "contract_working_locations"("contract_id");
CREATE INDEX IF NOT EXISTS "contract_working_locations_working_location_id_idx"
  ON "contract_working_locations"("working_location_id");

-- Backfill: one join row per existing single assignment.
INSERT INTO "contract_working_locations" ("id", "contract_id", "working_location_id", "created_at")
SELECT gen_random_uuid()::text, "id", "working_location_id", CURRENT_TIMESTAMP
FROM "contracts"
WHERE "working_location_id" IS NOT NULL
ON CONFLICT ("contract_id", "working_location_id") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_working_locations_contract_id_fkey'
  ) THEN
    ALTER TABLE "contract_working_locations"
      ADD CONSTRAINT "contract_working_locations_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_working_locations_working_location_id_fkey'
  ) THEN
    ALTER TABLE "contract_working_locations"
      ADD CONSTRAINT "contract_working_locations_working_location_id_fkey"
      FOREIGN KEY ("working_location_id") REFERENCES "working_locations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Drop the legacy single column (backfilled above).
ALTER TABLE "contracts" DROP CONSTRAINT IF EXISTS "contracts_working_location_id_fkey";
ALTER TABLE "contracts" DROP COLUMN IF EXISTS "working_location_id";
