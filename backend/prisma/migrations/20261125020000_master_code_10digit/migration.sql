-- Master lists rework (IGDERP-316): backfill category/brand/unit/size codes
-- to flat 10-char uppercase alphanumeric [A-Z0-9].
-- Seeded rows get the deterministic mapping that matches prisma/seed.ts
-- (so re-running the seed stays idempotent); all other non-conforming rows
-- get UPPER(md5('<table>:' || id))[:10] (40 bits, unique-checked by loop in
-- practice — the UNIQUE constraint errors loudly on the freak collision).
-- Colors are intentionally untouched (IGDERP-316: no code at all in UI).

-- Categories
UPDATE categories SET code = CASE code
  WHEN 'CAT-ELEC' THEN 'ELEC000001'
  WHEN 'CAT-PHONE' THEN 'PHONE00001'
  WHEN 'CAT-LAPTOP' THEN 'LAPTOP0001'
  WHEN 'CAT-SPAREPART' THEN 'SPAREPART1'
  WHEN 'CAT-ACCESSORIES' THEN 'ACCESSORY1'
  ELSE UPPER(SUBSTRING(MD5('categories:' || id::TEXT), 1, 10))
END
WHERE code !~ '^[A-Z0-9]{10}$';

-- Brands
UPDATE brands SET code = CASE code
  WHEN 'BRAND-SAMSUNG' THEN 'SAMSUNG001'
  WHEN 'BRAND-APPLE' THEN 'APPLE00001'
  WHEN 'BRAND-ASUS' THEN 'ASUS000001'
  WHEN 'BRAND-GENERIC' THEN 'GENERIC001'
  WHEN 'BRAND-XIAOMI' THEN 'XIAOMI0001'
  ELSE UPPER(SUBSTRING(MD5('brands:' || id::TEXT), 1, 10))
END
WHERE code !~ '^[A-Z0-9]{10}$';

-- Units
UPDATE units SET code = CASE code
  WHEN 'PCS' THEN 'PCS0000001'
  WHEN 'SERVICE' THEN 'SERVICE001'
  ELSE UPPER(SUBSTRING(MD5('units:' || id::TEXT), 1, 10))
END
WHERE code !~ '^[A-Z0-9]{10}$';

-- Sizes (no seeded rows — md5 fallback only)
UPDATE sizes SET code = UPPER(SUBSTRING(MD5('sizes:' || id::TEXT), 1, 10))
WHERE code !~ '^[A-Z0-9]{10}$';
