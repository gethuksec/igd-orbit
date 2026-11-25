-- IGDERP-317: CategoryGrade scoped master (one grade list per category).
-- Products link via products.grade_id; legacy products.grade text stays
-- read-only through the transition. Legacy distinct grade values are
-- backfilled as CategoryGrade rows (deterministic md5-derived codes).

-- CreateTable
CREATE TABLE "category_grades" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_grades_code_key" ON "category_grades"("code");
CREATE UNIQUE INDEX "category_grades_category_id_name_key" ON "category_grades"("category_id", "name");
CREATE INDEX "category_grades_category_id_idx" ON "category_grades"("category_id");
CREATE INDEX "category_grades_code_idx" ON "category_grades"("code");

-- AddForeignKey
ALTER TABLE "category_grades" ADD CONSTRAINT "category_grades_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable products: scoped grade link
ALTER TABLE "products" ADD COLUMN "grade_id" TEXT;
CREATE INDEX "products_grade_id_idx" ON "products"("grade_id");
ALTER TABLE "products" ADD CONSTRAINT "products_grade_id_fkey"
    FOREIGN KEY ("grade_id") REFERENCES "category_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one CategoryGrade row per distinct legacy (category, grade text).
-- Codes are md5-derived (hex uppercased => always matches ^[A-Z0-9]{10}$)
-- and deterministic, so the migration is safely re-runnable.
INSERT INTO "category_grades" ("id", "category_id", "code", "name", "is_active", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    p."category_id",
    UPPER(SUBSTRING(md5(p."category_id" || '|' || TRIM(p."grade")) FROM 1 FOR 10)),
    TRIM(p."grade"),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "category_id", TRIM("grade") AS "grade"
    FROM "products"
    WHERE "grade" IS NOT NULL AND TRIM("grade") <> ''
) p
ON CONFLICT ("category_id", "name") DO NOTHING;
