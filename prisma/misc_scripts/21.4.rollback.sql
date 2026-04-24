-- Story 21.4 rollback — reverses 21.4.migration.sql.
-- Use only if Story 21.4 is rolled back in production.
-- Dropping this index is safe: the app-layer idempotency guard (materialiseCycleItems PLANERAD check)
-- remains in place until the code revert completes.

-- DropIndex
DROP INDEX IF EXISTS "compliance_audit_items_cycle_id_law_list_item_id_key";
