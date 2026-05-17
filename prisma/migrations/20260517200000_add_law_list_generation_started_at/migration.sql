-- Story 25.3 polish: server-derived start timestamp for the law-list
-- generation, used by <ProgressStrip> to compute an asymptotic % progress
-- and (future) by B.4's done-state UI to show "Klart på Xm Ys".
--
-- Purely additive — single nullable TIMESTAMP(3) column on Workspace.
-- Existing rows stay valid (NULL). The atomic claim in
-- app/api/workspace/generate-law-list/route.ts will write NOW() on every
-- successful generation kickoff; the value gets overwritten on each re-run.

ALTER TABLE "workspaces"
  ADD COLUMN "law_list_generation_started_at" TIMESTAMP(3);
