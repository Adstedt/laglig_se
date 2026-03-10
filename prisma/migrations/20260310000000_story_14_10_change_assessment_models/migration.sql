-- Story 14.10: Change Assessment Models
-- Adds ChangeAssessment and ComplianceStatusLog tables,
-- AssessmentStatus and ImpactLevel enums,
-- CHANGE value to ChatContextType enum

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('REVIEWED', 'ACTION_REQUIRED', 'NOT_APPLICABLE', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- AlterEnum
ALTER TYPE "ChatContextType" ADD VALUE 'CHANGE';

-- CreateTable
CREATE TABLE "change_assessments" (
    "id" TEXT NOT NULL,
    "change_event_id" TEXT NOT NULL,
    "law_list_item_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL,
    "impact_level" "ImpactLevel" NOT NULL,
    "ai_analysis" TEXT,
    "ai_recommendations" JSONB,
    "user_notes" TEXT,
    "assessed_by" TEXT NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_status_logs" (
    "id" TEXT NOT NULL,
    "law_list_item_id" TEXT NOT NULL,
    "previous_status" "ComplianceStatus" NOT NULL,
    "new_status" "ComplianceStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "change_assessment_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_assessments_change_event_id_idx" ON "change_assessments"("change_event_id");
CREATE INDEX "change_assessments_law_list_item_id_idx" ON "change_assessments"("law_list_item_id");
CREATE INDEX "change_assessments_workspace_id_idx" ON "change_assessments"("workspace_id");
CREATE INDEX "change_assessments_assessed_by_idx" ON "change_assessments"("assessed_by");
CREATE UNIQUE INDEX "change_assessments_change_event_id_law_list_item_id_key" ON "change_assessments"("change_event_id", "law_list_item_id");

-- CreateIndex
CREATE INDEX "compliance_status_logs_law_list_item_id_idx" ON "compliance_status_logs"("law_list_item_id");
CREATE INDEX "compliance_status_logs_changed_by_idx" ON "compliance_status_logs"("changed_by");
CREATE INDEX "compliance_status_logs_change_assessment_id_idx" ON "compliance_status_logs"("change_assessment_id");

-- AddForeignKey
ALTER TABLE "change_assessments" ADD CONSTRAINT "change_assessments_change_event_id_fkey" FOREIGN KEY ("change_event_id") REFERENCES "change_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_assessments" ADD CONSTRAINT "change_assessments_law_list_item_id_fkey" FOREIGN KEY ("law_list_item_id") REFERENCES "law_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_assessments" ADD CONSTRAINT "change_assessments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_assessments" ADD CONSTRAINT "change_assessments_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_status_logs" ADD CONSTRAINT "compliance_status_logs_law_list_item_id_fkey" FOREIGN KEY ("law_list_item_id") REFERENCES "law_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_status_logs" ADD CONSTRAINT "compliance_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compliance_status_logs" ADD CONSTRAINT "compliance_status_logs_change_assessment_id_fkey" FOREIGN KEY ("change_assessment_id") REFERENCES "change_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
