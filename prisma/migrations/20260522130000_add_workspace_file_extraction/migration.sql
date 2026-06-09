-- Story 17.8: Uploaded-file ingestion — extraction fields on workspace_files,
-- the FileExtractionStatus enum, and the FILE_EXTRACTION telemetry context.
--
-- Additive ONLY: one new enum, four new nullable/defaulted columns, one enum-value
-- addition. Zero DROP / RENAME / ALTER COLUMN. Backward-compatible — existing rows
-- are untouched except the deliberate backfill below.
--
-- NOTE: applied manually by the developer (do not auto-apply / reset).

-- CreateEnum
CREATE TYPE "FileExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'EMPTY', 'UNSUPPORTED', 'ENCRYPTED', 'FAILED');

-- AlterEnum
-- (PostgreSQL 12+ allows ADD VALUE in a transaction as long as the new value is
--  not USED in the same migration — it isn't here.)
ALTER TYPE "ChatContextType" ADD VALUE 'FILE_EXTRACTION';

-- AlterTable
ALTER TABLE "workspace_files"
  ADD COLUMN "extracted_text"    TEXT,
  ADD COLUMN "extraction_status" "FileExtractionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "extracted_at"      TIMESTAMP(3),
  ADD COLUMN "content_hash"      TEXT;

-- Backfill (Story 17.8 AC 2): pre-existing files must NOT be auto-extracted, or
-- the first extract-files cron run would mass-LLM-extract the entire historical
-- corpus. Flip every row that exists at migration time to UNSUPPORTED; only NEW
-- uploads (inserted after this migration) start at the PENDING default. A
-- deliberate one-off re-enqueue script can opt historical files back in later.
UPDATE "workspace_files" SET "extraction_status" = 'UNSUPPORTED';
