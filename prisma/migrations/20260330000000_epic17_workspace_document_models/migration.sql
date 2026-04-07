-- CreateEnum
CREATE TYPE "WorkspaceDocumentType" AS ENUM ('POLICY', 'RISK_ASSESSMENT', 'ACTION_PLAN', 'PROCEDURE', 'INSTRUCTION', 'CHECKLIST', 'REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkspaceDocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkspaceDocumentVersionSource" AS ENUM ('TIPTAP', 'IMPORT', 'AGENT');

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'WORKSPACE_DOCUMENT';

-- CreateTable
CREATE TABLE "workspace_documents" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "document_type" "WorkspaceDocumentType" NOT NULL DEFAULT 'OTHER',
    "status" "WorkspaceDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "document_number" TEXT,
    "current_version_id" TEXT,
    "current_version_number" INTEGER NOT NULL DEFAULT 0,
    "template_id" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "review_date" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "source" "WorkspaceDocumentVersionSource" NOT NULL DEFAULT 'TIPTAP',
    "content_json" JSONB NOT NULL,
    "content_html" TEXT NOT NULL,
    "extracted_text" TEXT,
    "storage_path" TEXT,
    "change_summary" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_document_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "document_type" "WorkspaceDocumentType" NOT NULL,
    "content_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_document_task_links" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT NOT NULL,

    CONSTRAINT "workspace_document_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_document_list_item_links" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "list_item_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT NOT NULL,

    CONSTRAINT "workspace_document_list_item_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_documents_current_version_id_key" ON "workspace_documents"("current_version_id");
CREATE INDEX "workspace_documents_workspace_id_status_idx" ON "workspace_documents"("workspace_id", "status");
CREATE INDEX "workspace_documents_workspace_id_document_type_idx" ON "workspace_documents"("workspace_id", "document_type");
CREATE INDEX "workspace_documents_workspace_id_created_at_idx" ON "workspace_documents"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_document_versions_document_id_version_number_key" ON "workspace_document_versions"("document_id", "version_number");
CREATE INDEX "workspace_document_versions_document_id_created_at_idx" ON "workspace_document_versions"("document_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_document_task_links_document_id_task_id_key" ON "workspace_document_task_links"("document_id", "task_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_document_list_item_links_document_id_list_item_id_key" ON "workspace_document_list_item_links"("document_id", "list_item_id");

-- AddForeignKey
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "workspace_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workspace_document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_document_versions" ADD CONSTRAINT "workspace_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "workspace_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_document_task_links" ADD CONSTRAINT "workspace_document_task_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "workspace_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_document_task_links" ADD CONSTRAINT "workspace_document_task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_document_task_links" ADD CONSTRAINT "workspace_document_task_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_document_list_item_links" ADD CONSTRAINT "workspace_document_list_item_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "workspace_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_document_list_item_links" ADD CONSTRAINT "workspace_document_list_item_links_list_item_id_fkey" FOREIGN KEY ("list_item_id") REFERENCES "law_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_document_list_item_links" ADD CONSTRAINT "workspace_document_list_item_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
