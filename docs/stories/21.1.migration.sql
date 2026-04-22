-- Story 21.1: Lagefterlevnadskontroll (compliance audit cycle) schema foundations.
-- Additive migration — introduces cycle aggregate + 4 child models + 1 nullable column on tasks.
-- Zero DROP, zero ALTER COLUMN, zero RENAME on any existing object.
-- Generated with: pnpm prisma migrate diff --from-schema-datamodel <pre-change> --to-schema-datamodel <post-change> --script
-- XOR CHECK constraint for compliance_evidence_snapshots appended at end of file (manual step per story AC 4).

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('INTERN', 'EXTERN');

-- CreateEnum
CREATE TYPE "ComplianceCycleStatus" AS ENUM ('PLANERAD', 'PAGAENDE', 'AVSLUTAD', 'SEALED', 'ARKIVERAD');

-- CreateEnum
CREATE TYPE "EfterlevnadsBedomning" AS ENUM ('UPPFYLLD', 'DELVIS', 'EJ_UPPFYLLD', 'EJ_TILLAMPLIG');

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('AVVIKELSE', 'OBSERVATION', 'FORBATTRING');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('FILE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('COMPLETE', 'SEALED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "compliance_finding_id" TEXT;

-- CreateTable
CREATE TABLE "compliance_audit_cycles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "law_list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope_definition" JSONB NOT NULL,
    "audit_type" "AuditType" NOT NULL,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "law_change_cutoff_date" TIMESTAMP(3) NOT NULL,
    "status" "ComplianceCycleStatus" NOT NULL DEFAULT 'PLANERAD',
    "lead_auditor_user_id" TEXT NOT NULL,
    "sealed_at" TIMESTAMP(3),
    "sealed_by_user_id" TEXT,
    "seal_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,

    CONSTRAINT "compliance_audit_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_audit_items" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "law_list_item_id" TEXT NOT NULL,
    "efterlevnadsbedomning" "EfterlevnadsBedomning",
    "motivering" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "signed_off_at" TIMESTAMP(3),
    "signed_off_by_user_id" TEXT,
    "kravpunkter_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_findings" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "law_list_item_id" TEXT,
    "requirement_id" TEXT,
    "type" "FindingType" NOT NULL,
    "severity" "FindingSeverity",
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "root_cause" TEXT,
    "corrective_action_task_id" TEXT,
    "due_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_evidence_snapshots" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "law_list_item_id" TEXT,
    "requirement_id" TEXT,
    "evidence_kind" "EvidenceKind" NOT NULL,
    "evidence_file_id" TEXT,
    "evidence_document_id" TEXT,
    "evidence_sha256" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_evidence_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_audit_reports" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "report_kind" "ReportKind" NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_storage_path" TEXT,
    "html_storage_path" TEXT,
    "manifest" JSONB NOT NULL,

    CONSTRAINT "compliance_audit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_audit_cycles_workspace_id_status_idx" ON "compliance_audit_cycles"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "compliance_audit_cycles_law_list_id_idx" ON "compliance_audit_cycles"("law_list_id");

-- CreateIndex
CREATE INDEX "compliance_audit_cycles_lead_auditor_user_id_idx" ON "compliance_audit_cycles"("lead_auditor_user_id");

-- CreateIndex
CREATE INDEX "compliance_audit_items_cycle_id_signed_off_at_idx" ON "compliance_audit_items"("cycle_id", "signed_off_at");

-- CreateIndex
CREATE INDEX "compliance_audit_items_law_list_item_id_idx" ON "compliance_audit_items"("law_list_item_id");

-- CreateIndex
CREATE INDEX "compliance_findings_cycle_id_type_idx" ON "compliance_findings"("cycle_id", "type");

-- CreateIndex
CREATE INDEX "compliance_findings_law_list_item_id_idx" ON "compliance_findings"("law_list_item_id");

-- CreateIndex
CREATE INDEX "compliance_findings_requirement_id_idx" ON "compliance_findings"("requirement_id");

-- CreateIndex
CREATE INDEX "compliance_findings_corrective_action_task_id_idx" ON "compliance_findings"("corrective_action_task_id");

-- CreateIndex
CREATE INDEX "compliance_evidence_snapshots_cycle_id_idx" ON "compliance_evidence_snapshots"("cycle_id");

-- CreateIndex
CREATE INDEX "compliance_evidence_snapshots_evidence_file_id_idx" ON "compliance_evidence_snapshots"("evidence_file_id");

-- CreateIndex
CREATE INDEX "compliance_evidence_snapshots_evidence_document_id_idx" ON "compliance_evidence_snapshots"("evidence_document_id");

-- CreateIndex
CREATE INDEX "compliance_audit_reports_cycle_id_report_kind_idx" ON "compliance_audit_reports"("cycle_id", "report_kind");

-- CreateIndex
CREATE INDEX "tasks_compliance_finding_id_idx" ON "tasks"("compliance_finding_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_compliance_finding_id_fkey" FOREIGN KEY ("compliance_finding_id") REFERENCES "compliance_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_cycles" ADD CONSTRAINT "compliance_audit_cycles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_cycles" ADD CONSTRAINT "compliance_audit_cycles_law_list_id_fkey" FOREIGN KEY ("law_list_id") REFERENCES "law_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_cycles" ADD CONSTRAINT "compliance_audit_cycles_lead_auditor_user_id_fkey" FOREIGN KEY ("lead_auditor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_cycles" ADD CONSTRAINT "compliance_audit_cycles_sealed_by_user_id_fkey" FOREIGN KEY ("sealed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_cycles" ADD CONSTRAINT "compliance_audit_cycles_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_items" ADD CONSTRAINT "compliance_audit_items_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "compliance_audit_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_items" ADD CONSTRAINT "compliance_audit_items_law_list_item_id_fkey" FOREIGN KEY ("law_list_item_id") REFERENCES "law_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_items" ADD CONSTRAINT "compliance_audit_items_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_items" ADD CONSTRAINT "compliance_audit_items_signed_off_by_user_id_fkey" FOREIGN KEY ("signed_off_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "compliance_audit_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_law_list_item_id_fkey" FOREIGN KEY ("law_list_item_id") REFERENCES "law_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "law_list_item_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_corrective_action_task_id_fkey" FOREIGN KEY ("corrective_action_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_findings" ADD CONSTRAINT "compliance_findings_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence_snapshots" ADD CONSTRAINT "compliance_evidence_snapshots_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "compliance_audit_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence_snapshots" ADD CONSTRAINT "compliance_evidence_snapshots_law_list_item_id_fkey" FOREIGN KEY ("law_list_item_id") REFERENCES "law_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence_snapshots" ADD CONSTRAINT "compliance_evidence_snapshots_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "law_list_item_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence_snapshots" ADD CONSTRAINT "compliance_evidence_snapshots_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "workspace_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evidence_snapshots" ADD CONSTRAINT "compliance_evidence_snapshots_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "workspace_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_reports" ADD CONSTRAINT "compliance_audit_reports_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "compliance_audit_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- XOR CHECK constraint on compliance_evidence_snapshots (manual addition per story AC 4).
-- Enforces: exactly one of evidence_file_id / evidence_document_id must be non-null.
-- Stricter than the existing RequirementEvidenceLink (app-layer only) — justified by audit integrity.
ALTER TABLE "compliance_evidence_snapshots"
    ADD CONSTRAINT "compliance_evidence_snapshots_xor_check"
    CHECK (
        (evidence_file_id IS NOT NULL AND evidence_document_id IS NULL)
        OR
        (evidence_file_id IS NULL AND evidence_document_id IS NOT NULL)
    );
