-- IGDERP-84 (S4): purchase returns (Retur Pembelian) — models + the IGDERP-83
-- receiving checkbox flag. Idempotent; apply BEFORE the rebuild.
-- Run as postgres superuser; table ownership stays with the app user.

CREATE TABLE IF NOT EXISTS "purchase_returns" (
  "id" TEXT NOT NULL,
  "return_number" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "invoice_number" TEXT,
  "processed_by" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "total_qty" DECIMAL(15,3) NOT NULL,
  "total_value" DECIMAL(15,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_returns_return_number_key"
  ON "purchase_returns"("return_number");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_po" ON "purchase_returns"("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_supplier" ON "purchase_returns"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_processed_by" ON "purchase_returns"("processed_by");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_created_at" ON "purchase_returns"("created_at");

CREATE TABLE IF NOT EXISTS "purchase_return_items" (
  "id" TEXT NOT NULL,
  "purchase_return_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" DECIMAL(15,3) NOT NULL,
  "unit_price" DECIMAL(15,2) NOT NULL,
  "subtotal" DECIMAL(15,2) NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_purchase_return_items_return" ON "purchase_return_items"("purchase_return_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_return_items_product" ON "purchase_return_items"("product_id");

DO $$ BEGIN
  ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_processed_by_fkey"
    FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_return_id_fkey"
    FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- IGDERP-83: "buat retur" flag on receiving lines
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "create_return" BOOLEAN NOT NULL DEFAULT false;
