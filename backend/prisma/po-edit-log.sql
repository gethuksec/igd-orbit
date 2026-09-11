-- IGDERP-82 (S3): PO edit-after-approval audit log — mandatory reason + old/new snapshot.
-- Idempotent; apply BEFORE the rebuild (boot `db push` would otherwise create it).
-- Run as postgres superuser; table ownership stays with the app user.

CREATE TABLE IF NOT EXISTS "purchase_order_edit_logs" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "before_snapshot" JSONB NOT NULL,
  "after_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_edit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_purchase_order_edit_logs_po"
  ON "purchase_order_edit_logs"("purchase_order_id");

DO $$ BEGIN
  ALTER TABLE "purchase_order_edit_logs" ADD CONSTRAINT "purchase_order_edit_logs_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_order_edit_logs" ADD CONSTRAINT "purchase_order_edit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
