-- Story 21.4: schema hardening — enforce one ComplianceAuditItem per (cycle, law_list_item) pair at the DB level.
-- Additive migration: single CREATE UNIQUE INDEX, zero DROP/ALTER. SCHEMA-002 carry-forward from Story 21.1.
-- Generated with: pnpm prisma migrate diff --from-schema-datamodel <pre> --to-schema-datamodel <post> --script
-- Apply via Supabase SQL Editor (user-applied-migration workflow established in Story 21.1).

-- CreateIndex
CREATE UNIQUE INDEX "compliance_audit_items_cycle_id_law_list_item_id_key" ON "compliance_audit_items"("cycle_id", "law_list_item_id");
