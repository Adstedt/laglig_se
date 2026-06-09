-- Story 14.23: Extended approval types + batch + sidebar decommission.
-- Additive migration — enum-value additions ONLY. Zero table changes, zero
-- DROP / ALTER COLUMN / RENAME. Extends "PendingAgentActionType" with the four
-- new write-action types (link ×2, obligation, assign) plus the two migrated
-- sidebar write-preview tools (add context note, update compliance status).
--
-- PostgreSQL 12+ allows multiple ALTER TYPE ... ADD VALUE in one migration
-- (Supabase runs PG 15). Each value is appended to the existing enum; existing
-- rows (CREATE_TASK) are untouched, so this is backward-compatible.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterEnum
ALTER TYPE "PendingAgentActionType" ADD VALUE 'ADD_CONTEXT_NOTE';
ALTER TYPE "PendingAgentActionType" ADD VALUE 'ADD_OBLIGATION';
ALTER TYPE "PendingAgentActionType" ADD VALUE 'ASSIGN_TASK';
ALTER TYPE "PendingAgentActionType" ADD VALUE 'LINK_DOCUMENT_TO_TASK';
ALTER TYPE "PendingAgentActionType" ADD VALUE 'LINK_TASK_TO_DOCUMENT';
ALTER TYPE "PendingAgentActionType" ADD VALUE 'UPDATE_COMPLIANCE_STATUS';
