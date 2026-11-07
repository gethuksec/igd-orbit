-- IGDERP-233 (OP1, backfill) + IGDERP-234 (OP2, blind count). Idempotent house style.
-- OP1 shipped schema.prisma without a migration; this covers its columns too.

-- OP1: type / join code / approver on stock_opname
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "opname_type" TEXT DEFAULT 'FREEZE';
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "approver_id" TEXT;
UPDATE "stock_opname" SET "opname_type" = 'FREEZE' WHERE "opname_type" IS NULL;
-- Backfill join codes for pre-OP1 rows (new rows always get a code at creation)
UPDATE "stock_opname"
SET "code" = 'OPN-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 5))
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
CREATE INDEX IF NOT EXISTS "stock_opname_code_idx" ON "stock_opname"("code");

-- OP2: per-user category assignments (addable mid-session)
CREATE TABLE IF NOT EXISTS "opname_assignments" (
  "id" TEXT NOT NULL,
  "opname_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_assignments_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_assignments_opname_id_fkey'
  ) THEN
    ALTER TABLE "opname_assignments" ADD CONSTRAINT "opname_assignments_opname_id_fkey"
      FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_assignments_category_id_fkey'
  ) THEN
    ALTER TABLE "opname_assignments" ADD CONSTRAINT "opname_assignments_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_assignments_opname_id_user_id_category_id_key'
  ) THEN
    ALTER TABLE "opname_assignments" ADD CONSTRAINT "opname_assignments_opname_id_user_id_category_id_key"
      UNIQUE ("opname_id", "user_id", "category_id");
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "opname_assignments_opname_id_idx" ON "opname_assignments"("opname_id");
CREATE INDEX IF NOT EXISTS "opname_assignments_user_id_idx" ON "opname_assignments"("user_id");

-- OP2: append-only scan log (one row per count save per product, revisioned)
CREATE TABLE IF NOT EXISTS "opname_scans" (
  "id" TEXT NOT NULL,
  "opname_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "good_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "damaged_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "expired_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "scanned_by" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_scans_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_scans_opname_id_fkey'
  ) THEN
    ALTER TABLE "opname_scans" ADD CONSTRAINT "opname_scans_opname_id_fkey"
      FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_scans_product_id_fkey'
  ) THEN
    ALTER TABLE "opname_scans" ADD CONSTRAINT "opname_scans_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "opname_scans_opname_id_product_id_idx" ON "opname_scans"("opname_id", "product_id");
CREATE INDEX IF NOT EXISTS "opname_scans_scanned_by_idx" ON "opname_scans"("scanned_by");

-- OP2: unknown-barcode exception log (never creates a count line)
CREATE TABLE IF NOT EXISTS "opname_exceptions" (
  "id" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "opname_id" TEXT NOT NULL,
  "scanned_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_exceptions_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_exceptions_opname_id_fkey'
  ) THEN
    ALTER TABLE "opname_exceptions" ADD CONSTRAINT "opname_exceptions_opname_id_fkey"
      FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "opname_exceptions_opname_id_idx" ON "opname_exceptions"("opname_id");
