-- Story 17.18: add bevis_required flag to LawListItemRequirement
-- Rollout is silent: existing + new kravpunkter start with bevis_required=false
-- so the "missing bevis" signal only fires when users explicitly opt in.

ALTER TABLE "law_list_item_requirements"
  ADD COLUMN "bevis_required" BOOLEAN NOT NULL DEFAULT false;
