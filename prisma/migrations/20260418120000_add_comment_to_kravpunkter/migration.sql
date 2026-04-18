-- Per-kravpunkt comments
-- Adds optional free-text note to each requirement.
-- Null = no note. Existing rows remain null; no backfill required.
ALTER TABLE "law_list_item_requirements"
  ADD COLUMN "comment" TEXT;
