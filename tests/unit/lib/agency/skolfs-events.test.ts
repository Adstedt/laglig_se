import { describe, it, expect, vi } from 'vitest'
import {
  emitSkolfsChangeEvent,
  skolfsAmendmentSfs,
  skolfsChangeType,
  type SkolfsEventClient,
} from '@/lib/agency/skolfs-events'
import type { SkolfsSignal } from '@/lib/agency/skolfs-change-detection'

const sig = (over: Partial<SkolfsSignal> = {}): SkolfsSignal => ({
  kind: 'AMENDMENT',
  documentNumber: 'SKOLFS 2024:616',
  amendmentSkolfsNo: '2025:449',
  effectiveDate: '2025-11-10',
  changedSections: 'ändr. 14 §',
  reason:
    'SKOLFS 2024:616 ändrad genom 2025:449 (ändr. 14 §), i kraft 2025-11-10.',
  ...over,
})

function fakeClient(existing: { id: string } | null = null): {
  client: SkolfsEventClient
  create: ReturnType<typeof vi.fn>
  docUpdate: ReturnType<typeof vi.fn>
} {
  const create = vi.fn(async () => ({ id: 'ce_new' }))
  const docUpdate = vi.fn(async () => ({}))
  const client: SkolfsEventClient = {
    changeEvent: {
      findFirst: vi.fn(async () => existing),
      create,
    },
    legalDocument: { update: docUpdate },
  }
  return { client, create, docUpdate }
}

describe('skolfsAmendmentSfs / skolfsChangeType', () => {
  it('prefixes the amendment number', () => {
    expect(skolfsAmendmentSfs(sig())).toBe('SKOLFS 2025:449')
    expect(skolfsAmendmentSfs(sig({ amendmentSkolfsNo: null }))).toBeNull()
  })

  it('maps every signal kind to a ChangeType', () => {
    expect(skolfsChangeType('AMENDMENT')).toBe('AMENDMENT')
    expect(skolfsChangeType('NEW_LAW')).toBe('NEW_LAW')
    expect(skolfsChangeType('REPEAL')).toBe('REPEAL')
    expect(skolfsChangeType('UPCOMING_AMENDMENT')).toBe('UPCOMING_AMENDMENT')
  })
})

describe('emitSkolfsChangeEvent', () => {
  it('creates a ChangeEvent with ai_summary + changed_sections set in-detector', async () => {
    const { client, create, docUpdate } = fakeClient(null)
    const result = await emitSkolfsChangeEvent('doc_1', sig(), client)

    expect(result).toEqual({ status: 'created', id: 'ce_new' })
    const data = create.mock.calls[0]![0].data
    expect(data.document_id).toBe('doc_1')
    expect(data.content_type).toBe('AGENCY_REGULATION')
    expect(data.change_type).toBe('AMENDMENT')
    expect(data.amendment_sfs).toBe('SKOLFS 2025:449')
    expect(data.ai_summary).toContain('ändrad genom 2025:449')
    expect(data.changed_sections).toEqual({ raw: 'ändr. 14 §' })
    // advances the base document's last_change_* tracking
    expect(docUpdate).toHaveBeenCalledOnce()
  })

  it('dedups on (document_id, amendment_sfs) — returns duplicate, no create', async () => {
    const { client, create } = fakeClient({ id: 'ce_existing' })
    const result = await emitSkolfsChangeEvent('doc_1', sig(), client)
    expect(result).toEqual({ status: 'duplicate', id: 'ce_existing' })
    expect(create).not.toHaveBeenCalled()
  })

  it('dedups NEW_LAW/REPEAL (null amendment_sfs) on (document_id, change_type)', async () => {
    const { client } = fakeClient(null)
    const findFirst = client.changeEvent.findFirst as ReturnType<typeof vi.fn>
    await emitSkolfsChangeEvent(
      'doc_1',
      sig({ kind: 'REPEAL', amendmentSkolfsNo: null }),
      client
    )
    expect(findFirst.mock.calls[0]![0].where).toEqual({
      document_id: 'doc_1',
      change_type: 'REPEAL',
      amendment_sfs: null,
    })
  })

  it('emits UPCOMING_AMENDMENT with the migration-added ChangeType', async () => {
    const { client, create } = fakeClient(null)
    const result = await emitSkolfsChangeEvent(
      'doc_1',
      sig({
        kind: 'UPCOMING_AMENDMENT',
        amendmentSkolfsNo: '2026:23',
        reason:
          'Kommande ändring av SKOLFS 2024:616 genom 2026:23 träder i kraft 2026-07-01.',
      }),
      client
    )
    expect(result).toEqual({ status: 'created', id: 'ce_new' })
    expect(create.mock.calls[0]![0].data.change_type).toBe('UPCOMING_AMENDMENT')
    expect(create.mock.calls[0]![0].data.amendment_sfs).toBe('SKOLFS 2026:23')
  })

  it('omits changed_sections when the signal has none', async () => {
    const { client, create } = fakeClient(null)
    await emitSkolfsChangeEvent('doc_1', sig({ changedSections: null }), client)
    expect(create.mock.calls[0]![0].data.changed_sections).toBeUndefined()
  })
})
