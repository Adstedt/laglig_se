-- Story 17.10b: cron-sweep debounce flags for DRAFT autosave reindex.
--
-- The 17.10b indexing model expands from APPROVED-only (17.9b) to
-- DRAFT/IN_REVIEW/APPROVED. Content changes (autosaves, explicit checkpoints)
-- are the reindex trigger — not status transitions. DRAFT autosaves fire
-- frequently while editing, so we debounce: autosave marks the doc dirty;
-- a 1-minute cron sweep picks up rows where the dirty-mark has aged past
-- DRAFT_REINDEX_DEBOUNCE_MS (60 seconds) and re-embeds, clearing the flag.
--
-- Two additive nullable columns + one composite index. NOT NULL DEFAULT FALSE
-- on `needs_reindex` is safe for the existing rows (they start clean).
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterTable
ALTER TABLE "workspace_documents"
  ADD COLUMN "needs_reindex" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "last_marked_dirty_at" TIMESTAMP(3);

-- CreateIndex
-- Speeds the cron sweep predicate: WHERE needs_reindex = true AND last_marked_dirty_at <= NOW() - INTERVAL '60 seconds'.
-- Postgres can use the leading boolean to skip the bulk of (false) rows quickly.
CREATE INDEX "workspace_documents_needs_reindex_last_marked_dirty_at_idx"
  ON "workspace_documents" ("needs_reindex", "last_marked_dirty_at");
