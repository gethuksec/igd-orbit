-- IGDERP-266: convert legacy kolektif/PERIOD KPI aspects to per-employee FIXED.
-- No period targets or scores were ever recorded for these rows, so every
-- converted row takes fixed_target = 100 (user-confirmed 2026-11-25).
UPDATE kpi_aspects
SET target_type = 'FIXED', is_kolektif = false
WHERE target_type <> 'FIXED' OR is_kolektif = true;

UPDATE kpi_aspects
SET fixed_target = 100
WHERE target_type = 'FIXED' AND fixed_target IS NULL;
