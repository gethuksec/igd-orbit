-- IGDERP-270 round 2: grade snapshot on contracts (nullable rung G1-G6, staff or otherwise)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "grade_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_grade_id_fkey'
  ) THEN
    ALTER TABLE "contracts"
      ADD CONSTRAINT "contracts_grade_id_fkey"
      FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "contracts_grade_id_idx" ON "contracts"("grade_id");
