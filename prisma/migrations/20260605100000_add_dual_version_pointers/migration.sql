-- Story 17.16: Dual-Version Document Model + Dispatch Refactor (Foundation)
--
-- Adds the Model B dual-pointer schema to WorkspaceDocument and per-version
-- approval audit timestamps to WorkspaceDocumentVersion. Backfills the three
-- pre-existing data shapes (APPROVED, DRAFT/IN_REVIEW-with-history,
-- DRAFT/IN_REVIEW-never-approved) plus ARCHIVED/SUPERSEDED via a two-pass
-- timestamp-driven algorithm correlated to ActivityLog (NOT version_number
-- arithmetic — that approach silently mis-handles any doc edited >1× since
-- branching).
--
-- All changes are ADDITIVE — zero column drops, zero renames, zero changes to
-- existing relations. The deprecated `current_version_id` alias stays in place
-- throughout this epic; Story 17.16's `createDraftFromApproved` / `saveDocumentVersion`
-- refactors freeze it on the approved version during draft windows so 17.10b
-- auto-reindex keeps grounding `[Källa:]` in approved content (compliance-safe
-- baseline). Story 17.18 will eventually migrate every read site off the alias
-- and drop it as a follow-up cleanup.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).
-- Recommend applying to a Supabase preview-env snapshot first; the backfill
-- assertions abort the transaction if any inconsistency is detected.

-- ============================================================================
-- DDL: enum + columns + indexes + FK constraints (Prisma-generated style)
-- ============================================================================

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'IN_REVIEW');

-- AlterTable: workspace_documents — add dual pointers + draft_status
ALTER TABLE "workspace_documents" ADD COLUMN "current_approved_version_id" TEXT;
ALTER TABLE "workspace_documents" ADD COLUMN "current_draft_version_id" TEXT;
ALTER TABLE "workspace_documents" ADD COLUMN "draft_status" "DraftStatus";

-- AlterTable: workspace_document_versions — add per-version audit timestamps
ALTER TABLE "workspace_document_versions" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "workspace_document_versions" ADD COLUMN "approved_by" TEXT;
ALTER TABLE "workspace_document_versions" ADD COLUMN "superseded_at" TIMESTAMP(3);

-- CreateIndex (unique on the two pointer columns — a version row can only be
-- "the current X" for at most one doc)
CREATE UNIQUE INDEX "workspace_documents_current_approved_version_id_key"
  ON "workspace_documents"("current_approved_version_id");
CREATE UNIQUE INDEX "workspace_documents_current_draft_version_id_key"
  ON "workspace_documents"("current_draft_version_id");

-- CreateIndex (secondary indexes for the new query paths)
CREATE INDEX "workspace_documents_workspace_id_current_draft_version_id_idx"
  ON "workspace_documents"("workspace_id", "current_draft_version_id");
CREATE INDEX "workspace_document_versions_document_id_approved_at_idx"
  ON "workspace_document_versions"("document_id", "approved_at");

-- AddForeignKey
ALTER TABLE "workspace_documents"
  ADD CONSTRAINT "workspace_documents_current_approved_version_id_fkey"
  FOREIGN KEY ("current_approved_version_id")
  REFERENCES "workspace_document_versions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_documents"
  ADD CONSTRAINT "workspace_documents_current_draft_version_id_fkey"
  FOREIGN KEY ("current_draft_version_id")
  REFERENCES "workspace_document_versions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_document_versions"
  ADD CONSTRAINT "workspace_document_versions_approved_by_fkey"
  FOREIGN KEY ("approved_by")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- BACKFILL: two-pass timestamp-driven (AC 3)
-- Wrapped in a single transaction with row-count assertions at the end.
-- Idempotent: re-running is safe (UPDATEs use guards that exclude already-
-- populated rows).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PASS 1 — Per-version approved_at / approved_by stamping from ActivityLog
-- ----------------------------------------------------------------------------
-- For each version v, find the most recent ActivityLog row matching:
--   entity_type = 'workspace_document'
--   entity_id   = v.document_id
--   action      = 'document_status_changed'
--   new_value->>'status' = 'APPROVED'
-- whose created_at falls in the version's time interval
-- [v.created_at, next_version.created_at), or [v.created_at, NOW()) for the
-- latest version of the doc.
--
-- ActivityLog payload shape verified by SM rigor pass: updateDocumentStatus
-- writes new_value: { status: 'X', comment?: '...' } directly (no wrapping).

WITH version_intervals AS (
  SELECT
    v.id AS version_id,
    v.document_id,
    v.created_at AS v_start,
    COALESCE(
      LEAD(v.created_at) OVER (
        PARTITION BY v.document_id ORDER BY v.version_number
      ),
      NOW()
    ) AS v_end
  FROM "workspace_document_versions" v
),
approval_events_in_interval AS (
  SELECT DISTINCT ON (vi.version_id)
    vi.version_id,
    al.created_at AS approved_at,
    al.user_id    AS approved_by
  FROM version_intervals vi
  JOIN "activity_logs" al
    ON al."entity_type" = 'workspace_document'
   AND al."entity_id"   = vi.document_id
   AND al."action"      = 'document_status_changed'
   AND al."new_value"->>'status' = 'APPROVED'
   AND al."created_at" >= vi.v_start
   AND al."created_at" <  vi.v_end
  ORDER BY vi.version_id, al."created_at" ASC
)
UPDATE "workspace_document_versions" wdv
SET
  "approved_at" = aei.approved_at,
  "approved_by" = aei.approved_by
FROM approval_events_in_interval aei
WHERE wdv."id" = aei.version_id
  AND wdv."approved_at" IS NULL;

-- Stamp superseded_at for any version that was approved AND has a later
-- approved version on the same doc (i.e., the next-approved replaced it).
UPDATE "workspace_document_versions" wdv
SET "superseded_at" = (
  SELECT MIN(v2."approved_at")
  FROM "workspace_document_versions" v2
  WHERE v2."document_id" = wdv."document_id"
    AND v2."approved_at" IS NOT NULL
    AND v2."approved_at" > wdv."approved_at"
)
WHERE wdv."approved_at"   IS NOT NULL
  AND wdv."superseded_at" IS NULL;

-- ----------------------------------------------------------------------------
-- PASS 2 — Pointer population from stamped timestamps + doc-state
-- ----------------------------------------------------------------------------

-- Case (a) — APPROVED docs: current_approved_version_id = current_version_id.
UPDATE "workspace_documents"
SET "current_approved_version_id" = "current_version_id"
WHERE "status" = 'APPROVED'
  AND "current_version_id"        IS NOT NULL
  AND "current_approved_version_id" IS NULL;

-- Case (a) followup — if Pass 1 didn't catch the current version's approval
-- (e.g., legacy data with no ActivityLog row for it), stamp from the doc's
-- denormalized approved_at / approved_by so Pass 1 + Pass 2 produce a complete
-- per-version audit history.
UPDATE "workspace_document_versions" wdv
SET
  "approved_at" = wd."approved_at",
  "approved_by" = wd."approved_by"
FROM "workspace_documents" wd
WHERE wd."current_version_id" = wdv."id"
  AND wd."status"             = 'APPROVED'
  AND wd."approved_at"        IS NOT NULL
  AND wdv."approved_at"       IS NULL;

-- Case (b) — DRAFT/IN_REVIEW with at least one historical APPROVED version:
-- split into both pointers. current_approved = most-recent approved version
-- (timestamp-driven, NOT current_version_number arithmetic — that approach
-- breaks for any doc edited >1× since branching).
UPDATE "workspace_documents" wd
SET
  "current_approved_version_id" = (
    SELECT v."id"
    FROM "workspace_document_versions" v
    WHERE v."document_id"   = wd."id"
      AND v."approved_at"   IS NOT NULL
    ORDER BY v."approved_at" DESC
    LIMIT 1
  ),
  "current_draft_version_id" = wd."current_version_id",
  "draft_status" = CASE
    WHEN wd."status" = 'DRAFT'     THEN 'DRAFT'::"DraftStatus"
    WHEN wd."status" = 'IN_REVIEW' THEN 'IN_REVIEW'::"DraftStatus"
  END
WHERE wd."status" IN ('DRAFT', 'IN_REVIEW')
  AND wd."current_version_id"          IS NOT NULL
  AND wd."current_approved_version_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "workspace_document_versions" v
    WHERE v."document_id" = wd."id"
      AND v."approved_at" IS NOT NULL
  );

-- Case (c) — DRAFT/IN_REVIEW never-approved: only draft pointer populated.
UPDATE "workspace_documents" wd
SET
  "current_draft_version_id" = wd."current_version_id",
  "draft_status" = CASE
    WHEN wd."status" = 'DRAFT'     THEN 'DRAFT'::"DraftStatus"
    WHEN wd."status" = 'IN_REVIEW' THEN 'IN_REVIEW'::"DraftStatus"
  END
WHERE wd."status" IN ('DRAFT', 'IN_REVIEW')
  AND wd."current_version_id"       IS NOT NULL
  AND wd."current_draft_version_id" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "workspace_document_versions" v
    WHERE v."document_id" = wd."id"
      AND v."approved_at" IS NOT NULL
  );

-- Case (d) — ARCHIVED / SUPERSEDED: anchor at current_version_id as the
-- historical "what was effective when archived" marker. No draft expected.
UPDATE "workspace_documents"
SET "current_approved_version_id" = "current_version_id"
WHERE "status" IN ('ARCHIVED', 'SUPERSEDED')
  AND "current_version_id"          IS NOT NULL
  AND "current_approved_version_id" IS NULL;

-- ----------------------------------------------------------------------------
-- ASSERTIONS — refuse commit if backfill is incomplete (AC 3)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  bad_alias_no_pointers INT;
  bad_caseb_partial     INT;
BEGIN
  -- (1) No doc with a populated alias has both new pointers null.
  SELECT COUNT(*) INTO bad_alias_no_pointers
  FROM "workspace_documents"
  WHERE "current_version_id"          IS NOT NULL
    AND "current_approved_version_id" IS NULL
    AND "current_draft_version_id"    IS NULL;

  IF bad_alias_no_pointers > 0 THEN
    RAISE EXCEPTION
      'Backfill incomplete (assertion 1): % docs have current_version_id set but both new pointers null. '
      'These are likely status=DRAFT/IN_REVIEW rows whose ActivityLog history could not be unambiguously '
      'correlated. Inspect via: '
      'SELECT id, workspace_id, status, current_version_id FROM workspace_documents '
      'WHERE current_version_id IS NOT NULL AND current_approved_version_id IS NULL AND current_draft_version_id IS NULL;',
      bad_alias_no_pointers;
  END IF;

  -- (2) Every case-(b)-eligible doc has BOTH new pointers populated.
  SELECT COUNT(*) INTO bad_caseb_partial
  FROM "workspace_documents" wd
  WHERE wd."status" IN ('DRAFT', 'IN_REVIEW')
    AND EXISTS (
      SELECT 1
      FROM "workspace_document_versions" v
      WHERE v."document_id" = wd."id"
        AND v."approved_at" IS NOT NULL
    )
    AND (wd."current_approved_version_id" IS NULL
         OR wd."current_draft_version_id" IS NULL);

  IF bad_caseb_partial > 0 THEN
    RAISE EXCEPTION
      'Backfill incomplete (assertion 2): % case-(b)-eligible docs have one of the dual pointers missing. '
      'Inspect via the same WHERE clause as the assertion.',
      bad_caseb_partial;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION WARNING ENUMERATION
-- ============================================================================
-- Pass-1 rows where ActivityLog correlation failed (no clean match in the
-- version's time interval) will have approved_at IS NULL even though their
-- parent doc is APPROVED. Engineer should run the following enumeration query
-- on the Supabase preview-env BEFORE applying to production, and hand-resolve
-- each row (typically a tiny set on a brownfield codebase):
--
--   SELECT v.id, v.document_id, v.version_number, wd.title, wd.workspace_id
--   FROM workspace_document_versions v
--   JOIN workspace_documents wd ON wd.id = v.document_id
--   WHERE v.approved_at IS NULL
--     AND v.id IN (
--       SELECT current_version_id FROM workspace_documents WHERE status = 'APPROVED'
--     );
--
-- For rows surfaced this way, either:
--   - Stamp manually from the doc's denormalized approved_at / approved_by, OR
--   - File a follow-up ticket and accept null per-version audit for that
--     specific historical version.
