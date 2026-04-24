-- Story 21.9 QA follow-up (CONSTRAINT-001):
-- Add unique constraint on (cycle_id, report_kind) for ComplianceAuditReport.
-- sealCycle currently uses findFirst+create which is safe only because the
-- SF-2 status-scoped updateMany serialises seal invocations. Any future
-- multi-write caller (Story 21.12's COMPLETE-kind PDF regen) would need this
-- constraint to be safe; add it now as defense-in-depth.
--
-- Safety: existing rows today — none in production (Epic 21 MVP not shipped).
-- In dev/staging: worst case one row per (cycle_id, 'SEALED'); no duplicates
-- can exist today because sealCycle's race guard already prevents them.

CREATE UNIQUE INDEX "compliance_audit_reports_cycle_id_report_kind_key"
  ON "compliance_audit_reports" ("cycle_id", "report_kind");
