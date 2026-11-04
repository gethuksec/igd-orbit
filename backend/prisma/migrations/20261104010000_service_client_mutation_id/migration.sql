-- IGDERP-240 (smart-service offline phase 2): idempotency key for offline intake replays.
-- FE generates one uuid v4 per intake; reconnect retries with the same key
-- return the original order instead of double-creating. Idempotent.
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "client_mutation_id" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_orders_client_mutation_id_key'
  ) THEN
    ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_client_mutation_id_key" UNIQUE ("client_mutation_id");
  END IF;
END
$$;
