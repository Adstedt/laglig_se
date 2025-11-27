-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('SFS_LAW', 'COURT_CASE_AD', 'COURT_CASE_HD', 'COURT_CASE_HOVR', 'COURT_CASE_HFD', 'COURT_CASE_MOD', 'COURT_CASE_MIG', 'EU_REGULATION', 'EU_DIRECTIVE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'REPEALED', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SummaryGeneratedBy" AS ENUM ('GPT_4', 'HUMAN', 'SFSR', 'RIKSDAGEN');

-- CreateEnum
CREATE TYPE "AmendmentDetectedMethod" AS ENUM ('RIKSDAGEN_TEXT_PARSING', 'LAGEN_NU_SCRAPING', 'SFSR_REGISTER', 'LAGRUMMET_RINFO');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('CITES', 'IMPLEMENTS', 'AMENDS', 'REFERENCES', 'RELATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "org_number" TEXT,
    "company_legal_name" TEXT,
    "sni_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "full_text" TEXT,
    "effective_date" TIMESTAMP(3),
    "publication_date" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_url" TEXT NOT NULL,
    "metadata" JSONB,
    "search_vector" tsvector,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_cases" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "court_name" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "lower_court" TEXT,
    "decision_date" TIMESTAMP(3) NOT NULL,
    "parties" JSONB,

    CONSTRAINT "court_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eu_documents" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "celex_number" TEXT NOT NULL,
    "eut_reference" TEXT,
    "national_implementation_measures" JSONB,

    CONSTRAINT "eu_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_references" (
    "id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "target_document_id" TEXT NOT NULL,
    "reference_type" "ReferenceType" NOT NULL,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amendments" (
    "id" TEXT NOT NULL,
    "base_document_id" TEXT NOT NULL,
    "amending_document_id" TEXT NOT NULL,
    "amending_law_title" TEXT NOT NULL,
    "publication_date" TIMESTAMP(3) NOT NULL,
    "effective_date" TIMESTAMP(3),
    "affected_sections_raw" TEXT,
    "affected_sections" JSONB,
    "summary" TEXT,
    "summary_generated_by" "SummaryGeneratedBy",
    "detected_method" "AmendmentDetectedMethod",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_subjects" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "subject_code" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_org_number_key" ON "workspaces"("org_number");

-- CreateIndex
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "workspaces_org_number_idx" ON "workspaces"("org_number");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_user_id_workspace_id_key" ON "workspace_members"("user_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_document_number_key" ON "legal_documents"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_slug_key" ON "legal_documents"("slug");

-- CreateIndex
CREATE INDEX "legal_documents_document_number_idx" ON "legal_documents"("document_number");

-- CreateIndex
CREATE INDEX "legal_documents_slug_idx" ON "legal_documents"("slug");

-- CreateIndex
CREATE INDEX "legal_documents_content_type_idx" ON "legal_documents"("content_type");

-- CreateIndex
CREATE INDEX "legal_documents_status_idx" ON "legal_documents"("status");

-- CreateIndex
CREATE INDEX "legal_documents_search_vector_idx" ON "legal_documents"("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "court_cases_document_id_key" ON "court_cases"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "eu_documents_document_id_key" ON "eu_documents"("document_id");

-- CreateIndex
CREATE INDEX "cross_references_source_document_id_idx" ON "cross_references"("source_document_id");

-- CreateIndex
CREATE INDEX "cross_references_target_document_id_idx" ON "cross_references"("target_document_id");

-- CreateIndex
CREATE INDEX "amendments_base_document_id_idx" ON "amendments"("base_document_id");

-- CreateIndex
CREATE INDEX "amendments_amending_document_id_idx" ON "amendments"("amending_document_id");

-- CreateIndex
CREATE INDEX "amendments_effective_date_idx" ON "amendments"("effective_date");

-- CreateIndex
CREATE INDEX "document_subjects_document_id_idx" ON "document_subjects"("document_id");

-- CreateIndex
CREATE INDEX "document_subjects_subject_code_idx" ON "document_subjects"("subject_code");

-- CreateIndex
CREATE UNIQUE INDEX "document_subjects_document_id_subject_code_key" ON "document_subjects"("document_id", "subject_code");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_cases" ADD CONSTRAINT "court_cases_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eu_documents" ADD CONSTRAINT "eu_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_target_document_id_fkey" FOREIGN KEY ("target_document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_base_document_id_fkey" FOREIGN KEY ("base_document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_amending_document_id_fkey" FOREIGN KEY ("amending_document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_subjects" ADD CONSTRAINT "document_subjects_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
