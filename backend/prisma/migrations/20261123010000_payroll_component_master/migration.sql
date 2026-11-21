-- IGDERP-284: payroll income/deduction component master (popup checklist + template columns).
-- Idempotent. Non-denda components only; denda stays in penalty_types.
-- Source: thread 20261120 + Format_HR_ORBIT.xlsx Payroll sheet.

CREATE TABLE IF NOT EXISTS "payroll_component_masters" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "default_amount" DECIMAL(15,2),
  "tiers" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "payroll_component_masters_code_idx" ON "payroll_component_masters" ("code");
CREATE INDEX IF NOT EXISTS "payroll_component_masters_category_idx" ON "payroll_component_masters" ("category");
CREATE INDEX IF NOT EXISTS "payroll_component_masters_active_idx" ON "payroll_component_masters" ("is_active");
