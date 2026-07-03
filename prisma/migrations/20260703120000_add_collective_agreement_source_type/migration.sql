-- Story 7.5: Kollektivavtal upload + RAG ingest — SourceType value for
-- workspace-isolated agreement chunks + optional giltighetsperiod columns.
--
-- Additive ONLY: one enum-value addition, two new nullable columns. Zero
-- DROP / RENAME / ALTER COLUMN. Backward-compatible — existing rows untouched.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- AlterEnum
-- (PostgreSQL 12+ allows ADD VALUE in a transaction as long as the new value is
--  not USED in the same migration — it isn't here.)
ALTER TYPE "SourceType" ADD VALUE 'COLLECTIVE_AGREEMENT';

-- AlterTable
ALTER TABLE "collective_agreements"
  ADD COLUMN "effective_from" TIMESTAMP(3),
  ADD COLUMN "effective_to"   TIMESTAMP(3);
