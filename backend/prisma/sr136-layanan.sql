-- IGDERP-136 : Daftar Layanan multi-select per service order (POS-like rows)
-- Idempotent; apply BEFORE `prisma db push` (db-push workflow)
CREATE TABLE IF NOT EXISTS service_order_layanans (
  id             TEXT PRIMARY KEY,
  service_order_id TEXT NOT NULL,
  service_type_id  TEXT,
  name           TEXT NOT NULL,
  sla_hours      NUMERIC(5,2) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(15,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sol_service_order ON service_order_layanans(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sol_service_type ON service_order_layanans(service_type_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_order_layanans_service_order_id_fkey') THEN
    ALTER TABLE service_order_layanans
      ADD CONSTRAINT service_order_layanans_service_order_id_fkey
      FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_order_layanans_service_type_id_fkey') THEN
    ALTER TABLE service_order_layanans
      ADD CONSTRAINT service_order_layanans_service_type_id_fkey
      FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL;
  END IF;
END $$;
