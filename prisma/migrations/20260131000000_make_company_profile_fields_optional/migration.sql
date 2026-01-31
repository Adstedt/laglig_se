-- AlterTable: Make company_profiles fields optional for onboarding wizard (Story 10.2)
ALTER TABLE "public"."company_profiles" ALTER COLUMN "sni_code" DROP NOT NULL;
ALTER TABLE "public"."company_profiles" ALTER COLUMN "legal_form" DROP NOT NULL;
ALTER TABLE "public"."company_profiles" ALTER COLUMN "employee_count" DROP NOT NULL;
