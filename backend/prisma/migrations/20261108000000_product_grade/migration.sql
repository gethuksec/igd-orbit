-- Product grade (free text, xlsx import template)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "grade" TEXT;
