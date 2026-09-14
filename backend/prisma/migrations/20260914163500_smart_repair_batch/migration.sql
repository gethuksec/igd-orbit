-- Smart Repair batch schema delta — IGDERP 137/168/169/171/184/185/186/187.
-- Applied by `prisma migrate deploy` (backend entrypoint) on container boot.
-- Idempotent guards: a manual psql pre-apply (if ever needed) stays a no-op and
-- re-application is always safe. Contains ONLY this batch's new objects — the
-- legacy sr*.sql files were applied by earlier deploys and are NOT replayed here.

-- AlterTable (IGDERP-185: phone lock credential discriminator, none/password/pin/pattern)
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "device_lock_type" TEXT NOT NULL DEFAULT 'none';

-- AlterTable (IGDERP-186: auto duration per service type, hours step 0.5)
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "duration_hours" DECIMAL(5,2);

-- AlterTable (IGDERP-187: per-tier service prices {"tierId": price})
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "tier_pricing" JSONB;

-- CreateTable (IGDERP-169: device type master — strict intake source, no free "lainnya")
CREATE TABLE IF NOT EXISTS "device_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "device_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "device_types_code_key" ON "device_types"("code");
CREATE INDEX IF NOT EXISTS "device_types_is_active_sort_order_idx" ON "device_types"("is_active", "sort_order");

-- Seed base device types (mirrors seed.ts IGDERP-169 block; intake requires >=1 active row)
INSERT INTO "device_types" ("id", "code", "name", "is_active", "sort_order", "created_at", "updated_at") VALUES
  ('2b1fe810-25fd-4695-8637-5bf932b71c5a', 'handphone', 'Handphone', true, 0, now(), now()),
  ('0ae36378-7b09-4ae7-81dd-a6a4254926c0', 'tablet', 'Tablet', true, 1, now(), now()),
  ('2c0eee72-31ca-45db-8405-920a842305cb', 'laptop', 'Laptop', true, 2, now(), now()),
  ('9f866236-25ee-4585-93c5-dbc0209d5e1f', 'smartwatch', 'Smartwatch', true, 3, now(), now())
ON CONFLICT ("code") DO NOTHING;

-- IGDERP-187: default grant of service.price.edit — mirrors seed.ts (OWNER/MGR/SPV/HS + SUPERADMIN).
-- Role-level changes normally also bump Redis auth:ver:{userId} (see roles.service) —
-- the deploy runbook does that via redis-cli after this migration is recorded.
UPDATE "roles"
SET "default_permissions" = array_append("default_permissions", 'service.price.edit'),
    "updated_at" = now()
WHERE "code" IN ('OWNER', 'MGR', 'SPV', 'HS', 'SUPERADMIN')
  AND NOT ("default_permissions" @> ARRAY['service.price.edit']);
