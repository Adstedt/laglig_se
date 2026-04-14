-- Story 17.18: Business-context update attribution.
-- Mirrors the existing `compliance_actions_updated_at` / `compliance_actions_updated_by`
-- denormalized columns so the expansion's "Hur påverkar denna lag oss?" subsection
-- can render "Senast uppdaterad {date} av {name}" without querying ActivityLog.

-- AlterTable
ALTER TABLE "law_list_items" ADD COLUMN     "business_context_updated_at" TIMESTAMP(3),
ADD COLUMN     "business_context_updated_by" TEXT;
