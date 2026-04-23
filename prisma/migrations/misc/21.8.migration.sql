-- Story 21.8: Auto-spawn corrective-action Task on AVVIKELSE — apply via Supabase SQL Editor.
-- Purpose:
--   1. Add `FINDING_READY_TO_CLOSE` value to the `NotificationType` enum.
--   2. Create `compliance_cycle_task_links` M:N join table between tasks and compliance_audit_cycles.
-- Additive-only — zero DROP, zero ALTER COLUMN, zero RENAME on any existing object.
-- Zero existing tasks are in scope — no backfill needed.
-- Application order: run this SQL BEFORE (or immediately after) merging the Story 21.8 code PR.
-- Rollback: see prisma/migrations/misc/21.8.rollback.sql.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FINDING_READY_TO_CLOSE';

-- CreateTable
CREATE TABLE "compliance_cycle_task_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_cycle_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compliance_cycle_task_links_task_id_cycle_id_key" ON "compliance_cycle_task_links"("task_id", "cycle_id");

-- CreateIndex
CREATE INDEX "compliance_cycle_task_links_task_id_idx" ON "compliance_cycle_task_links"("task_id");

-- CreateIndex
CREATE INDEX "compliance_cycle_task_links_cycle_id_idx" ON "compliance_cycle_task_links"("cycle_id");

-- AddForeignKey
ALTER TABLE "compliance_cycle_task_links" ADD CONSTRAINT "compliance_cycle_task_links_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_cycle_task_links" ADD CONSTRAINT "compliance_cycle_task_links_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "compliance_audit_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
