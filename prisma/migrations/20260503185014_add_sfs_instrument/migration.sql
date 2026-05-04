-- Story 2.32: SFS Instrument Subtype & Filter (Lag vs Förordning)
--
-- Adds a derived `sfs_instrument` column on `legal_documents` that distinguishes
-- lag (parliament), förordning (government regulation), and kungörelse from each
-- other within SFS_LAW / SFS_AMENDMENT. Populated by `lib/sfs/instrument.ts` at
-- ingest and by a one-shot backfill script (`scripts/backfill-sfs-instrument.ts`)
-- for existing rows. ContentType enum is intentionally untouched.
--
-- Migration is additive-only (AC 3):
--   * Adds enum type `SfsInstrument`
--   * Adds NOT NULL column with `DEFAULT 'OTHER'` so existing rows are valid
--   * Adds a single BTREE index for filter performance
--
-- Operator note: this file is hand-curated. The raw `prisma migrate diff` output
-- also contained an unrelated `DROP INDEX content_chunks_embedding_idx` from
-- schema/db drift; it was stripped because Story 2.32 is additive-only. That
-- drift should be addressed in its own dedicated migration.

-- CreateEnum
CREATE TYPE "SfsInstrument" AS ENUM ('LAG', 'FORORDNING', 'KUNGORELSE', 'OTHER');

-- AlterTable
ALTER TABLE "legal_documents"
  ADD COLUMN "sfs_instrument" "SfsInstrument" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "idx_sfs_instrument" ON "legal_documents"("sfs_instrument");
