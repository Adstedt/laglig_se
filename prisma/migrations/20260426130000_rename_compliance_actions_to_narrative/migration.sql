-- Story 21.22: Rename compliance_actions → compliance_narrative.
-- The field was repurposed in Story 17.16 as a "Generella kommentarer" sub-field
-- inside the Kravpunkter accordion. Story 21.22 promotes it back to a first-class
-- top-level "Hur efterlever vi kraven?" field with a clearer name.

ALTER TABLE "law_list_items"
  RENAME COLUMN "compliance_actions" TO "compliance_narrative";

ALTER TABLE "law_list_items"
  RENAME COLUMN "compliance_actions_updated_at" TO "compliance_narrative_updated_at";

ALTER TABLE "law_list_items"
  RENAME COLUMN "compliance_actions_updated_by" TO "compliance_narrative_updated_by";
