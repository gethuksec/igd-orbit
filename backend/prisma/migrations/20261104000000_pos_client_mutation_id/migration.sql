-- IGDERP-239 (PoS offline phase 1): idempotency key for offline outbox replays.
-- FE generates one uuid v4 per sale; reconnect retries with the same key
-- return the original row instead of double-selling. Idempotent.
ALTER TABLE "sales_transactions" ADD COLUMN IF NOT EXISTS "client_mutation_id" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_transactions_client_mutation_id_key'
  ) THEN
    ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_client_mutation_id_key" UNIQUE ("client_mutation_id");
  END IF;
END
$$;
