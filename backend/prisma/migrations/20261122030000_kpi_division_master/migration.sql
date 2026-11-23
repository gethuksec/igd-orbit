-- IGDERP-266: KPI master per division (replaces kpi_records).
-- Idempotent. Go-live has no historical KPI data in the system, so the
-- obsolete kpi_records table is dropped; scoring restarts from masters.
-- Source: Format_HR_ORBIT.xlsx Kpi sheet.

CREATE TABLE IF NOT EXISTS "kpi_division_config" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "division_id" TEXT NOT NULL UNIQUE REFERENCES "divisions"("id") ON DELETE CASCADE,
  "default_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "kpi_aspects" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "division_id" TEXT NOT NULL REFERENCES "divisions"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "interval_min" DECIMAL(7,2) NOT NULL DEFAULT 60,
  "interval_max" DECIMAL(7,2) NOT NULL DEFAULT 140,
  "weight" DECIMAL(5,4) NOT NULL,
  "target_type" TEXT NOT NULL DEFAULT 'FIXED',
  "fixed_target" DECIMAL(15,2),
  "is_kolektif" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("division_id", "code")
);
CREATE INDEX IF NOT EXISTS "kpi_aspects_division_idx" ON "kpi_aspects" ("division_id");
CREATE INDEX IF NOT EXISTS "kpi_aspects_active_idx" ON "kpi_aspects" ("is_active");

CREATE TABLE IF NOT EXISTS "kpi_period_targets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "aspect_id" TEXT NOT NULL REFERENCES "kpi_aspects"("id") ON DELETE CASCADE,
  "period_month" INTEGER NOT NULL,
  "period_year" INTEGER NOT NULL,
  "target" DECIMAL(15,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("aspect_id", "period_month", "period_year")
);
CREATE INDEX IF NOT EXISTS "kpi_period_targets_period_idx" ON "kpi_period_targets" ("period_month", "period_year");

CREATE TABLE IF NOT EXISTS "kpi_period_actuals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "division_id" TEXT NOT NULL REFERENCES "divisions"("id") ON DELETE CASCADE,
  "aspect_id" TEXT NOT NULL REFERENCES "kpi_aspects"("id") ON DELETE CASCADE,
  "period_month" INTEGER NOT NULL,
  "period_year" INTEGER NOT NULL,
  "value" DECIMAL(15,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("division_id", "aspect_id", "period_month", "period_year")
);
CREATE INDEX IF NOT EXISTS "kpi_period_actuals_period_idx"
  ON "kpi_period_actuals" ("division_id", "period_month", "period_year");

CREATE TABLE IF NOT EXISTS "kpi_scores" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employee_id" TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "aspect_id" TEXT NOT NULL REFERENCES "kpi_aspects"("id") ON DELETE CASCADE,
  "period_month" INTEGER NOT NULL,
  "period_year" INTEGER NOT NULL,
  "value" DECIMAL(15,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("employee_id", "aspect_id", "period_month", "period_year")
);
CREATE INDEX IF NOT EXISTS "kpi_scores_period_idx"
  ON "kpi_scores" ("employee_id", "period_month", "period_year");
CREATE INDEX IF NOT EXISTS "kpi_scores_aspect_period_idx"
  ON "kpi_scores" ("aspect_id", "period_month", "period_year");

CREATE TABLE IF NOT EXISTS "kpi_employee_notes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employee_id" TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "period_month" INTEGER NOT NULL,
  "period_year" INTEGER NOT NULL,
  "notes" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("employee_id", "period_month", "period_year")
);

CREATE TABLE IF NOT EXISTS "kpi_period_locks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "division_id" TEXT NOT NULL REFERENCES "divisions"("id") ON DELETE CASCADE,
  "period_month" INTEGER NOT NULL,
  "period_year" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "locked_by" TEXT,
  "locked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("division_id", "period_month", "period_year")
);
CREATE INDEX IF NOT EXISTS "kpi_period_locks_period_idx"
  ON "kpi_period_locks" ("division_id", "period_month", "period_year");

DROP TABLE IF EXISTS "kpi_records";
