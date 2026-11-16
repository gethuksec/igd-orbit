-- Stock request type (EXIT/LIMIT) + optional customer name (7-Nov manual note).
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
UPDATE stock_requests SET request_type = 'LIMIT' WHERE request_type IS NULL;
ALTER TABLE stock_requests ALTER COLUMN request_type SET NOT NULL;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS customer_name TEXT;
UPDATE stock_requests SET customer_name = member_ref WHERE customer_name IS NULL AND member_ref IS NOT NULL;
