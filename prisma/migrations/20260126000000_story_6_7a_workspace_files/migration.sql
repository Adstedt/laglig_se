-- Story 6.7a: Workspace File Management
-- This migration restructures the Evidence model into WorkspaceFile with many-to-many relationships

-- Create FileCategory enum
CREATE TYPE "FileCategory" AS ENUM ('BEVIS', 'POLICY', 'AVTAL', 'CERTIFIKAT', 'OVRIGT');

-- Drop existing evidence table (no data expected - upload was not implemented)
DROP TABLE IF EXISTS "evidence";

-- Create workspace_files table
CREATE TABLE "workspace_files" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL DEFAULT 'OVRIGT',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_files_pkey" PRIMARY KEY ("id")
);

-- Create file_task_links table (many-to-many: File <-> Task)
CREATE TABLE "file_task_links" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT NOT NULL,

    CONSTRAINT "file_task_links_pkey" PRIMARY KEY ("id")
);

-- Create file_list_item_links table (many-to-many: File <-> LawListItem)
CREATE TABLE "file_list_item_links" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "list_item_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT NOT NULL,

    CONSTRAINT "file_list_item_links_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints for link tables
CREATE UNIQUE INDEX "file_task_links_file_id_task_id_key" ON "file_task_links"("file_id", "task_id");
CREATE UNIQUE INDEX "file_list_item_links_file_id_list_item_id_key" ON "file_list_item_links"("file_id", "list_item_id");

-- Create indexes for workspace_files
CREATE INDEX "workspace_files_workspace_id_idx" ON "workspace_files"("workspace_id");
CREATE INDEX "workspace_files_uploaded_by_idx" ON "workspace_files"("uploaded_by");
CREATE INDEX "workspace_files_category_idx" ON "workspace_files"("category");

-- Create indexes for file_task_links
CREATE INDEX "file_task_links_file_id_idx" ON "file_task_links"("file_id");
CREATE INDEX "file_task_links_task_id_idx" ON "file_task_links"("task_id");

-- Create indexes for file_list_item_links
CREATE INDEX "file_list_item_links_file_id_idx" ON "file_list_item_links"("file_id");
CREATE INDEX "file_list_item_links_list_item_id_idx" ON "file_list_item_links"("list_item_id");

-- Add foreign key constraints for workspace_files
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key constraints for file_task_links
ALTER TABLE "file_task_links" ADD CONSTRAINT "file_task_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "workspace_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_task_links" ADD CONSTRAINT "file_task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_task_links" ADD CONSTRAINT "file_task_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key constraints for file_list_item_links
ALTER TABLE "file_list_item_links" ADD CONSTRAINT "file_list_item_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "workspace_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_list_item_links" ADD CONSTRAINT "file_list_item_links_list_item_id_fkey" FOREIGN KEY ("list_item_id") REFERENCES "law_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_list_item_links" ADD CONSTRAINT "file_list_item_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
