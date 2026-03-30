-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "law_list_generation_status" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "law_list_generation_error" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "law_list_generation_progress" JSONB;
