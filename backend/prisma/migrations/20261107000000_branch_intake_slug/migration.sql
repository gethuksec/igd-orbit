-- Outlet auto intake identity (hybrid C): human-friendly slug + unguessable token.
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "intake_slug" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_intake_slug_key'
  ) THEN
    ALTER TABLE "branches" ADD CONSTRAINT "branches_intake_slug_key" UNIQUE ("intake_slug");
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS "branches_intake_slug_idx" ON "branches"("intake_slug");
