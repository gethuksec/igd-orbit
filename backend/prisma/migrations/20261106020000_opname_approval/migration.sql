-- IGDERP-236 (OP4): approval log, correction history, approver setting, soft delete. Idempotent house style.
CREATE TABLE IF NOT EXISTS "opname_approvals" (
  "id" TEXT NOT NULL,
  "opname_id" TEXT NOT NULL,
  "approver_id" TEXT NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'APPROVED',
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_approvals_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_approvals_opname_id_fkey'
  ) THEN
    ALTER TABLE "opname_approvals" ADD CONSTRAINT "opname_approvals_opname_id_fkey"
      FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "opname_approvals_opname_id_idx" ON "opname_approvals"("opname_id");

CREATE TABLE IF NOT EXISTS "opname_corrections" (
  "id" TEXT NOT NULL,
  "opname_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "condition" TEXT,
  "old_quantity" DECIMAL(15,3),
  "new_quantity" DECIMAL(15,3) NOT NULL,
  "reason" TEXT NOT NULL,
  "corrected_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_corrections_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_corrections_opname_id_fkey'
  ) THEN
    ALTER TABLE "opname_corrections" ADD CONSTRAINT "opname_corrections_opname_id_fkey"
      FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_corrections_product_id_fkey'
  ) THEN
    ALTER TABLE "opname_corrections" ADD CONSTRAINT "opname_corrections_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "opname_corrections_opname_id_product_id_idx" ON "opname_corrections"("opname_id", "product_id");

CREATE TABLE IF NOT EXISTS "opname_approver_settings" (
  "id" TEXT NOT NULL,
  "outlet_id" TEXT,
  "role" TEXT,
  "user_id" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_approver_settings_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_approver_settings_outlet_id_key'
  ) THEN
    ALTER TABLE "opname_approver_settings" ADD CONSTRAINT "opname_approver_settings_outlet_id_key"
      UNIQUE ("outlet_id");
  END IF;
END
$$;

-- No hard delete on opname rows: soft-delete flag (counted rows are never removed)
ALTER TABLE "stock_opname_items" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "stock_opname_items_deleted_at_idx" ON "stock_opname_items"("deleted_at");
