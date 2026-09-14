-- IGDERP-141 (Plan C, S3): CS default flip — 27 Aug §10 #6 "default CS cannot POS".
-- POS access for CS users is enabled per user/outlet via the granted_permissions
-- enrollment ("Akses POS" checkbox). Applied only on saintOx's go for the flip moment.
-- Idempotent (no-op when the keys are already removed).
UPDATE "roles"
SET "default_permissions" = array_remove(array_remove(array_remove("default_permissions", 'menu.pos'), 'action.pos.create'), 'action.pos.edit'),
    "updated_at" = now()
WHERE "code" = 'CS'
  AND ("default_permissions" && ARRAY['menu.pos', 'action.pos.create', 'action.pos.edit']);
