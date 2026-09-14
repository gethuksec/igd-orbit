-- IGDERP-141 (Plan C, S3): CS default flip — "default CS cannot POS" (27 Aug §10 #6).
--
-- ⚠️ MANUAL APPLY ONLY, at the moment saintOx confirms the flip (with the day-one
-- tick list ready). Deliberately NOT a prisma migration: it must never auto-apply
-- on a redeploy. Idempotent (no-op once applied).
--
-- Runbook (on igd-vm, as developer):
--   docker exec -i igd-orbit-postgres psql -U developer -d igd_orbit_db -v ON_ERROR_STOP=1 < pos-grant-cs-pos-flip.sql
--   then bump Redis auth:ver:{userId} for every CS-role holder (mirror roles.service.bumpAllRoleHolders)
--
-- Rollout companion (same moment): tick "Akses POS" for the users/outlets that must
-- keep POS to avoid disruption — grant = INSERT via the UI or:
--   UPDATE user_branches SET granted_permissions = ARRAY['action.pos.create','action.pos.edit']
--   WHERE role_id = (SELECT id FROM roles WHERE code='CS') AND user_id IN (...);
UPDATE "roles"
SET "default_permissions" = array_remove(array_remove(array_remove("default_permissions", 'menu.pos'), 'action.pos.create'), 'action.pos.edit'),
    "updated_at" = now()
WHERE "code" = 'CS'
  AND ("default_permissions" && ARRAY['menu.pos', 'action.pos.create', 'action.pos.edit']);
