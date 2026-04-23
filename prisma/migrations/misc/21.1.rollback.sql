-- Story 21.1: Rollback for compliance audit cycle schema foundations.
-- Use this ONLY if the forward migration (21.1.migration.sql) caused a production incident
-- and the remedy is to restore the database to its pre-migration state.
--
-- Safe: no existing row (pre-migration) references any of the new structures.
-- Order: drop child objects before parents; drop FK-holding column on tasks before dropping target enum.
-- CASCADE handles attached foreign-key constraints and indexes automatically.

BEGIN;

-- Drop the 5 new tables in reverse FK dependency order.
-- CASCADE removes FK constraints (e.g. tasks.compliance_finding_id → compliance_findings.id) and indexes.
DROP TABLE IF EXISTS "compliance_audit_reports" CASCADE;
DROP TABLE IF EXISTS "compliance_evidence_snapshots" CASCADE;
DROP TABLE IF EXISTS "compliance_findings" CASCADE;
DROP TABLE IF EXISTS "compliance_audit_items" CASCADE;
DROP TABLE IF EXISTS "compliance_audit_cycles" CASCADE;

-- Drop the single back-reference column + index added to tasks.
-- The index tasks_compliance_finding_id_idx auto-drops with the column.
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "compliance_finding_id";

-- Drop the 7 new enums (in reverse creation order for tidiness).
DROP TYPE IF EXISTS "ReportKind";
DROP TYPE IF EXISTS "EvidenceKind";
DROP TYPE IF EXISTS "FindingSeverity";
DROP TYPE IF EXISTS "FindingType";
DROP TYPE IF EXISTS "EfterlevnadsBedomning";
DROP TYPE IF EXISTS "ComplianceCycleStatus";
DROP TYPE IF EXISTS "AuditType";

COMMIT;

-- After running this rollback:
-- 1. Verify no orphaned objects: SELECT typname FROM pg_type WHERE typname IN (
--      'AuditType', 'ComplianceCycleStatus', 'EfterlevnadsBedomning',
--      'FindingType', 'FindingSeverity', 'EvidenceKind', 'ReportKind'
--    );
--    (Should return zero rows.)
-- 2. Verify tasks.compliance_finding_id is gone: \d tasks
-- 3. Also revert the application code PR that introduced Story 21.1 changes
--    (git revert of the Story 21.1 commit(s) + pnpm install to remove canonicalize).
