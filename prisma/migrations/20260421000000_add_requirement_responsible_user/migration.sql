-- Story 20.1: Per-krav assignee
-- Adds optional responsible_user_id to kravpunkter. Null = inherit from parent
-- list item's responsible_user_id. Existing rows stay null (inherited behaviour).
-- onDelete: SET NULL so deleting a user falls the krav back to inherited state.

-- AlterTable
ALTER TABLE "law_list_item_requirements"
  ADD COLUMN "responsible_user_id" TEXT;

-- CreateIndex
CREATE INDEX "law_list_item_requirements_responsible_user_id_idx"
  ON "law_list_item_requirements"("responsible_user_id");

-- AddForeignKey
ALTER TABLE "law_list_item_requirements"
  ADD CONSTRAINT "law_list_item_requirements_responsible_user_id_fkey"
  FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
