-- Story 21.27 — Collapse ARKIVERAD into AVSLUTAD (3-state lifecycle).
--
-- Lifecycle goes from {PLANERAD, PAGAENDE, AVSLUTAD, ARKIVERAD} to
-- {PLANERAD, PAGAENDE, AVSLUTAD}. ARKIVERAD had no UI transition (only
-- direct DB writes could land a cycle there) and the only behavioral
-- difference vs AVSLUTAD was that ARKIVERAD locked findings — a phantom
-- state for SMB self-audit. See docs/stories/21.27.collapse-arkiverad-into-avslutad.md.
--
-- Pre-flight check: run this first and confirm the count.
--   SELECT count(*) FROM compliance_audit_cycles WHERE status = 'ARKIVERAD';
-- If non-zero, Step 1 below converts those rows to AVSLUTAD (semantically
-- nearest — they were already terminal+frozen). If zero, Step 1 is a no-op.

BEGIN;

-- Step 1: Fold any ARKIVERAD rows into AVSLUTAD. Preserves sealed_at +
-- sealed_by_user_id metadata (those columns aren't touched).
UPDATE compliance_audit_cycles SET status = 'AVSLUTAD' WHERE status = 'ARKIVERAD';

-- Step 2: Drop the DEFAULT before the enum surgery. Required to avoid
-- error 42804 — "default for column cannot be cast automatically to type"
-- (same Postgres quirk that bit us in migration 20260427160000).
ALTER TABLE compliance_audit_cycles ALTER COLUMN status DROP DEFAULT;

-- Step 3: Standard enum-rewrite dance — rename the old type, create the
-- narrowed new one, ALTER COLUMN with USING cast through text, drop old.
ALTER TYPE "ComplianceCycleStatus" RENAME TO "ComplianceCycleStatus_old";

CREATE TYPE "ComplianceCycleStatus" AS ENUM ('PLANERAD', 'PAGAENDE', 'AVSLUTAD');

ALTER TABLE compliance_audit_cycles
  ALTER COLUMN status TYPE "ComplianceCycleStatus"
  USING status::text::"ComplianceCycleStatus";

DROP TYPE "ComplianceCycleStatus_old";

-- Step 4: Re-set the DEFAULT now that the new type is in place.
ALTER TABLE compliance_audit_cycles ALTER COLUMN status SET DEFAULT 'PLANERAD';

COMMIT;

-- Post-migration sanity:
--   SELECT enum_range(NULL::"ComplianceCycleStatus");
--     -- Expected: {PLANERAD, PAGAENDE, AVSLUTAD}
--   SELECT DISTINCT status FROM compliance_audit_cycles ORDER BY status;
--     -- Expected: subset of {PLANERAD, PAGAENDE, AVSLUTAD}
