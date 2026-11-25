-- Master product rework A (IGDERP-309): 12-digit numeric barcode DDMMYYYY + lifetime sequence
-- Format: 8-digit Asia/Jakarta date prefix + global sequence (min 4 digits, grows past 9999).
-- The sequence never resets; backfill assigns 1..N in creation order, new rows continue after MAX.

CREATE SEQUENCE IF NOT EXISTS product_barcode_seq START 1;

-- Deterministic backfill: non-conforming barcodes (NULL, legacy BRC-*, short) get
-- their product's creation-date prefix + row_number() sequence in (created_at, id) order.
WITH ranked AS (
  SELECT id,
    to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'DDMMYYYY')
      || lpad((row_number() OVER (ORDER BY created_at, id))::text, 4, '0') AS bc
  FROM products
  WHERE barcode IS NULL OR barcode !~ '^[0-9]{12,}$'
)
UPDATE products p SET barcode = ranked.bc FROM ranked WHERE p.id = ranked.id;

-- High-water mark: continue after the largest sequence part in use
-- (first 8 chars are the date prefix, the rest is the sequence).
SELECT setval(
  'product_barcode_seq',
  COALESCE((SELECT MAX(substring(barcode from 9)::bigint) FROM products WHERE barcode ~ '^[0-9]{12,}$'), 0)
);
