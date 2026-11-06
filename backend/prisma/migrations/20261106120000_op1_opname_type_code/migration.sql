-- IGDERP-233 (OP1): new opname mechanism — FREEZE/OPEN type, short join code, assigned approver.
-- Backfills unique codes for pre-OP1 rows so the NOT NULL + UNIQUE constraint applies cleanly.
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "opname_type" TEXT NOT NULL DEFAULT 'FREEZE';
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "approver_id" TEXT;
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "code" TEXT;
-- Backfill: OPN- + 8 upper alphanumerics from the row id (uuids → unique).
UPDATE "stock_opname"
SET "code" = 'OPN-' || UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8))
WHERE "code" IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_opname_code_key'
  ) THEN
    ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_code_key" UNIQUE ("code");
  END IF;
END
$$;
ALTER TABLE "stock_opname" ALTER COLUMN "code" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "stock_opname_code_idx" ON "stock_opname"("code");
