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
})
