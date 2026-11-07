-- Make customer phone optional (intake quick-add allows empty WA).
ALTER TABLE "customers" ALTER COLUMN "phone" DROP NOT NULL;
