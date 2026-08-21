-- ============================================================
-- T-A — Inventory warehouse stock dimension
-- Apply this file BEFORE `prisma db push`.
--
-- The repository intentionally has no Prisma migration history. This
-- migration is idempotent and backfills the existing branch-scoped rows
-- before the Prisma schema makes warehouse_id required.
-- ============================================================

BEGIN;

-- ---------- 1. Warehouse identity ----------
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'GOOD',
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'OUTLET';

ALTER TABLE warehouses
  ALTER COLUMN outlet_id DROP NOT NULL;

-- Existing warehouses are outlet-owned GOOD warehouses. Create a default
-- warehouse for every outlet that has no warehouse so existing stock rows
-- always have a valid warehouse destination.
INSERT INTO warehouses (id, code, name, is_active, type, scope, outlet_id)
SELECT
  md5('igd-orbit:warehouse-backfill:' || b.id)::uuid,
  b.code || '-GDG',
  b.name || ' – Gudang',
  true,
  'GOOD',
  'OUTLET',
  b.id
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w WHERE w.outlet_id = b.id
)
ON CONFLICT (code) DO NOTHING;

-- Create the one centralized system-scoped BAD warehouse when it does not
-- exist. The stable ID keeps this script safe to re-run.
INSERT INTO warehouses (id, code, name, is_active, type, scope, outlet_id)
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  'CENTRAL-BAD',
  'Central Bad Stock',
  true,
  'BAD',
  'SYSTEM',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses WHERE type = 'BAD' AND is_active = true
)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE warehouses
  DROP CONSTRAINT IF EXISTS warehouses_scope_type_check;
ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_scope_type_check CHECK (
    (scope = 'SYSTEM' AND type = 'BAD' AND outlet_id IS NULL)
    OR
    (scope = 'OUTLET' AND type = 'GOOD' AND outlet_id IS NOT NULL)
  );

DROP INDEX IF EXISTS warehouses_single_active_system_bad_key;
CREATE UNIQUE INDEX warehouses_single_active_system_bad_key
  ON warehouses (type)
  WHERE scope = 'SYSTEM' AND type = 'BAD' AND is_active = true;

CREATE INDEX IF NOT EXISTS warehouses_type_is_active_idx
  ON warehouses (type, is_active);
CREATE INDEX IF NOT EXISTS warehouses_scope_idx
  ON warehouses (scope);

-- ---------- 2. Product stock ----------
ALTER TABLE product_stock
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

-- Existing branch-level rows map to the first/default warehouse for that
-- outlet. created_at/id make the choice deterministic when an outlet has N
-- warehouses.
UPDATE product_stock ps
SET warehouse_id = w.id
FROM LATERAL (
  SELECT w0.id
  FROM warehouses w0
  WHERE w0.outlet_id = ps.branch_id
    AND w0.scope = 'OUTLET'
  ORDER BY w0.created_at ASC, w0.id ASC
  LIMIT 1
) w
WHERE ps.warehouse_id IS NULL;

ALTER TABLE product_stock
  ALTER COLUMN warehouse_id SET NOT NULL,
  ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE product_stock
  DROP CONSTRAINT IF EXISTS product_stock_product_id_branch_id_key,
  DROP CONSTRAINT IF EXISTS product_stock_branch_id_fkey;
DROP INDEX IF EXISTS product_stock_product_id_branch_id_key;

ALTER TABLE product_stock
  DROP CONSTRAINT IF EXISTS product_stock_warehouse_id_fkey;
ALTER TABLE product_stock
  ADD CONSTRAINT product_stock_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
ALTER TABLE product_stock
  ADD CONSTRAINT product_stock_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS product_stock_product_id_warehouse_id_key;
CREATE UNIQUE INDEX product_stock_product_id_warehouse_id_key
  ON product_stock (product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS product_stock_warehouse_id_idx
  ON product_stock (warehouse_id);

-- ---------- 3. Stock movements ----------
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

UPDATE stock_movements sm
SET warehouse_id = w.id
FROM LATERAL (
  SELECT w0.id
  FROM warehouses w0
  WHERE w0.outlet_id = sm.branch_id
    AND w0.scope = 'OUTLET'
  ORDER BY w0.created_at ASC, w0.id ASC
  LIMIT 1
) w
WHERE sm.warehouse_id IS NULL;

ALTER TABLE stock_movements
  ALTER COLUMN warehouse_id SET NOT NULL,
  ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_branch_id_fkey,
  DROP CONSTRAINT IF EXISTS stock_movements_warehouse_id_fkey;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stock_movements_warehouse_id_idx
  ON stock_movements (warehouse_id);

-- ---------- 4. Stock transfers ----------
ALTER TABLE stock_transfers
  ADD COLUMN IF NOT EXISTS from_warehouse_id TEXT,
  ADD COLUMN IF NOT EXISTS to_warehouse_id TEXT;

UPDATE stock_transfers st
SET from_warehouse_id = w.id
FROM LATERAL (
  SELECT w0.id
  FROM warehouses w0
  WHERE w0.outlet_id = st.from_branch_id
    AND w0.scope = 'OUTLET'
  ORDER BY w0.created_at ASC, w0.id ASC
  LIMIT 1
) w
WHERE st.from_warehouse_id IS NULL;

UPDATE stock_transfers st
SET to_warehouse_id = w.id
FROM LATERAL (
  SELECT w0.id
  FROM warehouses w0
  WHERE w0.outlet_id = st.to_branch_id
    AND w0.scope = 'OUTLET'
  ORDER BY w0.created_at ASC, w0.id ASC
  LIMIT 1
) w
WHERE st.to_warehouse_id IS NULL;

ALTER TABLE stock_transfers
  ALTER COLUMN from_warehouse_id SET NOT NULL,
  ALTER COLUMN to_warehouse_id SET NOT NULL,
  ALTER COLUMN from_branch_id DROP NOT NULL,
  ALTER COLUMN to_branch_id DROP NOT NULL;

ALTER TABLE stock_transfers
  DROP CONSTRAINT IF EXISTS stock_transfers_from_branch_id_fkey,
  DROP CONSTRAINT IF EXISTS stock_transfers_to_branch_id_fkey,
  DROP CONSTRAINT IF EXISTS stock_transfers_from_warehouse_id_fkey,
  DROP CONSTRAINT IF EXISTS stock_transfers_to_warehouse_id_fkey;
ALTER TABLE stock_transfers
  ADD CONSTRAINT stock_transfers_from_warehouse_id_fkey
  FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_transfers_to_warehouse_id_fkey
  FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_transfers_from_branch_id_fkey
  FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  ADD CONSTRAINT stock_transfers_to_branch_id_fkey
  FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stock_transfers_from_warehouse_id_idx
  ON stock_transfers (from_warehouse_id);
CREATE INDEX IF NOT EXISTS stock_transfers_to_warehouse_id_idx
  ON stock_transfers (to_warehouse_id);

-- ---------- 5. Stock opname ----------
ALTER TABLE stock_opname
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

UPDATE stock_opname so
SET warehouse_id = w.id
FROM LATERAL (
  SELECT w0.id
  FROM warehouses w0
  WHERE w0.outlet_id = so.branch_id
    AND w0.scope = 'OUTLET'
  ORDER BY w0.created_at ASC, w0.id ASC
  LIMIT 1
) w
WHERE so.warehouse_id IS NULL;

ALTER TABLE stock_opname
  ALTER COLUMN warehouse_id SET NOT NULL,
  ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE stock_opname
  DROP CONSTRAINT IF EXISTS stock_opname_branch_id_fkey,
  DROP CONSTRAINT IF EXISTS stock_opname_warehouse_id_fkey;
ALTER TABLE stock_opname
  ADD CONSTRAINT stock_opname_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_opname_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stock_opname_warehouse_id_idx
  ON stock_opname (warehouse_id);

COMMIT;
