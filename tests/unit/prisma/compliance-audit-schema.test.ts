/**
 * Story 21.1: Unit tests for Compliance Audit Cycle (Epic 21) schema.
 *
 * Verifies that Prisma client exports all new Epic 21 model types + enums
 * and that scalar field enums contain the expected fields. Matches the
 * pattern established in tests/unit/prisma/template-models.test.ts.
 *
 * Type-level assertions — no DB connection required.
 */

import { describe, it, expect } from 'vitest'
import {
  Prisma,
  AuditType,
  ComplianceCycleStatus,
  EfterlevnadsBedomning,
  FindingType,
  FindingSeverity,
  EvidenceKind,
  ReportKind,
} from '@prisma/client'

describe('Story 21.1: Compliance Audit Cycle schema', () => {
  describe('AuditType enum', () => {
    it('has exactly 2 values', () => {
      expect(Object.values(AuditType)).toHaveLength(2)
    })

    it('contains INTERN and EXTERN', () => {
      expect(AuditType.INTERN).toBe('INTERN')
      expect(AuditType.EXTERN).toBe('EXTERN')
    })
  })

  describe('ComplianceCycleStatus enum', () => {
    // Story 21.26 — SEALED collapsed into AVSLUTAD.
    // Story 21.27 — ARKIVERAD also collapsed; lifecycle is 3-state.
    it('has exactly 3 values (the cycle lifecycle)', () => {
      expect(Object.values(ComplianceCycleStatus)).toHaveLength(3)
    })

    it('contains PLANERAD, PAGAENDE, AVSLUTAD', () => {
      expect(ComplianceCycleStatus.PLANERAD).toBe('PLANERAD')
      expect(ComplianceCycleStatus.PAGAENDE).toBe('PAGAENDE')
      expect(ComplianceCycleStatus.AVSLUTAD).toBe('AVSLUTAD')
    })
  })

  describe('EfterlevnadsBedomning enum', () => {
    it('has exactly 4 values', () => {
      expect(Object.values(EfterlevnadsBedomning)).toHaveLength(4)
    })

    it('contains UPPFYLLD, DELVIS, EJ_UPPFYLLD, EJ_TILLAMPLIG', () => {
      expect(EfterlevnadsBedomning.UPPFYLLD).toBe('UPPFYLLD')
      expect(EfterlevnadsBedomning.DELVIS).toBe('DELVIS')
      expect(EfterlevnadsBedomning.EJ_UPPFYLLD).toBe('EJ_UPPFYLLD')
      expect(EfterlevnadsBedomning.EJ_TILLAMPLIG).toBe('EJ_TILLAMPLIG')
    })
  })

  describe('FindingType enum', () => {
    it('contains AVVIKELSE, OBSERVATION, FORBATTRING (Swedish-native taxonomy)', () => {
      expect(FindingType.AVVIKELSE).toBe('AVVIKELSE')
      expect(FindingType.OBSERVATION).toBe('OBSERVATION')
      expect(FindingType.FORBATTRING).toBe('FORBATTRING')
    })
  })

  describe('FindingSeverity enum', () => {
    it('contains MAJOR and MINOR', () => {
      expect(FindingSeverity.MAJOR).toBe('MAJOR')
      expect(FindingSeverity.MINOR).toBe('MINOR')
    })
  })

  describe('EvidenceKind enum', () => {
    it('contains FILE and DOCUMENT (XOR discriminant)', () => {
      expect(EvidenceKind.FILE).toBe('FILE')
      expect(EvidenceKind.DOCUMENT).toBe('DOCUMENT')
    })
  })

  describe('ReportKind enum', () => {
    // Story 21.26 — SEALED dropped; only COMPLETE remains post-collapse.
    it('contains COMPLETE', () => {
      expect(ReportKind.COMPLETE).toBe('COMPLETE')
      expect(Object.values(ReportKind)).toHaveLength(1)
    })
  })

  describe('ComplianceAuditCycle model types', () => {
    it('exposes ComplianceAuditCycleCreateInput with required fields', () => {
      const input: Prisma.ComplianceAuditCycleCreateInput = {
        name: 'Test kontroll',
        scope_definition: { kind: 'all' },
        audit_type: AuditType.INTERN,
        scheduled_start: new Date(),
        scheduled_end: new Date(),
        law_change_cutoff_date: new Date(),
        workspace: { connect: { id: 'ws-id' } },
        law_list: { connect: { id: 'll-id' } },
        lead_auditor: { connect: { id: 'user-id' } },
        created_by: { connect: { id: 'user-id' } },
      }
      expect(input.name).toBe('Test kontroll')
      expect(input.audit_type).toBe(AuditType.INTERN)
    })

    it('exposes ComplianceAuditCycleScalarFieldEnum with all expected fields', () => {
      const fields = Prisma.ComplianceAuditCycleScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.workspace_id).toBe('workspace_id')
      expect(fields.law_list_id).toBe('law_list_id')
      expect(fields.name).toBe('name')
      expect(fields.scope_definition).toBe('scope_definition')
      expect(fields.audit_type).toBe('audit_type')
      expect(fields.scheduled_start).toBe('scheduled_start')
      expect(fields.scheduled_end).toBe('scheduled_end')
      expect(fields.law_change_cutoff_date).toBe('law_change_cutoff_date')
      expect(fields.status).toBe('status')
      expect(fields.lead_auditor_user_id).toBe('lead_auditor_user_id')
      expect(fields.sealed_at).toBe('sealed_at')
      expect(fields.sealed_by_user_id).toBe('sealed_by_user_id')
      // Story 21.26 — `seal_hash` column dropped; cryptographic ceremony removed.
      expect(fields.created_at).toBe('created_at')
      expect(fields.updated_at).toBe('updated_at')
      expect(fields.deleted_at).toBe('deleted_at')
      expect(fields.created_by_user_id).toBe('created_by_user_id')
    })
  })

  describe('ComplianceAuditItem model types', () => {
    it('exposes ComplianceAuditItemScalarFieldEnum with all expected fields', () => {
      const fields = Prisma.ComplianceAuditItemScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.cycle_id).toBe('cycle_id')
      expect(fields.law_list_item_id).toBe('law_list_item_id')
      expect(fields.efterlevnadsbedomning).toBe('efterlevnadsbedomning')
      expect(fields.motivering).toBe('motivering')
      expect(fields.reviewed_at).toBe('reviewed_at')
      expect(fields.reviewed_by_user_id).toBe('reviewed_by_user_id')
      expect(fields.signed_off_at).toBe('signed_off_at')
      expect(fields.signed_off_by_user_id).toBe('signed_off_by_user_id')
      expect(fields.kravpunkter_snapshot).toBe('kravpunkter_snapshot')
    })
  })

  describe('ComplianceFinding model types', () => {
    it('exposes ComplianceFindingScalarFieldEnum with all expected fields', () => {
      const fields = Prisma.ComplianceFindingScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.cycle_id).toBe('cycle_id')
      expect(fields.law_list_item_id).toBe('law_list_item_id')
      expect(fields.requirement_id).toBe('requirement_id')
      expect(fields.type).toBe('type')
      expect(fields.severity).toBe('severity')
      expect(fields.title).toBe('title')
      expect(fields.description).toBe('description')
      expect(fields.root_cause).toBe('root_cause')
      expect(fields.corrective_action_task_id).toBe('corrective_action_task_id')
      expect(fields.due_date).toBe('due_date')
      expect(fields.closed_at).toBe('closed_at')
      expect(fields.closed_by_user_id).toBe('closed_by_user_id')
    })
  })

  // Story 21.26 — ComplianceEvidenceSnapshot model dropped alongside the SEAL
  // collapse. The only writer was sealCycle's gather-seal-evidence path; no
  // remaining consumers post-collapse. Model + table removed via the migration.

  describe('ComplianceAuditReport model types', () => {
    it('exposes ComplianceAuditReportScalarFieldEnum with all expected fields', () => {
      const fields = Prisma.ComplianceAuditReportScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.cycle_id).toBe('cycle_id')
      expect(fields.report_kind).toBe('report_kind')
      expect(fields.generated_at).toBe('generated_at')
      expect(fields.pdf_storage_path).toBe('pdf_storage_path')
      expect(fields.html_storage_path).toBe('html_storage_path')
      expect(fields.manifest).toBe('manifest')
    })
  })

  describe('Task model extension (Story 21.1 Task 8)', () => {
    it('Task scalar field enum now exposes compliance_finding_id', () => {
      const fields = Prisma.TaskScalarFieldEnum
      expect(fields.compliance_finding_id).toBe('compliance_finding_id')
    })
  })
})
