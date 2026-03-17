-- Story 15.1: Add BolagsAPI enrichment fields to CompanyProfile
-- Additive only — no column drops, no renames, no data loss

ALTER TABLE "company_profiles" ADD COLUMN "business_description" TEXT;
ALTER TABLE "company_profiles" ADD COLUMN "tax_status" JSONB;
ALTER TABLE "company_profiles" ADD COLUMN "foreign_owned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_profiles" ADD COLUMN "parent_company_name" TEXT;
ALTER TABLE "company_profiles" ADD COLUMN "parent_company_orgnr" TEXT;
ALTER TABLE "company_profiles" ADD COLUMN "fi_regulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_profiles" ADD COLUMN "active_status" TEXT;
ALTER TABLE "company_profiles" ADD COLUMN "ongoing_procedures" JSONB;
ALTER TABLE "company_profiles" ADD COLUMN "registered_date" TIMESTAMP(3);
ALTER TABLE "company_profiles" ADD COLUMN "data_source" TEXT;
ALTER TABLE "company_profiles" ADD COLUMN "last_enriched_at" TIMESTAMP(3);
