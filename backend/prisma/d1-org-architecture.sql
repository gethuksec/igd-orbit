-- ============================================================
-- D1 — Organization Architecture: schema + data migration
-- IGDERP #48 / WS-D. Applied BEFORE prisma db push (project has
-- no migration history — db push workflow).
--
-- Backup taken: /home/developer/backups/d1_pre_migration_20260805.dump
-- Mapping approved by user 2026-08-06.
--
-- A. Warehouse split   : BR-001 (is_warehouse=t) → Warehouse 'Gudang Pusat',
--                        outletId=BR-001, SAME id as BR-001 so the existing
--                        sales_transactions.warehouse_id resolves untouched.
-- B. UserBranch backfill: NULL branch_id rows → first branch (created_at ASC,
--                        code ASC = BR-001); cs@ duplicate (D-PERM deny artifact)
--                        merged (deniedPermissions + isPrimary folded, newer row deleted).
-- C. Junction port     : role_permissions wildcard keys (module.*.action) appended
--                        to each role.default_permissions (dedupe), THEN legacy
--                        tables permissions / role_permissions / role_menu_access DROPPED.
-- D. UserRole→UserBranch: rename, branch_id NOT NULL, drop valid_from/valid_until,
--                        unique (user_id, branch_id, role_id).
-- E. Branch outlet-only : drop type + is_warehouse; add group/director/
--                        contact_person/mobile_phone.
-- F. FK wiring          : sales_transactions.warehouse_id + service_orders.warehouse_id
--                        → warehouses(id) ON DELETE SET NULL.
-- ============================================================

BEGIN;

-- ---------- A. Warehouse split ----------
CREATE TABLE IF NOT EXISTS warehouses (
    id             TEXT PRIMARY KEY,
    code           TEXT NOT NULL,
    name           TEXT NOT NULL,
    city           TEXT,
    address        TEXT,
    phone          TEXT,
    email          TEXT,
    contact_person TEXT,
    mobile_phone   TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    outlet_id      TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_code_key ON warehouses(code);
CREATE INDEX IF NOT EXISTS warehouses_outlet_id_idx ON warehouses(outlet_id);
CREATE INDEX IF NOT EXISTS warehouses_is_active_idx ON warehouses(is_active);
ALTER TABLE warehouses ADD CONSTRAINT warehouses_outlet_id_fkey
    FOREIGN KEY (outlet_id) REFERENCES branches(id) ON DELETE RESTRICT;

-- Gudang Pusat — same id as BR-001 (legacy warehouse_id refs keep resolving)
INSERT INTO warehouses (id, code, name, city, address, phone, email, contact_person, mobile_phone, is_active, outlet_id)
SELECT id, 'GUDANG-001', 'Gudang Pusat', city, address, phone, email, NULL, NULL, true, id
FROM branches WHERE code = 'BR-001'
ON CONFLICT (id) DO NOTHING;

-- ---------- B. UserBranch backfill (NULL branch_id → first branch) ----------
-- Drop the old unique index first: PG treats NULLs as distinct, so a
-- (user, role, NULL) row can coexist with (user, role, BR-001) today;
-- backfilling would violate it. Recreated in section D.
DROP INDEX IF EXISTS user_roles_user_id_role_id_branch_id_key;

-- Decision #32: first-in-list (created_at ASC, tie-break code ASC) = BR-001
UPDATE user_roles
SET branch_id = (SELECT id FROM branches ORDER BY created_at ASC, code ASC LIMIT 1)
WHERE branch_id IS NULL;

-- Merge duplicates (user, role, branch): keep oldest row, fold deniedPermissions + isPrimary, delete newer rows
UPDATE user_roles ur
SET denied_permissions = COALESCE((
        SELECT ARRAY(SELECT DISTINCT d FROM user_roles ur2, unnest(ur2.denied_permissions) d
                     WHERE ur2.user_id = ur.user_id AND ur2.role_id = ur.role_id AND ur2.branch_id = ur.branch_id)
    ), '{}'::text[]),
    is_primary = ur.is_primary OR EXISTS (
        SELECT 1 FROM user_roles ur2
        WHERE ur2.user_id = ur.user_id AND ur2.role_id = ur.role_id AND ur2.branch_id = ur.branch_id AND ur2.is_primary
    )
FROM (SELECT user_id, role_id, branch_id, (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS keep_id FROM user_roles
      GROUP BY user_id, role_id, branch_id HAVING count(*) > 1) dups
WHERE ur.id = dups.keep_id;

DELETE FROM user_roles ur
USING (SELECT user_id, role_id, branch_id, (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS keep_id FROM user_roles
       GROUP BY user_id, role_id, branch_id HAVING count(*) > 1) dups
WHERE ur.user_id = dups.user_id AND ur.role_id = dups.role_id AND ur.branch_id = dups.branch_id AND ur.id <> dups.keep_id;

-- ---------- C. Junction → defaultPermissions port, then drop legacy tables ----------
UPDATE roles r
SET default_permissions = (
    SELECT ARRAY(
        SELECT DISTINCT k FROM unnest(
            COALESCE((
                SELECT array_agg(p.module || '.' || COALESCE(p.submodule, '*') || '.' || p.action)
                FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = r.id
            ), '{}'::text[])
            || r.default_permissions
        ) k
    )
);

DROP TABLE IF EXISTS role_menu_access;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;

-- ---------- D. UserRole → UserBranch ----------
ALTER TABLE user_roles RENAME TO user_branches;

ALTER TABLE user_branches DROP COLUMN IF EXISTS valid_from;
ALTER TABLE user_branches DROP COLUMN IF EXISTS valid_until;
ALTER TABLE user_branches ALTER COLUMN branch_id SET NOT NULL;

-- align index/constraint names with Prisma conventions
ALTER INDEX user_roles_user_id_idx RENAME TO user_branches_user_id_idx;
ALTER INDEX user_roles_role_id_idx RENAME TO user_branches_role_id_idx;
ALTER INDEX user_roles_branch_id_idx RENAME TO user_branches_branch_id_idx;
ALTER INDEX user_roles_is_primary_idx RENAME TO user_branches_is_primary_idx;
DROP INDEX IF EXISTS user_roles_user_id_role_id_branch_id_key;
CREATE UNIQUE INDEX user_branches_user_id_branch_id_role_id_key ON user_branches(user_id, branch_id, role_id);

ALTER TABLE user_branches RENAME CONSTRAINT user_roles_pkey TO user_branches_pkey;
ALTER TABLE user_branches RENAME CONSTRAINT user_roles_user_id_fkey TO user_branches_user_id_fkey;
ALTER TABLE user_branches RENAME CONSTRAINT user_roles_role_id_fkey TO user_branches_role_id_fkey;
-- branch FK: SET NULL → CASCADE (branchId now required)
ALTER TABLE user_branches DROP CONSTRAINT user_roles_branch_id_fkey;
ALTER TABLE user_branches ADD CONSTRAINT user_branches_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;

-- ---------- E. Branch: outlet-only ----------
ALTER TABLE branches DROP COLUMN IF EXISTS type;
ALTER TABLE branches DROP COLUMN IF EXISTS is_warehouse;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS director TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS mobile_phone TEXT;

-- ---------- F. Warehouse FK wiring ----------
ALTER TABLE sales_transactions ADD CONSTRAINT sales_transactions_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;

COMMIT;
