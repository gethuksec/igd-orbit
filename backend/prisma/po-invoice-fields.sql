-- IGDERP-79 / a4353fe9 : PO supplier-invoice fields + auto due date (8 Sep decisions)
-- Idempotent; apply BEFORE `prisma db push` (db-push workflow)
-- Run as postgres superuser; table ownership stays with the app user.

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMP(3);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_invoice_number
  ON purchase_orders(invoice_number);
