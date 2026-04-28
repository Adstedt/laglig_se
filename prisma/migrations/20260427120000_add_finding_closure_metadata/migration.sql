-- Phase 2 / Epic 23 foundation — denormalise finding closure metadata
-- so the client can derive the five-state badge (Öppen / Redo att verifiera /
-- Åtgärdad ✓ / Åtgärdad / Avskriven) without per-finding activity-log lookups.
--
-- Both columns are nullable, additive, no backfill. Existing closed findings
-- show as the plain "Åtgärdad" badge — acceptable degradation. Activity log
-- retains the source-of-truth for who/when/history.

ALTER TABLE "compliance_findings"
  ADD COLUMN "verification_note" TEXT,
  ADD COLUMN "close_reason" TEXT;
