-- IGDERP-169: device type master table.
-- Idempotent: safe to run multiple times. Run as postgres before `prisma db push`,
-- then GRANTs (hand-created tables are invisible to the app role otherwise).
CREATE TABLE IF NOT EXISTS device_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_types_active_sort_idx ON device_types (is_active, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON device_types TO developer;
