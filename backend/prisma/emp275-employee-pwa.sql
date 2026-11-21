-- IGDERP-275: Employee PWA — attendance GPS+selfie, NIK login, 2-step approvals, payslip PIN, shift swap.
-- Apply once on igd-vm database (idempotent). Mirrors backend/prisma/migrations/20261122020000_employee_pwa/migration.sql.

-- IGDERP-275: Employee PWA — attendance GPS+selfie, NIK login, 2-step approvals, payslip PIN, shift swap.
-- Idempotent (IF NOT EXISTS / DO blocks) to match repo convention.

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "attendance_radius_m" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "nik" TEXT,
  ADD COLUMN IF NOT EXISTS "payslip_pin_hash" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_nik_key') THEN
    ALTER TABLE "employees" ADD CONSTRAINT "employees_nik_key" UNIQUE ("nik");
  END IF;
END $$;

ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "clock_in_photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "clock_out_photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "clock_in_lat" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "clock_in_lng" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "clock_out_lat" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "clock_out_lng" DECIMAL(10,7);

ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "manager_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "manager_approved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "hr_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "hr_approved_at" TIMESTAMPTZ(6);

ALTER TABLE "overtime_requests"
  ADD COLUMN IF NOT EXISTS "manager_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "manager_approved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "hr_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "hr_approved_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "shift_swap_requests" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "target_employee_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "from_shift_id" TEXT NOT NULL,
  "to_shift_id" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_by" TEXT NOT NULL,
  "manager_approved_by" TEXT,
  "manager_approved_at" TIMESTAMPTZ(6),
  "hr_approved_by" TEXT,
  "hr_approved_at" TIMESTAMPTZ(6),
  "approved_by" TEXT,
  "approved_at" TIMESTAMPTZ(6),
  "rejected_by" TEXT,
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancelled_by" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shift_swap_requests_employee_id_idx" ON "shift_swap_requests"("employee_id");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_target_employee_id_idx" ON "shift_swap_requests"("target_employee_id");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_date_idx" ON "shift_swap_requests"("date");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_status_idx" ON "shift_swap_requests"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_employee_id_fkey') THEN
    ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_target_employee_id_fkey') THEN
    ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_employee_id_fkey" FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_from_shift_id_fkey') THEN
    ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_from_shift_id_fkey" FOREIGN KEY ("from_shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_swap_requests_to_shift_id_fkey') THEN
    ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_to_shift_id_fkey" FOREIGN KEY ("to_shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
