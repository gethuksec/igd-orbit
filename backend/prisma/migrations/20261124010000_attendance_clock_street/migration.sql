-- Presensi: store street name resolved at clock-in/out time (nullable, no backfill —
-- older rows fall back to live reverse-geocode in the roster popup).
-- Idempotent: safe to re-run after a failed attempt.

ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "clock_in_street" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "clock_out_street" TEXT;
