-- Baseline migration for laglig.se database
-- This captures the existing schema state as of 2026-01-08

-- CreateExtension (vector for embeddings - this is a standard PostgreSQL extension)
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "public"."AmendmentDetectedMethod" AS ENUM ('RIKSDAGEN_TEXT_PARSING', 'LAGEN_NU_SCRAPING', 'SFSR_REGISTER', 'LAGRUMMET_RINFO');

-- CreateEnum
CREATE TYPE "public"."ChangeType" AS ENUM ('NEW_LAW', 'AMENDMENT', 'REPEAL', 'METADATA_UPDATE', 'NEW_RULING');

-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('SFS_LAW', 'COURT_CASE_AD', 'COURT_CASE_HD', 'COURT_CASE_HFD', 'COURT_CASE_HOVR', 'EU_REGULATION', 'EU_DIRECTIVE', 'COURT_CASE_MOD', 'COURT_CASE_MIG', 'SFS_AMENDMENT');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('ACTIVE', 'REPEALED', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."LawListItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."LawListItemSource" AS ENUM ('ONBOARDING', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "public"."LawListItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'COMPLIANT');

-- CreateEnum
CREATE TYPE "public"."LegislativeRefType" AS ENUM ('PROP', 'BET', 'RSKR', 'SOU', 'DS');

-- CreateEnum
CREATE TYPE "public"."ParseStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "public"."ReferenceType" AS ENUM ('CITES', 'IMPLEMENTS', 'AMENDS', 'REFERENCES', 'RELATED', 'LEGAL_BASIS');

-- CreateEnum
CREATE TYPE "public"."SectionChangeType" AS ENUM ('AMENDED', 'REPEALED', 'NEW', 'RENUMBERED');

-- CreateEnum
CREATE TYPE "public"."SubscriptionTier" AS ENUM ('TRIAL', 'SOLO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."SummaryGeneratedBy" AS ENUM ('GPT_4', 'HUMAN', 'SFSR', 'RIKSDAGEN');

-- CreateEnum
CREATE TYPE "public"."WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'HR_MANAGER', 'MEMBER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "public"."WorkspaceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED');

-- CreateTable
CREATE TABLE "public"."amendment_documents" (
    "id" TEXT NOT NULL,
    "sfs_number" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "base_law_sfs" TEXT NOT NULL,
    "base_law_name" TEXT,
    "title" TEXT,
    "effective_date" TIMESTAMP(3),
    "publication_date" TIMESTAMP(3),
    "full_text" TEXT,
    "parse_status" "public"."ParseStatus" NOT NULL DEFAULT 'PENDING',
    "parse_error" TEXT,
    "parsed_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "markdown_content" TEXT,

    CONSTRAINT "amendment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."amendments" (
    "id" TEXT NOT NULL,
    "base_document_id" TEXT NOT NULL,
    "amending_document_id" TEXT,
    "amending_law_title" TEXT NOT NULL,
    "publication_date" TIMESTAMP(3),
    "effective_date" TIMESTAMP(3),
    "affected_sections_raw" TEXT,
    "affected_sections" JSONB,
    "summary" TEXT,
    "summary_generated_by" "public"."SummaryGeneratedBy",
    "detected_method" "public"."AmendmentDetectedMethod",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "detected_from_version_id" TEXT,

    CONSTRAINT "amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."change_events" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content_type" "public"."ContentType" NOT NULL,
    "change_type" "public"."ChangeType" NOT NULL,
    "amendment_sfs" TEXT,
    "previous_version_id" TEXT,
    "new_version_id" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "diff_summary" TEXT,
    "changed_sections" JSONB,
    "ai_summary" TEXT,
    "ai_summary_generated_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."company_profiles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "sni_code" TEXT NOT NULL,
    "legal_form" TEXT NOT NULL,
    "employee_count" INTEGER NOT NULL,
    "address" TEXT,
    "contextual_answers" JSONB,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."court_cases" (
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
CREATE TABLE "public"."cross_references" (
    "id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "target_document_id" TEXT NOT NULL,
    "reference_type" "public"."ReferenceType" NOT NULL,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_subjects" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "subject_code" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "full_text" TEXT NOT NULL,
    "html_content" TEXT,
    "amendment_sfs" TEXT,
    "source_systemdatum" TIMESTAMP(3),
    "changed_sections" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."eu_documents" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "celex_number" TEXT NOT NULL,
    "eut_reference" TEXT,
    "national_implementation_measures" JSONB,
    "authors" TEXT[],
    "cites_celex" TEXT[],
    "directory_codes" TEXT[],
    "eea_relevant" BOOLEAN,
    "eli_identifier" TEXT,
    "end_of_validity" TIMESTAMP(3),
    "eurovoc_concepts" TEXT[],
    "in_force" BOOLEAN,
    "legal_basis_celex" TEXT[],
    "signature_date" TIMESTAMP(3),
    "subject_matters" TEXT[],
    "transposition_deadline" TIMESTAMP(3),
    "amended_by_celex" TEXT[],
    "corrected_by_celex" TEXT[],

    CONSTRAINT "eu_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."law_list_groups" (
    "id" TEXT NOT NULL,
    "law_list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "law_list_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."law_list_items" (
    "id" TEXT NOT NULL,
    "law_list_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "commentary" TEXT,
    "status" "public"."LawListItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "public"."LawListItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "source" "public"."LawListItemSource" NOT NULL DEFAULT 'MANUAL',
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_change_acknowledged_at" TIMESTAMP(3),
    "last_change_acknowledged_by" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "due_date" TIMESTAMP(3),
    "group_id" TEXT,

    CONSTRAINT "law_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."law_lists" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "law_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."law_sections" (
    "id" TEXT NOT NULL,
    "legal_document_id" TEXT NOT NULL,
    "chapter" TEXT,
    "section" TEXT NOT NULL,
    "html_content" TEXT NOT NULL,
    "text_content" TEXT NOT NULL,
    "heading" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "law_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."legal_documents" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content_type" "public"."ContentType" NOT NULL,
    "full_text" TEXT,
    "summary" TEXT,
    "effective_date" TIMESTAMP(3),
    "publication_date" TIMESTAMP(3),
    "source_url" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "embedding" vector(1536),
    "search_vector" tsvector,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "html_content" TEXT,
    "markdown_content" TEXT,
    "json_content" JSONB,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."legislative_refs" (
    "id" TEXT NOT NULL,
    "legal_document_id" TEXT NOT NULL,
    "ref_type" "public"."LegislativeRefType" NOT NULL,
    "reference" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legislative_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."section_changes" (
    "id" TEXT NOT NULL,
    "amendment_id" TEXT NOT NULL,
    "chapter" TEXT,
    "section" TEXT NOT NULL,
    "change_type" "public"."SectionChangeType" NOT NULL,
    "old_number" TEXT,
    "description" TEXT,
    "old_text" TEXT,
    "new_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "section_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "password_hash" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspace_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_at" TIMESTAMP(3),
    "invited_by" TEXT,
    "role" "public"."WorkspaceRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "org_number" TEXT,
    "company_legal_name" TEXT,
    "sni_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "company_logo" TEXT,
    "deleted_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "status" "public"."WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscription_tier" "public"."SubscriptionTier" NOT NULL DEFAULT 'TRIAL',
    "trial_ends_at" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "amendment_documents_base_law_sfs_idx" ON "public"."amendment_documents"("base_law_sfs" ASC);

-- CreateIndex
CREATE INDEX "amendment_documents_effective_date_idx" ON "public"."amendment_documents"("effective_date" ASC);

-- CreateIndex
CREATE INDEX "amendment_documents_parse_status_idx" ON "public"."amendment_documents"("parse_status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "amendment_documents_sfs_number_key" ON "public"."amendment_documents"("sfs_number" ASC);

-- CreateIndex
CREATE INDEX "amendments_amending_document_id_idx" ON "public"."amendments"("amending_document_id" ASC);

-- CreateIndex
CREATE INDEX "amendments_base_document_id_idx" ON "public"."amendments"("base_document_id" ASC);

-- CreateIndex
CREATE INDEX "amendments_effective_date_idx" ON "public"."amendments"("effective_date" ASC);

-- CreateIndex
CREATE INDEX "change_events_change_type_idx" ON "public"."change_events"("change_type" ASC);

-- CreateIndex
CREATE INDEX "change_events_content_type_idx" ON "public"."change_events"("content_type" ASC);

-- CreateIndex
CREATE INDEX "change_events_detected_at_idx" ON "public"."change_events"("detected_at" ASC);

-- CreateIndex
CREATE INDEX "change_events_document_id_idx" ON "public"."change_events"("document_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "company_profiles_workspace_id_key" ON "public"."company_profiles"("workspace_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "court_cases_document_id_key" ON "public"."court_cases"("document_id" ASC);

-- CreateIndex
CREATE INDEX "cross_references_source_document_id_idx" ON "public"."cross_references"("source_document_id" ASC);

-- CreateIndex
CREATE INDEX "cross_references_target_document_id_idx" ON "public"."cross_references"("target_document_id" ASC);

-- CreateIndex
CREATE INDEX "document_subjects_document_id_idx" ON "public"."document_subjects"("document_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "document_subjects_document_id_subject_code_key" ON "public"."document_subjects"("document_id" ASC, "subject_code" ASC);

-- CreateIndex
CREATE INDEX "document_subjects_subject_code_idx" ON "public"."document_subjects"("subject_code" ASC);

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "public"."document_versions"("document_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "public"."document_versions"("document_id" ASC, "version_number" ASC);

-- CreateIndex
CREATE INDEX "eu_documents_celex_number_idx" ON "public"."eu_documents"("celex_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "eu_documents_celex_number_key" ON "public"."eu_documents"("celex_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "eu_documents_document_id_key" ON "public"."eu_documents"("document_id" ASC);

-- CreateIndex
CREATE INDEX "eu_documents_eli_identifier_idx" ON "public"."eu_documents"("eli_identifier" ASC);

-- CreateIndex
CREATE INDEX "eu_documents_in_force_idx" ON "public"."eu_documents"("in_force" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "law_list_groups_law_list_id_name_key" ON "public"."law_list_groups"("law_list_id" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "law_list_groups_law_list_id_position_idx" ON "public"."law_list_groups"("law_list_id" ASC, "position" ASC);

-- CreateIndex
CREATE INDEX "law_list_items_document_id_idx" ON "public"."law_list_items"("document_id" ASC);

-- CreateIndex
CREATE INDEX "law_list_items_group_id_idx" ON "public"."law_list_items"("group_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "law_list_items_law_list_id_document_id_key" ON "public"."law_list_items"("law_list_id" ASC, "document_id" ASC);

-- CreateIndex
CREATE INDEX "law_list_items_law_list_id_idx" ON "public"."law_list_items"("law_list_id" ASC);

-- CreateIndex
CREATE INDEX "law_list_items_law_list_id_position_idx" ON "public"."law_list_items"("law_list_id" ASC, "position" ASC);

-- CreateIndex
CREATE INDEX "law_list_items_status_idx" ON "public"."law_list_items"("status" ASC);

-- CreateIndex
CREATE INDEX "law_lists_workspace_id_idx" ON "public"."law_lists"("workspace_id" ASC);

-- CreateIndex
CREATE INDEX "law_sections_chapter_section_idx" ON "public"."law_sections"("chapter" ASC, "section" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "law_sections_legal_document_id_chapter_section_key" ON "public"."law_sections"("legal_document_id" ASC, "chapter" ASC, "section" ASC);

-- CreateIndex
CREATE INDEX "law_sections_legal_document_id_idx" ON "public"."law_sections"("legal_document_id" ASC);

-- CreateIndex
CREATE INDEX "idx_browse_composite" ON "public"."legal_documents"("content_type" ASC, "status" ASC, "effective_date" DESC);

-- CreateIndex
CREATE INDEX "idx_browse_content_date" ON "public"."legal_documents"("content_type" ASC, "effective_date" DESC);

-- CreateIndex
CREATE INDEX "idx_publication_date" ON "public"."legal_documents"("publication_date" DESC);

-- CreateIndex
CREATE INDEX "legal_documents_content_type_idx" ON "public"."legal_documents"("content_type" ASC);

-- CreateIndex
CREATE INDEX "legal_documents_document_number_idx" ON "public"."legal_documents"("document_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_document_number_key" ON "public"."legal_documents"("document_number" ASC);

-- CreateIndex
CREATE INDEX "legal_documents_search_vector_idx" ON "public"."legal_documents"("search_vector" ASC);

-- CreateIndex
CREATE INDEX "legal_documents_slug_idx" ON "public"."legal_documents"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_slug_key" ON "public"."legal_documents"("slug" ASC);

-- CreateIndex
CREATE INDEX "legal_documents_status_idx" ON "public"."legal_documents"("status" ASC);

-- CreateIndex
CREATE INDEX "legislative_refs_legal_document_id_idx" ON "public"."legislative_refs"("legal_document_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "legislative_refs_legal_document_id_ref_type_reference_key" ON "public"."legislative_refs"("legal_document_id" ASC, "ref_type" ASC, "reference" ASC);

-- CreateIndex
CREATE INDEX "legislative_refs_ref_type_year_idx" ON "public"."legislative_refs"("ref_type" ASC, "year" ASC);

-- CreateIndex
CREATE INDEX "legislative_refs_reference_idx" ON "public"."legislative_refs"("reference" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "section_changes_amendment_id_chapter_section_change_type_key" ON "public"."section_changes"("amendment_id" ASC, "chapter" ASC, "section" ASC, "change_type" ASC);

-- CreateIndex
CREATE INDEX "section_changes_amendment_id_idx" ON "public"."section_changes"("amendment_id" ASC);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "workspace_members_invited_by_idx" ON "public"."workspace_members"("invited_by" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_user_id_workspace_id_key" ON "public"."workspace_members"("user_id" ASC, "workspace_id" ASC);

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "public"."workspace_members"("workspace_id" ASC);

-- CreateIndex
CREATE INDEX "workspaces_org_number_idx" ON "public"."workspaces"("org_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_org_number_key" ON "public"."workspaces"("org_number" ASC);

-- CreateIndex
CREATE INDEX "workspaces_owner_id_idx" ON "public"."workspaces"("owner_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "public"."workspaces"("slug" ASC);

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "public"."workspaces"("status" ASC);

-- AddForeignKey
ALTER TABLE "public"."amendments" ADD CONSTRAINT "amendments_amending_document_id_fkey" FOREIGN KEY ("amending_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."amendments" ADD CONSTRAINT "amendments_base_document_id_fkey" FOREIGN KEY ("base_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."amendments" ADD CONSTRAINT "amendments_detected_from_version_id_fkey" FOREIGN KEY ("detected_from_version_id") REFERENCES "public"."document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."change_events" ADD CONSTRAINT "change_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."court_cases" ADD CONSTRAINT "court_cases_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cross_references" ADD CONSTRAINT "cross_references_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cross_references" ADD CONSTRAINT "cross_references_target_document_id_fkey" FOREIGN KEY ("target_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_subjects" ADD CONSTRAINT "document_subjects_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."eu_documents" ADD CONSTRAINT "eu_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_list_groups" ADD CONSTRAINT "law_list_groups_law_list_id_fkey" FOREIGN KEY ("law_list_id") REFERENCES "public"."law_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_list_items" ADD CONSTRAINT "law_list_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_list_items" ADD CONSTRAINT "law_list_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_list_items" ADD CONSTRAINT "law_list_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_list_items" ADD CONSTRAINT "law_list_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."law_list_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_list_items" ADD CONSTRAINT "law_list_items_law_list_id_fkey" FOREIGN KEY ("law_list_id") REFERENCES "public"."law_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_lists" ADD CONSTRAINT "law_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_lists" ADD CONSTRAINT "law_lists_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."law_sections" ADD CONSTRAINT "law_sections_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."legislative_refs" ADD CONSTRAINT "legislative_refs_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."section_changes" ADD CONSTRAINT "section_changes_amendment_id_fkey" FOREIGN KEY ("amendment_id") REFERENCES "public"."amendment_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_members" ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

