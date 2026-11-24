-- IGDERP-298: contract import-as-intake — User.mustChangePassword + Employee.education.
-- Idempotent. mustChangePassword is enforcement state (rotate generated password at
-- next login); education holds the PENDIDIKAN TERAKHIR* jenjang until D9 normalizes it.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "education" TEXT;
