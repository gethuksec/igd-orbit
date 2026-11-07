-- IGDERP-235 (OP3): movement capture for OPEN sessions. Idempotent house style.
CREATE TABLE IF NOT EXISTS "opname_movements" (
  "id" TEXT NOT NULL,
  "opname_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "movement_type" TEXT NOT NULL,
  "quantity_change" DECIMAL(15,3) NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opname_movements_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_movements_opname_id_fkey'
  ) THEN
    ALTER TABLE "opname_movements" ADD CONSTRAINT "opname_movements_opname_id_fkey"
      FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opname_movements_product_id_fkey'
  ) THEN
    ALTER TABLE "opname_movements" ADD CONSTRAINT "opname_movements_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "opname_movements_opname_id_product_id_idx" ON "opname_movements"("opname_id", "product_id");
CREATE INDEX IF NOT EXISTS "opname_movements_created_at_idx" ON "opname_movements"("created_at");
