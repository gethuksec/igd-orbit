-- IGDERP-141 (Plan C): feature-level enrollment — per-assignment GRANT list.
-- Allowlisted grants only (see GRANTABLE_PERMISSIONS in permissions.util.ts);
-- additive to role defaults, deny still wins. Idempotent.
ALTER TABLE "user_branches" ADD COLUMN IF NOT EXISTS "granted_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
