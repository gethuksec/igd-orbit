-- IGDERP-133 + IGDERP-135 : Smart Repair status lifecycle + SLA decimal
-- Idempotent; apply BEFORE `prisma db push` (db-push workflow, see references/db-access-and-workstream-d.md)
-- Run as the app DB user (developer) so table ownership matches the app:
--   docker compose exec -T postgres psql -U developer -d igd_orbit_db -v ON_ERROR_STOP=1 < sr-status-lifecycle.sql

-- 133: ready_at (Ready = selesai dikerjakan, siap diambil)
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP(3);

-- 135: sla_hours integer -> numeric(5,2) (allow 0.5 = 30 menit)
ALTER TABLE service_types ALTER COLUMN sla_hours TYPE NUMERIC(5,2);
