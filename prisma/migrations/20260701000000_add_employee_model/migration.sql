-- Story 7.1 (Epic 7): Employee data model — Fortnox-mapped compliance subset,
-- org grouping (EmployeeGroup) and kollektivavtal record (CollectiveAgreement).
--
-- Additive ONLY: five new enums + three new tables + FKs, plus one additive
-- back-relation on workspace_files (relation-completeness only — NO column
-- change to workspace_files). Zero DROP / RENAME / ALTER COLUMN on any existing
-- object. Backward-compatible.
--
-- NOTE: authored BY HAND (not via `prisma migrate dev --create-only`) to avoid a
-- live DB / shadow-DB connection, per the project's manual-migration workflow
-- (docs/migrations/epic-21-supabase-applies.md). Applied manually by the
-- developer — do NOT auto-apply / reset.
--
-- Enum members ARE the Fortnox codes (identity-mappable); column names mirror
-- Fortnox property names. See docs/reference/fortnox-employee-schema-analysis.md.
--
-- RLS: follows the project pattern (20260521120000_add_pending_agent_actions /
-- 20260430120000_enable_rls_public_tables) — RLS enabled with no policies
-- (default deny for non-bypass roles). Prisma connects as the postgres role
-- (BYPASSRLS), so server-side prisma.* queries are unaffected; this closes the
-- PostgREST/Realtime/anon-key access path for these PII-bearing tables.

-- CreateEnum
CREATE TYPE "EmploymentForm" AS ENUM ('TV', 'PRO', 'TID', 'SVT', 'VIK', 'PRJ', 'PRA', 'FER', 'SES', 'NEJ');

-- CreateEnum
CREATE TYPE "PersonelType" AS ENUM ('TJM', 'ARB');

-- CreateEnum
CREATE TYPE "SalaryForm" AS ENUM ('MAN', 'TIM');

-- CreateEnum
CREATE TYPE "FortnoxSyncStatus" AS ENUM ('NOT_LINKED', 'LINKED', 'SYNCING', 'CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "CollectiveAgreementStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "employee_id_ref" TEXT,
    "personnummer" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "post_code" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'SE',
    "job_title" TEXT,
    "employment_date" TIMESTAMP(3),
    "employed_to" TIMESTAMP(3),
    "employment_form" "EmploymentForm",
    "personel_type" "PersonelType",
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "full_time_equivalent" DECIMAL(4,3),
    "average_weekly_hours" DECIMAL(5,2),
    "schedule_id" TEXT,
    "salary_form" "SalaryForm",
    "vacation_days_paid" DECIMAL(5,2),
    "collective_agreement_id" TEXT,
    "group_id" TEXT,
    "manager_id" TEXT,
    "fortnox_employee_id" TEXT,
    "fortnox_synced_at" TIMESTAMP(3),
    "fortnox_sync_status" "FortnoxSyncStatus" NOT NULL DEFAULT 'NOT_LINKED',
    "fortnox_raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_groups" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collective_agreements" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personel_type" "PersonelType",
    "workspace_file_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "status" "CollectiveAgreementStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collective_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_workspace_id_idx" ON "employees"("workspace_id");

-- CreateIndex
CREATE INDEX "employees_workspace_id_inactive_idx" ON "employees"("workspace_id", "inactive");

-- CreateIndex
CREATE UNIQUE INDEX "employees_workspace_id_fortnox_employee_id_key" ON "employees"("workspace_id", "fortnox_employee_id");

-- CreateIndex
CREATE INDEX "employee_groups_workspace_id_idx" ON "employee_groups"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_groups_workspace_id_name_key" ON "employee_groups"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "collective_agreements_workspace_id_idx" ON "collective_agreements"("workspace_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "employee_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_collective_agreement_id_fkey" FOREIGN KEY ("collective_agreement_id") REFERENCES "collective_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collective_agreements" ADD CONSTRAINT "collective_agreements_workspace_file_id_fkey" FOREIGN KEY ("workspace_file_id") REFERENCES "workspace_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS on the new PII-bearing tables (project pattern: see
-- 20260521120000_add_pending_agent_actions). RLS on, no policies → default deny
-- for non-BYPASSRLS roles; server-side prisma (postgres role) is unaffected.
ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."employee_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."collective_agreements" ENABLE ROW LEVEL SECURITY;
