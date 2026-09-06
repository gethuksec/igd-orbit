-- ============================================================
-- IGDERP-159 — Central Good Stock warehouse (SYSTEM/GOOD)
-- Apply this file BEFORE the app serves the new code (db-push workflow:
-- hand-SQL first; schema.prisma needs NO structural change — only the
-- CHECK constraint + unique index below change).
--
-- Per 27 Aug §9 (decision 2026-09-06): all PO stock lands in the
-- system-wide `central-good` warehouse; `central-bad` holds all returns.
-- Idempotent — safe to re-run.
-- ============================================================

BEGIN;

-- ---------- 1. Relax the scope/type CHECK first (allow SYSTEM/GOOD) ----------
ALTER TABLE warehouses
  DROP CONSTRAINT IF EXISTS warehouses_scope_type_check;
ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_scope_type_check CHECK (
    (scope = 'SYSTEM' AND type IN ('GOOD', 'BAD') AND outlet_id IS NULL)
    OR
    (scope = 'OUTLET' AND type = 'GOOD' AND outlet_id IS NOT NULL)
  );

-- ---------- 2. Create central-good (stable ID reuses the central-bad scheme) ----------
INSERT INTO warehouses (id, code, name, is_active, type, scope, outlet_id, updated_at)
SELECT
  '00000000-0000-4000-8000-000000000002'::uuid,
  'CENTRAL-GOOD',
  'Central Good Stock',
  true,
  'GOOD',
  'SYSTEM',
  NULL,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses WHERE type = 'GOOD' AND scope = 'SYSTEM' AND is_active = true
)
ON CONFLICT (code) DO NOTHING;

-- ---------- 3. One active system warehouse per type (GOOD + BAD max) ----------
DROP INDEX IF EXISTS warehouses_single_active_system_bad_key;
DROP INDEX IF EXISTS warehouses_single_active_system_type_key;
CREATE UNIQUE INDEX warehouses_single_active_system_type_key
  ON warehouses (type)
  WHERE scope = 'SYSTEM' AND is_active = true;

COMMIT;

-- Verify:
--   SELECT code, name, type, scope, outlet_id FROM warehouses WHERE scope = 'SYSTEM';
--   → CENTRAL-GOOD (GOOD/SYSTEM, NULL) + CENTRAL-BAD (BAD/SYSTEM, NULL)
