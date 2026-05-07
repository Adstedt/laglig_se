-- Story 24.1: Epic 24 — Import existing law list, schema foundations.
-- Additive migration — introduces three new enums, three new tables, plus
-- additive back-reference relations. Zero DROP, zero ALTER COLUMN, zero
-- RENAME on any existing object. Mirrors the additive shape of
-- 20260427120000_add_finding_closure_metadata and the multi-model
-- precedent at 20260422090000_add_compliance_audit_cycle.
--
-- RLS: this project's canonical RLS pattern is documented in
-- 20260430120000_enable_rls_public_tables — every public table has RLS
-- enabled with no policies (default deny for non-bypass roles). Prisma
-- connects as the postgres role (BYPASSRLS), so server-side queries via
-- prisma.* are unaffected. The three new tables follow the same pattern
-- — see the ENABLE ROW LEVEL SECURITY block at the bottom of this file.

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'MATCHING', 'AWAITING_REVIEW', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "RowMatchStatus" AS ENUM ('PENDING', 'MATCHED_HIGH', 'MATCHED_MEDIUM', 'UNMATCHED', 'ACCEPTED_BY_USER', 'REPLACED_BY_USER', 'REJECTED_BY_USER', 'CATALOG_REQUEST_PENDING', 'CATALOG_REQUEST_FULFILLED');

-- CreateEnum
CREATE TYPE "CatalogRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "law_list_imports" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "column_mapping" JSONB NOT NULL,
    "committed_law_list_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "law_list_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "law_list_import_rows" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "source_titel" TEXT,
    "source_sfs_nummer" TEXT,
    "source_omrade" TEXT,
    "source_lagansvarig" TEXT,
    "source_kommentar" TEXT,
    "source_raw" JSONB NOT NULL,
    "match_status" "RowMatchStatus" NOT NULL DEFAULT 'PENDING',
    "matched_document_id" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "match_candidates" JSONB,
    "match_reasoning" TEXT,
    "user_decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "law_list_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_ingest_requests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "import_row_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "handler_user_id" TEXT,
    "fulfilled_with_document_id" TEXT,
    "admin_note" TEXT,
    "status" "CatalogRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),

    CONSTRAINT "catalog_ingest_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "law_list_imports_committed_law_list_id_key" ON "law_list_imports"("committed_law_list_id");

-- CreateIndex
CREATE INDEX "law_list_imports_workspace_id_status_idx" ON "law_list_imports"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "law_list_imports_created_by_user_id_idx" ON "law_list_imports"("created_by_user_id");

-- CreateIndex
CREATE INDEX "law_list_import_rows_import_id_match_status_idx" ON "law_list_import_rows"("import_id", "match_status");

-- CreateIndex
CREATE INDEX "law_list_import_rows_matched_document_id_idx" ON "law_list_import_rows"("matched_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_ingest_requests_import_row_id_key" ON "catalog_ingest_requests"("import_row_id");

-- CreateIndex
CREATE INDEX "catalog_ingest_requests_workspace_id_status_created_at_idx" ON "catalog_ingest_requests"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "catalog_ingest_requests_handler_user_id_idx" ON "catalog_ingest_requests"("handler_user_id");

-- AddForeignKey
ALTER TABLE "law_list_imports" ADD CONSTRAINT "law_list_imports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_list_imports" ADD CONSTRAINT "law_list_imports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_list_imports" ADD CONSTRAINT "law_list_imports_committed_law_list_id_fkey" FOREIGN KEY ("committed_law_list_id") REFERENCES "law_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_list_import_rows" ADD CONSTRAINT "law_list_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "law_list_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_list_import_rows" ADD CONSTRAINT "law_list_import_rows_matched_document_id_fkey" FOREIGN KEY ("matched_document_id") REFERENCES "legal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_ingest_requests" ADD CONSTRAINT "catalog_ingest_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_ingest_requests" ADD CONSTRAINT "catalog_ingest_requests_import_row_id_fkey" FOREIGN KEY ("import_row_id") REFERENCES "law_list_import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_ingest_requests" ADD CONSTRAINT "catalog_ingest_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_ingest_requests" ADD CONSTRAINT "catalog_ingest_requests_handler_user_id_fkey" FOREIGN KEY ("handler_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_ingest_requests" ADD CONSTRAINT "catalog_ingest_requests_fulfilled_with_document_id_fkey" FOREIGN KEY ("fulfilled_with_document_id") REFERENCES "legal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS on all three new tables (project pattern: see
-- 20260430120000_enable_rls_public_tables for the canonical reference).
-- RLS-enabled-no-policy = default deny for non-bypass roles. Prisma's
-- postgres role bypasses, so server-side queries are unaffected; this
-- closes the PostgREST/Realtime/anon-key access path.
ALTER TABLE "public"."law_list_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_import_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."catalog_ingest_requests" ENABLE ROW LEVEL SECURITY;
