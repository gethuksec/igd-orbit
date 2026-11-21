-- IGDERP-266 assign/edit rework: new shells default to 'unassigned'.
-- Statuses: 'unassigned' (no shell row yet) | 'assigned' (editable) |
-- 'approved' (immutable, payroll gate). Legacy 'locked' reads as approved.
ALTER TABLE "kpi_period_locks" ALTER COLUMN "status" SET DEFAULT 'unassigned';
