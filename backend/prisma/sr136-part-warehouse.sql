-- IGDERP-136 round 2: cross-gudang cross-selling — source warehouse per service part.
-- Follows the sr*.sql convention (hand-applied via psql on igd-vm).
-- NOTE: warehouses.id is TEXT (not uuid) — keep the FK type in sync.
ALTER TABLE service_parts_used
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT NULL REFERENCES warehouses(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_service_parts_used_warehouse
  ON service_parts_used (warehouse_id);
