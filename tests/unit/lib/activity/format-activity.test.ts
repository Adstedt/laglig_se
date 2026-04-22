import { describe, it, expect } from 'vitest'
import {
  formatActivity,
  sentencePartsToText,
} from '@/lib/activity/format-activity'
import type { ResolvedEntityRef } from '@/lib/activity/types'

const USER = { name: 'Alexander', email: 'alex@example.com' }

const taskRef: ResolvedEntityRef = {
  id: 'task-1',
  label: 'Test',
  href: '/tasks?task=task-1',
  deleted: false,
}

const listItemRef: ResolvedEntityRef = {
  id: 'li-1',
  label: 'Semesterlag (1977:480)',
  href: '/laglistor?document=li-1',
  deleted: false,
}

const docRef: ResolvedEntityRef = {
  id: 'doc-1',
  label: 'Rutin Arbetsmiljö',
  href: '/workspace/styrdokument/doc-1/edit',
  deleted: false,
}

const requirementRef: ResolvedEntityRef = {
  id: 'req-1',
  label: 'Årlig brandskyddsutbildning',
  href: '/laglistor?document=li-1',
  deleted: false,
}

describe('formatActivity', () => {
  it('renders law_linked with law_title as emphasis and task as link', () => {
    const parts = formatActivity({
      action: 'law_linked',
      entity_type: 'task',
      user: USER,
      old_value: null,
      new_value: { law_title: 'Semesterlag (1977:480)' },
      primary: taskRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander kopplade Semesterlag (1977:480) till uppgiften Test'
    )
    expect(
      parts.some((p) => p.kind === 'link' && p.href === taskRef.href)
    ).toBe(true)
  })

  it('renders status_changed with Swedish compliance labels', () => {
    const parts = formatActivity({
      action: 'status_changed',
      entity_type: 'list_item',
      user: USER,
      old_value: { compliance_status: 'EJ_PABORJAD' },
      new_value: { compliance_status: 'UPPFYLLD' },
      primary: listItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander ändrade efterlevnadsstatus på Semesterlag (1977:480) från ej påbörjad till uppfylld'
    )
  })

  it('renders status_updated for tasks with raw column names', () => {
    const parts = formatActivity({
      action: 'status_updated',
      entity_type: 'task',
      user: USER,
      old_value: { status: 'Att göra' },
      new_value: { status: 'Klar' },
      primary: taskRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander flyttade uppgiften Test från Att göra till Klar'
    )
  })

  it('renders document_linked_to_list_item with secondary link', () => {
    const parts = formatActivity({
      action: 'document_linked_to_list_item',
      entity_type: 'workspace_document',
      user: USER,
      old_value: null,
      new_value: { list_item_id: 'li-1', list_item_title: 'x' },
      primary: docRef,
      secondary: listItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander kopplade dokumentet Rutin Arbetsmiljö till Semesterlag (1977:480)'
    )
  })

  it('renders requirement_created with text and parent list_item', () => {
    const parts = formatActivity({
      action: 'requirement_created',
      entity_type: 'requirement',
      user: USER,
      old_value: null,
      new_value: { text: 'Årlig brandskyddsutbildning', list_item_id: 'li-1' },
      primary: requirementRef,
      secondary: listItemRef,
    })
    expect(sentencePartsToText(parts)).toContain(
      'skapade kravpunkten Årlig brandskyddsutbildning'
    )
    expect(sentencePartsToText(parts)).toContain('Semesterlag')
  })

  it('renders notification_sent with template + recipient', () => {
    const parts = formatActivity({
      action: 'notification_sent',
      entity_type: 'email',
      user: USER,
      old_value: null,
      new_value: {
        template: 'TASK_ASSIGNED',
        recipient: 'user@example.com',
        subject: 'Ny uppgift',
      },
      primary: {
        id: 'email-1',
        label: 'Ny uppgift',
        href: null,
        deleted: false,
      },
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander skickade notisen TASK_ASSIGNED till user@example.com'
    )
  })

  it('renders tombstone for deleted primary entity', () => {
    const deletedTask: ResolvedEntityRef = {
      id: 'task-gone',
      label: '[borttagen task]',
      href: null,
      deleted: true,
    }
    const parts = formatActivity({
      action: 'comment_added',
      entity_type: 'task',
      user: USER,
      old_value: null,
      new_value: { comment_id: 'c1' },
      primary: deletedTask,
    })
    const linkPart = parts.find((p) => p.kind === 'link')
    expect(linkPart).toBeDefined()
    if (linkPart && linkPart.kind === 'link') {
      expect(linkPart.deleted).toBe(true)
    }
  })

  it('renders requirement_comment_updated as "skrev kommentar" when adding', () => {
    const parts = formatActivity({
      action: 'requirement_comment_updated',
      entity_type: 'requirement',
      user: USER,
      old_value: { comment: null },
      new_value: { comment: 'Not from compliance review' },
      primary: requirementRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander skrev en kommentar på kravpunkten Årlig brandskyddsutbildning'
    )
  })

  it('renders requirement_comment_updated as "tog bort" when clearing', () => {
    const parts = formatActivity({
      action: 'requirement_comment_updated',
      entity_type: 'requirement',
      user: USER,
      old_value: { comment: 'Old note' },
      new_value: { comment: null },
      primary: requirementRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander tog bort kommentaren från kravpunkten Årlig brandskyddsutbildning'
    )
  })

  it('renders requirement_comment_updated as "redigerade" when editing', () => {
    const parts = formatActivity({
      action: 'requirement_comment_updated',
      entity_type: 'requirement',
      user: USER,
      old_value: { comment: 'Old note' },
      new_value: { comment: 'New note' },
      primary: requirementRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander redigerade kommentaren på kravpunkten Årlig brandskyddsutbildning'
    )
  })

  it('falls back to a generic sentence for unknown actions', () => {
    const parts = formatActivity({
      action: 'totally_made_up_action',
      entity_type: 'task',
      user: USER,
      old_value: null,
      new_value: null,
      primary: taskRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander utförde totally_made_up_action på Test'
    )
  })

  // ==========================================================================
  // Story 21.13: Compliance-audit cycle / items (Epic 21)
  // ==========================================================================

  const cycleRef: ResolvedEntityRef = {
    id: 'cycle-1',
    label: 'Q2 compliance review',
    href: '/laglistor/kontroller/cycle-1',
    deleted: false,
  }

  const auditItemRef: ResolvedEntityRef = {
    id: 'item-1',
    label: 'Miljöbalken (SFS 1998:808)',
    href: '/laglistor/kontroller/cycle-1#items',
    deleted: false,
  }

  it('renders cycle_created with cycle link', () => {
    const parts = formatActivity({
      action: 'cycle_created',
      entity_type: 'compliance_audit_cycle',
      user: USER,
      old_value: null,
      new_value: { name: 'Q2 compliance review' },
      primary: cycleRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander skapade kontrollen Q2 compliance review'
    )
  })

  it('cycle_metadata_updated without name change uses short sentence', () => {
    const parts = formatActivity({
      action: 'cycle_metadata_updated',
      entity_type: 'compliance_audit_cycle',
      user: USER,
      old_value: { auditType: 'INTERN' },
      new_value: { auditType: 'EXTERN' },
      primary: cycleRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander uppdaterade metadata på kontrollen Q2 compliance review'
    )
  })

  it('cycle_metadata_updated with name change appends rename tail', () => {
    const parts = formatActivity({
      action: 'cycle_metadata_updated',
      entity_type: 'compliance_audit_cycle',
      user: USER,
      old_value: { name: 'Q1 draft' },
      new_value: { name: 'Q2 compliance review' },
      primary: cycleRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander uppdaterade metadata på kontrollen Q2 compliance review: namnet ändrades från Q1 draft till Q2 compliance review'
    )
  })

  it('renders cycle_soft_deleted', () => {
    const parts = formatActivity({
      action: 'cycle_soft_deleted',
      entity_type: 'compliance_audit_cycle',
      user: USER,
      old_value: { status: 'PLANERAD' },
      new_value: null,
      primary: cycleRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander tog bort kontrollen Q2 compliance review'
    )
  })

  it('cycle_materialised with itemCount appends count suffix', () => {
    const parts = formatActivity({
      action: 'cycle_materialised',
      entity_type: 'compliance_audit_cycle',
      user: USER,
      old_value: null,
      new_value: { itemCount: 23, resolvedScopeSummary: 'all → 23 items' },
      primary: cycleRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander startade kontrollen Q2 compliance review (23 poster)'
    )
  })

  it('cycle_materialised without itemCount falls back to short sentence', () => {
    const parts = formatActivity({
      action: 'cycle_materialised',
      entity_type: 'compliance_audit_cycle',
      user: USER,
      old_value: null,
      new_value: { resolvedScopeSummary: 'all → 23 items' },
      primary: cycleRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander startade kontrollen Q2 compliance review'
    )
  })

  it('cycle_item_bedomning_updated with null→non-null uses — for null', () => {
    const parts = formatActivity({
      action: 'cycle_item_bedomning_updated',
      entity_type: 'compliance_audit_item',
      user: USER,
      old_value: { efterlevnadsbedomning: null },
      new_value: { efterlevnadsbedomning: 'UPPFYLLD' },
      primary: auditItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander ändrade bedömning på Miljöbalken (SFS 1998:808) från — till Uppfylld'
    )
  })

  it('cycle_item_bedomning_updated with non-null→non-null uses Swedish labels', () => {
    const parts = formatActivity({
      action: 'cycle_item_bedomning_updated',
      entity_type: 'compliance_audit_item',
      user: USER,
      old_value: { efterlevnadsbedomning: 'DELVIS' },
      new_value: { efterlevnadsbedomning: 'EJ_UPPFYLLD' },
      primary: auditItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander ändrade bedömning på Miljöbalken (SFS 1998:808) från Delvis till Ej uppfylld'
    )
  })

  it('cycle_item_bedomning_updated with non-null→null falls back to —', () => {
    const parts = formatActivity({
      action: 'cycle_item_bedomning_updated',
      entity_type: 'compliance_audit_item',
      user: USER,
      old_value: { efterlevnadsbedomning: 'EJ_TILLAMPLIG' },
      new_value: { efterlevnadsbedomning: null },
      primary: auditItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander ändrade bedömning på Miljöbalken (SFS 1998:808) från Ej tillämplig till —'
    )
  })

  it('cycle_item_motivering_updated NEVER renders the raw motivering text (privacy pin)', () => {
    // Story 21.5's log payload stores {old_length, new_length} only. Even if a
    // future refactor accidentally adds a raw-text key, this test ensures the
    // formatter does not surface it in the sentence.
    const RAW_MOTIVERING = 'kkkkkkk this is a very secret motivering kkkkkkk'
    const parts = formatActivity({
      action: 'cycle_item_motivering_updated',
      entity_type: 'compliance_audit_item',
      user: USER,
      old_value: { old_length: 0, motivering: RAW_MOTIVERING },
      new_value: {
        new_length: RAW_MOTIVERING.length,
        motivering: RAW_MOTIVERING,
      },
      primary: auditItemRef,
    })
    const flat = sentencePartsToText(parts)
    expect(flat).toBe(
      'Alexander uppdaterade motiveringen på Miljöbalken (SFS 1998:808)'
    )
    // Defensive belt-and-braces: assert the raw text is not in any part.
    expect(flat).not.toContain('secret motivering')
  })

  it('renders cycle_item_signed_off', () => {
    const parts = formatActivity({
      action: 'cycle_item_signed_off',
      entity_type: 'compliance_audit_item',
      user: USER,
      old_value: null,
      new_value: { signedAt: '2026-04-22T12:00:00Z', signedByUserId: 'u1' },
      primary: auditItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander signerade Miljöbalken (SFS 1998:808)'
    )
  })

  it('renders cycle_item_unsigned', () => {
    const parts = formatActivity({
      action: 'cycle_item_unsigned',
      entity_type: 'compliance_audit_item',
      user: USER,
      old_value: { signedAt: '2026-04-22T12:00:00Z', signedByUserId: 'u1' },
      new_value: null,
      primary: auditItemRef,
    })
    expect(sentencePartsToText(parts)).toBe(
      'Alexander ångrade signeringen på Miljöbalken (SFS 1998:808)'
    )
  })
})
