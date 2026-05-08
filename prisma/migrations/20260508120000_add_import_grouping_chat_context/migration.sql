-- Story 24.7: extend ChatContextType enum with IMPORT_GROUPING so the
-- granska-page grouping proposer can write per-call LLM telemetry to
-- ChatUsageEvent without colliding with the matcher (IMPORT_MATCHING) or
-- chat contexts (GLOBAL/TASK/LAW/CHANGE).
--
-- Mirrors the pattern from 20260507140000_add_import_matching_chat_context.
-- Additive enum value — zero impact on existing rows or callers.

ALTER TYPE "ChatContextType" ADD VALUE IF NOT EXISTS 'IMPORT_GROUPING';
