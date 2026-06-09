-- Story 14.24: Draft styrdokument approval — eighth pending-action type.
-- Additive migration — enum-value additions ONLY. Zero table changes, zero
-- DROP / ALTER COLUMN / RENAME. Extends "PendingAgentActionType" with
-- DRAFT_DOCUMENT and "PendingAgentActionStatus" with IN_EDITOR.
--
-- PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE; existing rows are untouched,
-- so this is backward-compatible. Mirrors the 14.23 additive-enum migration.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterEnum
ALTER TYPE "PendingAgentActionType" ADD VALUE 'DRAFT_DOCUMENT';

-- AlterEnum
ALTER TYPE "PendingAgentActionStatus" ADD VALUE 'IN_EDITOR';
