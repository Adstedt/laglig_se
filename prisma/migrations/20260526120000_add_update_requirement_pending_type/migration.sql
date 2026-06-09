-- Story 14.28: agent-proposed kravpunkt (LawListItemRequirement) edits flow
-- through the inline approval card as the 8th PendingAgentAction type. The
-- update_requirement tool creates an UPDATE_REQUIREMENT proposal; on approval,
-- dispatch calls the existing updateRequirement server action.
--
-- Additive ONLY: a single enum-value addition. Zero table / column / index
-- change. Backward-compatible — existing rows are untouched.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterEnum
-- (PostgreSQL 12+ allows ADD VALUE in a transaction as long as the new value is
--  not USED in the same migration — it isn't here.)
ALTER TYPE "PendingAgentActionType" ADD VALUE 'UPDATE_REQUIREMENT';
