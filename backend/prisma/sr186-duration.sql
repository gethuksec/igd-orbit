-- IGDERP-186: auto duration per service type (nullable hours, step 0.5).
-- Idempotent: safe to run multiple times. Run as postgres before `prisma db push`.
ALTER TABLE service_types ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,2);
