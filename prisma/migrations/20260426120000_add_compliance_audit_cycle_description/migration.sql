-- Epic 21: add optional Bakgrund (description) free-text field to ComplianceAuditCycle.
-- Captures the auditor's stated context/purpose for the cycle. Surfaces in the cycle
-- detail header and as a "Bakgrund och syfte" section in the revisionsrapport.
-- Optional; existing rows remain NULL.
-- Apply via Supabase SQL Editor (user-applied-migration workflow established in Story 21.1).

-- AlterTable
ALTER TABLE "compliance_audit_cycles" ADD COLUMN "description" TEXT;
