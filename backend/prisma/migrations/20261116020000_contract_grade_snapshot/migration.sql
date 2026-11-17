-- IGDERP-270 round 2: grade snapshot on contracts (nullable rung G1-G6, staff or otherwise)
-- NOTE: grades.id is TEXT (uuid() default without @db.Uuid), so grade_id must be TEXT.
-- The first ship of this migration used UUID and failed on the FK; the block
-- below also repairs a UUID-typed remnant if the failed attempt left one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'grade_id'
  ) THEN
    ALTER TABLE "contracts" ALTER COLUMN "grade_id" TYPE TEXT USING "grade_id"::text;
  ELSE
    ALTER TABLE "contracts" ADD COLUMN "grade_id" TEXT;
  END IF;
END $$;

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
