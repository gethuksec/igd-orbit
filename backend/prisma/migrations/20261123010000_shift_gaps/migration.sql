-- WS-288 v2 (IGDERP-265 gaps, rebased on roster-first upstream): title-default
-- shift, contract snapshot, two-step libur, roster window setting.
-- Upstream owns release via shift_roster_entries.submitted — no release table here.
-- Idempotent: safe to re-run after a failed attempt.

-- 1. Position.defaultShiftId (title default, employee override wins)
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "default_shift_id" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positions_default_shift_id_fkey') THEN
    ALTER TABLE "positions" ADD CONSTRAINT "positions_default_shift_id_fkey"
      FOREIGN KEY ("default_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "positions_default_shift_id_idx" ON "positions"("default_shift_id");

-- 2. Employee.defaultShiftId (live override)
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "default_shift_id" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_default_shift_id_fkey') THEN
    ALTER TABLE "employees" ADD CONSTRAINT "employees_default_shift_id_fkey"
      FOREIGN KEY ("default_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "employees_default_shift_id_idx" ON "employees"("default_shift_id");

-- 3. Contract shift snapshot (audit at signing; never rewritten by access edits)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "shift_id" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "shift_code" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "shift_clock_in" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "shift_clock_out" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_shift_id_fkey') THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_shift_id_fkey"
      FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. ShiftSetting (window parameters only; release = roster submitted flag)
CREATE TABLE IF NOT EXISTS "shift_settings" (
    "id" TEXT NOT NULL,
    "roster_open_day" INTEGER NOT NULL DEFAULT 25,
    "roster_close_day" INTEGER,
    "employee_input_start_day" INTEGER NOT NULL DEFAULT 25,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_settings_pkey" PRIMARY KEY ("id")
);

-- 5. LiburRequest atasan step (decidedBy stays the HR-final)
ALTER TABLE "libur_requests" ADD COLUMN IF NOT EXISTS "atasan_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "libur_requests" ADD COLUMN IF NOT EXISTS "atasan_decided_by" TEXT;
ALTER TABLE "libur_requests" ADD COLUMN IF NOT EXISTS "atasan_decided_at" TIMESTAMP(3);
ALTER TABLE "libur_requests" ADD COLUMN IF NOT EXISTS "atasan_reject_reason" TEXT;
