-- Story 21.26 — Collapse SEAL into AVSLUTAD as terminal active state
--
-- Lifecycle simplifies from PLANERAD → PAGAENDE → AVSLUTAD → SEALED → ARKIVERAD
-- to PLANERAD → PAGAENDE → AVSLUTAD → ARKIVERAD. AVSLUTAD takes over what
-- SEALED used to do (lock items, populate sealed_at + sealed_by, generate PDF).
--
-- The cryptographic seal_hash ceremony is removed entirely — defensibility
-- relies on activity log + DB write history + signed PDF. Per PO call:
-- Nordic regulators (AML, AFS 2001:1, ISO certifying bodies) don't require
-- tamper-evidence hashes; the column adds maintenance overhead with no
-- regulatory or customer-visible value.
--
-- Existing data preservation:
--   - SEALED cycles convert to AVSLUTAD; sealed_at + sealed_by_user_id retained
--   - seal_hash column is dropped; historical hash values are NOT preserved
--   - SEALED-kind audit reports either delete (if a COMPLETE row exists for
--     the same cycle) or convert to COMPLETE (preserving PDF retrievability)
--   - compliance_evidence_snapshots table dropped entirely (sealCycle was its
--     only writer)
--
-- This migration is destructive in the sense that seal_hash + the snapshots
-- table are gone forever. Run a SELECT count(*) for these BEFORE applying
-- (see README.md in this folder for pre-flight queries).

BEGIN;

-- =============================================================================
-- Step 1: Convert all SEALED cycles to AVSLUTAD
-- =============================================================================
-- Status flips; sealed_at / sealed_by_user_id / seal_hash columns retained
-- through this step (they're dropped or repurposed in later steps).

UPDATE "compliance_audit_cycles"
SET "status" = 'AVSLUTAD'
WHERE "status" = 'SEALED';

-- =============================================================================
-- Step 2: Drop SEALED from the ComplianceCycleStatus enum
-- =============================================================================
-- Postgres can't DROP a single enum value, so the standard dance:
--   1. Drop the column DEFAULT (the existing default 'PLANERAD' references
--      the old enum type, which would prevent auto-casting during ALTER COLUMN
--      and produce error 42804: "default for column ... cannot be cast
--      automatically to type ...").
--   2. Rename the existing type → create a new type without SEALED → ALTER
--      COLUMN to use the new type → drop the old type.
--   3. Re-add the default referencing the new type.

ALTER TABLE "compliance_audit_cycles"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ComplianceCycleStatus" RENAME TO "ComplianceCycleStatus_old";

CREATE TYPE "ComplianceCycleStatus" AS ENUM (
  'PLANERAD',
  'PAGAENDE',
  'AVSLUTAD',
  'ARKIVERAD'
);

ALTER TABLE "compliance_audit_cycles"
  ALTER COLUMN "status" TYPE "ComplianceCycleStatus"
  USING "status"::text::"ComplianceCycleStatus";

ALTER TABLE "compliance_audit_cycles"
  ALTER COLUMN "status" SET DEFAULT 'PLANERAD';

DROP TYPE "ComplianceCycleStatus_old";

-- =============================================================================
-- Step 3: Drop the seal_hash column
-- =============================================================================
-- The cryptographic ceremony goes away. sealed_at + sealed_by_user_id stay —
-- they now record completion (was: sealing) timestamp + actor.

ALTER TABLE "compliance_audit_cycles"
  DROP COLUMN "seal_hash";

-- =============================================================================
-- Step 4: Reconcile compliance_audit_reports — handle COMPLETE/SEALED conflicts
-- =============================================================================
-- The (cycle_id, report_kind) unique constraint forbids duplicates. If a cycle
-- has BOTH a COMPLETE row and a SEALED row (legacy: SEALED row supersedes
-- COMPLETE in the user-facing flow), we keep COMPLETE because the new app-level
-- code only reads COMPLETE-kind. The SEALED row's pdf_storage_path orphans in
-- Supabase Storage — that's acceptable (file deletion gates were SEALED-aware
-- and are dropped in this story too).

DELETE FROM "compliance_audit_reports" cr1
WHERE cr1."report_kind" = 'SEALED'
  AND EXISTS (
    SELECT 1 FROM "compliance_audit_reports" cr2
    WHERE cr2."cycle_id" = cr1."cycle_id"
      AND cr2."report_kind" = 'COMPLETE'
  );

-- For cycles that had ONLY a SEALED row, convert it to COMPLETE so the PDF
-- stays retrievable. (Their pdf_storage_path is preserved.)
UPDATE "compliance_audit_reports"
SET "report_kind" = 'COMPLETE'
WHERE "report_kind" = 'SEALED';

-- =============================================================================
-- Step 5: Drop SEALED from the ReportKind enum
-- =============================================================================
-- Same enum-rename dance as Step 2. Defensive DROP DEFAULT in case the
-- report_kind column has a default referencing the old type (the schema's
-- current default is unclear; this is harmless if there isn't one — it just
-- becomes a no-op).

ALTER TABLE "compliance_audit_reports"
  ALTER COLUMN "report_kind" DROP DEFAULT;

ALTER TYPE "ReportKind" RENAME TO "ReportKind_old";

CREATE TYPE "ReportKind" AS ENUM (
  'COMPLETE'
);

ALTER TABLE "compliance_audit_reports"
  ALTER COLUMN "report_kind" TYPE "ReportKind"
  USING "report_kind"::text::"ReportKind";

DROP TYPE "ReportKind_old";

-- =============================================================================
-- Step 6: Drop the compliance_evidence_snapshots table
-- =============================================================================
-- The only writer was sealCycle's gather-seal-evidence path, which goes away.
-- CASCADE removes any dependent objects (FKs out of this table; nothing should
-- depend ON it).

DROP TABLE IF EXISTS "compliance_evidence_snapshots" CASCADE;

COMMIT;
