-- IGDERP-185: lock-type discriminator for customer phone lock credentials.
-- Idempotent: safe to run multiple times. Run as postgres before `prisma db push`.
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS device_lock_type TEXT NOT NULL DEFAULT 'none';
