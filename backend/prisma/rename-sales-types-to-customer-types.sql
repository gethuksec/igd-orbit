-- ============================================================================
-- IGD-Orbit: Rename sales_types -> customer_types (feature rename
-- "Tipe Penjualan" -> "Tipe Customer", same function)
--
-- WHY: prisma db push does NOT detect renames — it drops + recreates (data
-- loss). This SQL must run against prod BEFORE the new backend container
-- starts (entrypoint runs `db push --accept-data-loss` on start).
-- Idempotent: safe to re-run; every statement is existence-guarded.
-- ============================================================================

BEGIN;

-- 1. Table rename (owner is preserved by ALTER ... RENAME — stays `developer`)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sales_types' AND relkind = 'r')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'customer_types' AND relkind = 'r') THEN
    ALTER TABLE "sales_types" RENAME TO "customer_types";
  END IF;
END $$;

-- 2. Rename its indexes/constraints to Prisma's expected names
--    (PK/unique constraints follow their index rename automatically)
DO $$
DECLARE
  idx text;
  new_name text;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'customer_types' AND indexname LIKE 'sales_types\_%'
  LOOP
    new_name := 'customer_types_' || substring(idx from length('sales_types_') + 1);
    EXECUTE format('ALTER INDEX %I RENAME TO %I', idx, new_name);
  END LOOP;
END $$;

-- 3. Column rename on sales_transactions (plain ref, no FK, no index)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'sales_transactions' AND column_name = 'sales_type_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'sales_transactions' AND column_name = 'customer_type_id') THEN
    ALTER TABLE "sales_transactions" RENAME COLUMN "sales_type_id" TO "customer_type_id";
  END IF;
END $$;

COMMIT;

-- Verify (expected):
--   to_regclass('customer_types') NOT NULL, to_regclass('sales_types') NULL
--   SELECT count(*) FROM customer_types;  -- 3 rows preserved
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='sales_transactions' AND column_name='customer_type_id';
--   SELECT indexname FROM pg_indexes WHERE tablename='customer_types';
--     -> customer_types_pkey, customer_types_code_key, customer_types_code_idx,
--        customer_types_is_active_idx
