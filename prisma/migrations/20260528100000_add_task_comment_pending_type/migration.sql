-- Story 14.29: agent-proposed task comment flows through the inline approval
-- card as the 10th PendingAgentAction type. The add_task_comment tool creates
-- an ADD_TASK_COMMENT proposal; on approval, dispatch calls the existing
-- createComment server action (app/actions/task-modal.ts).
--
-- Additive ONLY: a single enum-value addition. Zero table / column / index
-- change. Backward-compatible — existing rows are untouched.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterEnum
-- (PostgreSQL 12+ allows ADD VALUE in a transaction as long as the new value is
--  not USED in the same migration — it isn't here.)
ALTER TYPE "PendingAgentActionType" ADD VALUE 'ADD_TASK_COMMENT';
