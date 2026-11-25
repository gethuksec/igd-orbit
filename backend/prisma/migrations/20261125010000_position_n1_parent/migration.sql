-- N+1 vertical chain on job titles (Position.parentPositionId) + grade for every title.
-- Idempotent: safe to re-run after a failed attempt.

ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "parent_position_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'positions_parent_position_id_fkey'
  ) THEN
    ALTER TABLE "positions"
      ADD CONSTRAINT "positions_parent_position_id_fkey"
      FOREIGN KEY ("parent_position_id") REFERENCES "positions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "positions_parent_position_id_idx"
  ON "positions"("parent_position_id");
