-- Intake item note (replaces qty stepper on the public request form).
ALTER TABLE stock_request_items ADD COLUMN IF NOT EXISTS note TEXT;
