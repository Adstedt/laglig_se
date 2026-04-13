-- Story 17.16: Kravpunkter — Structured Compliance Checklist per Law List Item
-- Additive migration: introduces LawListItemRequirement and RequirementEvidenceLink.
-- No changes to existing tables' columns; only new tables, indexes, and FKs.

-- CreateTable
CREATE TABLE "law_list_item_requirements" (
    "id" TEXT NOT NULL,
    "list_item_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "law_list_item_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_evidence_links" (
    "id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "file_id" TEXT,
    "workspace_document_id" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT NOT NULL,

    CONSTRAINT "requirement_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "law_list_item_requirements_list_item_id_position_idx"
    ON "law_list_item_requirements"("list_item_id", "position");

-- CreateIndex
CREATE INDEX "law_list_item_requirements_created_by_idx"
    ON "law_list_item_requirements"("created_by");

-- CreateIndex
CREATE INDEX "requirement_evidence_links_requirement_id_idx"
    ON "requirement_evidence_links"("requirement_id");

-- CreateIndex
CREATE INDEX "requirement_evidence_links_file_id_idx"
    ON "requirement_evidence_links"("file_id");

-- CreateIndex
CREATE INDEX "requirement_evidence_links_workspace_document_id_idx"
    ON "requirement_evidence_links"("workspace_document_id");

-- CreateIndex
-- Prevents duplicate (requirement, file) links. NULLs are distinct in Postgres, so NULL file_id rows (document-linked) don't conflict.
CREATE UNIQUE INDEX "requirement_evidence_links_requirement_id_file_id_key"
    ON "requirement_evidence_links"("requirement_id", "file_id");

-- CreateIndex
-- Same idea for document links.
CREATE UNIQUE INDEX "requirement_evidence_links_requirement_id_workspace_document_id_key"
    ON "requirement_evidence_links"("requirement_id", "workspace_document_id");

-- AddForeignKey
ALTER TABLE "law_list_item_requirements"
    ADD CONSTRAINT "law_list_item_requirements_list_item_id_fkey"
    FOREIGN KEY ("list_item_id") REFERENCES "law_list_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_list_item_requirements"
    ADD CONSTRAINT "law_list_item_requirements_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evidence_links"
    ADD CONSTRAINT "requirement_evidence_links_requirement_id_fkey"
    FOREIGN KEY ("requirement_id") REFERENCES "law_list_item_requirements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evidence_links"
    ADD CONSTRAINT "requirement_evidence_links_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "workspace_files"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evidence_links"
    ADD CONSTRAINT "requirement_evidence_links_workspace_document_id_fkey"
    FOREIGN KEY ("workspace_document_id") REFERENCES "workspace_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evidence_links"
    ADD CONSTRAINT "requirement_evidence_links_linked_by_fkey"
    FOREIGN KEY ("linked_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
