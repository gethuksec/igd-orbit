-- S5 (fc7b9d65): label/barcode printing — settings profile + print queue.
-- Idempotent: safe to re-run against an existing database.

CREATE TABLE IF NOT EXISTS "label_settings" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "auto_print" BOOLEAN NOT NULL DEFAULT false,
  "label_width_mm" DECIMAL(6,1) NOT NULL DEFAULT 40,
  "label_height_mm" DECIMAL(6,1) NOT NULL DEFAULT 30,
  "columns" INTEGER NOT NULL DEFAULT 3,
  "symbology" TEXT NOT NULL DEFAULT 'BARCODE',
  "paper_type" TEXT NOT NULL DEFAULT 'THERMAL',
  "show_printed_name" BOOLEAN NOT NULL DEFAULT true,
  "show_price" BOOLEAN NOT NULL DEFAULT true,
  "show_sku" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "label_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "label_print_jobs" (
  "id" TEXT NOT NULL,
  "job_number" TEXT NOT NULL,
  "goods_receipt_id" TEXT,
  "product_id" TEXT NOT NULL,
  "copies" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "printed_at" TIMESTAMP(3),
  "printed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "label_print_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "label_print_jobs_job_number_key" ON "label_print_jobs"("job_number");
CREATE INDEX IF NOT EXISTS "idx_label_print_jobs_status" ON "label_print_jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_label_print_jobs_gr" ON "label_print_jobs"("goods_receipt_id");
CREATE INDEX IF NOT EXISTS "idx_label_print_jobs_created_at" ON "label_print_jobs"("created_at");

DO $$ BEGIN
  ALTER TABLE "label_settings" ADD CONSTRAINT "label_settings_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "label_print_jobs" ADD CONSTRAINT "label_print_jobs_goods_receipt_id_fkey"
    FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "label_print_jobs" ADD CONSTRAINT "label_print_jobs_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "label_print_jobs" ADD CONSTRAINT "label_print_jobs_printed_by_fkey"
    FOREIGN KEY ("printed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
