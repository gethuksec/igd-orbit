-- WS-288: per-date roster plotting (submitted rosters, Libur = null shift).
-- Idempotent.

CREATE TABLE IF NOT EXISTS "shift_roster_entries" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employee_id" TEXT NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "shift_id" TEXT REFERENCES "shifts"("id") ON DELETE RESTRICT,
  "submitted" BOOLEAN NOT NULL DEFAULT false,
  "submitted_at" TIMESTAMPTZ,
  "note" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("employee_id", "date")
);
CREATE INDEX IF NOT EXISTS "shift_roster_entries_employee_submitted_idx"
  ON "shift_roster_entries" ("employee_id", "submitted");
CREATE INDEX IF NOT EXISTS "shift_roster_entries_date_idx"
  ON "shift_roster_entries" ("date");
