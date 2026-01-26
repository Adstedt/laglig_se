-- Story 6.7b: Add folder support to workspace_files
-- Enables hierarchical folder structure for file organization

-- Add folder hierarchy columns
ALTER TABLE "workspace_files" ADD COLUMN "parent_folder_id" TEXT;
ALTER TABLE "workspace_files" ADD COLUMN "is_folder" BOOLEAN NOT NULL DEFAULT false;

-- Make file-specific columns nullable (folders don't have these)
ALTER TABLE "workspace_files" ALTER COLUMN "original_filename" DROP NOT NULL;
ALTER TABLE "workspace_files" ALTER COLUMN "file_size" DROP NOT NULL;
ALTER TABLE "workspace_files" ALTER COLUMN "mime_type" DROP NOT NULL;
ALTER TABLE "workspace_files" ALTER COLUMN "storage_path" DROP NOT NULL;

-- Add self-referential foreign key for folder hierarchy
ALTER TABLE "workspace_files"
ADD CONSTRAINT "workspace_files_parent_folder_id_fkey"
FOREIGN KEY ("parent_folder_id") REFERENCES "workspace_files"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint for filename within same folder
CREATE UNIQUE INDEX "unique_filename_in_folder"
ON "workspace_files"("workspace_id", "parent_folder_id", "filename");

-- Add indexes for folder queries
CREATE INDEX "workspace_files_parent_folder_id_idx" ON "workspace_files"("parent_folder_id");
CREATE INDEX "workspace_files_is_folder_idx" ON "workspace_files"("is_folder");
