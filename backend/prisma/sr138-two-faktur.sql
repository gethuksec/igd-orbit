-- IGDERP-138 : 2-Faktur cross-sell — POS No Service link + garansi per part
-- Idempotent; apply BEFORE `prisma db push` (db-push workflow)
-- Run as postgres superuser; table ownership stays with the app user.

ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS service_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_transactions_service_order_id
  ON sales_transactions(service_order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_transactions_service_order'
  ) THEN
    ALTER TABLE sales_transactions
      ADD CONSTRAINT fk_sales_transactions_service_order
      FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE service_parts_used ADD COLUMN IF NOT EXISTS warranty_days INTEGER;
