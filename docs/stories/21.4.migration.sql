-- Story 21.4 migration — apply via Supabase SQL Editor.
-- Purpose: add DB-level unique constraint on ComplianceAuditItem(cycle_id, law_list_item_id).
-- This is a belt-and-braces guarantee against duplicate materialisation races (SCHEMA-002 carry-forward from Story 21.1).
-- Safe to apply on existing data: the compliance_audit_items table is empty in production at the time of this story.
-- Application order: run this SQL BEFORE (or immediately after) merging the Story 21.4 code PR.
-- Rollback: see docs/stories/21.4.rollback.sql.

-- CreateIndex
CREATE UNIQUE INDEX "compliance_audit_items_cycle_id_law_list_item_id_key" ON "compliance_audit_items"("cycle_id", "law_list_item_id");
