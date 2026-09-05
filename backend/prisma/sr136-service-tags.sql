-- IGDERP-136 round 5: layanan tag dictionary (suggestion source, usage-ranked).
CREATE TABLE IF NOT EXISTS service_tags (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text         NOT NULL UNIQUE,
  usage_count integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_tags_usage ON service_tags (usage_count DESC);

-- Backfill from existing layanan notes (comma-joined): split, trim, UpperFirst-normalize, count.
INSERT INTO service_tags (name, usage_count)
SELECT norm, COUNT(*) FROM (
  SELECT UPPER(LEFT(TRIM(tag), 1)) || LOWER(SUBSTRING(TRIM(tag) FROM 2)) AS norm
  FROM (
    SELECT regexp_split_to_table(notes, ',') AS tag
    FROM service_order_layanans
    WHERE notes IS NOT NULL AND TRIM(notes) <> ''
  ) t
  WHERE TRIM(tag) <> ''
) n
GROUP BY norm
ON CONFLICT (name) DO UPDATE SET usage_count = service_tags.usage_count + EXCLUDED.usage_count;
