-- IGDERP-187: per-tier service prices on service_types (mirrors products.member_pricing).
-- Idempotent: safe to run multiple times. Run as postgres before `prisma db push`.
ALTER TABLE service_types ADD COLUMN IF NOT EXISTS tier_pricing JSONB;
