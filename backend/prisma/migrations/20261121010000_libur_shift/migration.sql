-- WS-286: Libur (monthly off-day quota + requests) and Shift (masters + assignments).
-- Idempotent: safe to re-run after a failed attempt.

CREATE TABLE IF NOT EXISTS "libur_quota_configs" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT,
    "quota_days" INTEGER NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "libur_quota_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "libur_quota_configs_employee_id_key"
  ON "libur_quota_configs"("employee_id");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'libur_quota_configs_employee_id_fkey'
  ) THEN
    ALTER TABLE "libur_quota_configs" ADD CONSTRAINT "libur_quota_configs_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "libur_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "target_period" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'current',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "libur_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "libur_requests_employee_id_idx" ON "libur_requests"("employee_id");
CREATE INDEX IF NOT EXISTS "libur_requests_status_idx" ON "libur_requests"("status");
CREATE INDEX IF NOT EXISTS "libur_requests_target_period_idx" ON "libur_requests"("target_period");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'libur_requests_employee_id_fkey'
  ) THEN
    ALTER TABLE "libur_requests" ADD CONSTRAINT "libur_requests_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "shifts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clock_in" TEXT NOT NULL,
    "clock_out" TEXT NOT NULL,
    "overnight" BOOLEAN NOT NULL DEFAULT false,
    "late_tolerance_min" INTEGER NOT NULL DEFAULT 15,
    "break_hours" DECIMAL(4,2),
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_code_key" ON "shifts"("code");

CREATE TABLE IF NOT EXISTS "shift_assignments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "weekdays" INTEGER[] NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shift_assignments_employee_id_idx" ON "shift_assignments"("employee_id");
CREATE INDEX IF NOT EXISTS "shift_assignments_shift_id_idx" ON "shift_assignments"("shift_id");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_assignments_employee_id_fkey'
  ) THEN
    ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_assignments_shift_id_fkey'
  ) THEN
    ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey"
      FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
