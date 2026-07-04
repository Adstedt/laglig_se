-- Story 7.10: Employee salary (Lön) for kollektivavtal minimilön compliance.
--
-- Additive ONLY: two new nullable TEXT columns on employees. Zero DROP /
-- RENAME / ALTER COLUMN on any existing object. Backward-compatible.
--
-- Columns hold AES-256-GCM CIPHERTEXT (encrypted at rest, like personnummer) —
-- hence TEXT, not DECIMAL. Application-level encrypt/decrypt via
-- lib/employees/salary.ts; decrypted only for employees:manage.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset), per the
-- project's manual-migration workflow (docs/migrations/epic-21-supabase-applies.md).

-- AlterTable
ALTER TABLE "employees"
  ADD COLUMN "monthly_salary" TEXT,
  ADD COLUMN "hourly_pay"     TEXT;
