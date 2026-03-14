-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('AB', 'HB', 'KOMMUN', 'REGION', 'STATLIG_MYNDIGHET', 'ENSKILD_FIRMA', 'EKONOMISK_FORENING', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeCountRange" AS ENUM ('RANGE_1_9', 'RANGE_10_49', 'RANGE_50_249', 'RANGE_250_PLUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ComplianceMaturity" AS ENUM ('BASIC', 'DEVELOPING', 'ESTABLISHED', 'ADVANCED');

-- AlterTable
ALTER TABLE "company_profiles" ADD COLUMN     "activity_flags" JSONB,
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "compliance_maturity" "ComplianceMaturity",
ADD COLUMN     "employee_count_range" "EmployeeCountRange",
ADD COLUMN     "has_compliance_officer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "industry_label" TEXT,
ADD COLUMN     "last_onboarding_at" TIMESTAMP(3),
ADD COLUMN     "org_number" TEXT,
ADD COLUMN     "organization_type" "OrganizationType",
ADD COLUMN     "profile_completeness" INTEGER NOT NULL DEFAULT 0;
