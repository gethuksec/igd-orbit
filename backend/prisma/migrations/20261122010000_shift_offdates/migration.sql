-- WS-287: explicit libur (off) dates per shift assignment.
-- Effective schedule = weekday pattern minus offDates. Idempotent.

ALTER TABLE "shift_assignments"
  ADD COLUMN IF NOT EXISTS "off_dates" DATE[] NOT NULL DEFAULT '{}';
