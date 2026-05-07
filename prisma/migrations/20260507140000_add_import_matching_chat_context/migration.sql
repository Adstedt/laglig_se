-- Story 24.3: extend ChatContextType enum with IMPORT_MATCHING so the matcher
-- can write per-row LLM telemetry to ChatUsageEvent without colliding with
-- chat contexts (GLOBAL/TASK/LAW/CHANGE).
--
-- Story AC 14 stated this column was a plain String (no migration needed).
-- Verified during 24.3 dev that it is actually the Prisma enum ChatContextType
-- (verified via prisma/schema.prisma `enum ChatContextType { GLOBAL TASK LAW CHANGE }`).
-- This migration extends the enum additively — zero impact on existing rows
-- or callers (chat route still uses the four pre-existing values).

ALTER TYPE "ChatContextType" ADD VALUE IF NOT EXISTS 'IMPORT_MATCHING';
