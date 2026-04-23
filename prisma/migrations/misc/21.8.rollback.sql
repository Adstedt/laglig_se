-- Story 21.8 rollback — apply via Supabase SQL Editor ONLY IF Story 21.8 is being unwound.
--
-- Note on the enum value: PostgreSQL does NOT support `DROP VALUE` on enums.
-- Operational advice: leave `FINDING_READY_TO_CLOSE` dormant in the enum.
-- Dropping it would require recreating the NotificationType type, which is
-- destructive and only safe when no `notifications.type` rows reference it.
-- Mirrors the pattern used for Epic 8's amendment-monitoring enum values.
--
-- The join table IS safely droppable — it's new to 21.8 and has no other
-- consumers.

-- DropForeignKey
ALTER TABLE "compliance_cycle_task_links" DROP CONSTRAINT "compliance_cycle_task_links_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "compliance_cycle_task_links" DROP CONSTRAINT "compliance_cycle_task_links_task_id_fkey";

-- DropTable
DROP TABLE "compliance_cycle_task_links";

-- (Intentionally omitted) DropEnumValue 'FINDING_READY_TO_CLOSE' — Postgres
-- does not support DROP VALUE on enums. Leave dormant.
