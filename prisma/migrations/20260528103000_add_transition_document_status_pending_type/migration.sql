-- Story 14.30: agent-proposed styrdokument status transition flows through the
-- inline approval card as the 11th PendingAgentAction type. The
-- transition_document_status tool creates a TRANSITION_DOCUMENT_STATUS
-- proposal; on approval, dispatch calls the existing updateDocumentStatus
-- server action (app/actions/documents.ts).
--
-- Separation-of-duties: the agent NEVER proposes newStatus = APPROVED. The
-- guard is enforced at TWO layers (tool refusal + dispatch refusal as the
-- authoritative gate). This migration only adds the enum value; the guard
-- lives in TypeScript.
--
-- Additive ONLY: a single enum-value addition. Zero table / column / index
-- change. Backward-compatible — existing rows are untouched.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterEnum
-- (PostgreSQL 12+ allows ADD VALUE in a transaction as long as the new value is
--  not USED in the same migration — it isn't here.)
ALTER TYPE "PendingAgentActionType" ADD VALUE 'TRANSITION_DOCUMENT_STATUS';
