/**
 * Story 21.9 — tests for seal-manifest-builder.ts.
 * Pure function; verifies deterministic sort + null preservation.
 */

import { describe, it, expect } from 'vitest'
import {
  buildSealManifest,
  type SealManifestInput,
} from '@/lib/compliance-audit/seal-manifest-builder'

function makeBaseInput(): SealManifestInput {
  return {
    cycleId: 'cycle-1',
    workspaceId: 'ws-1',
    lawListId: 'list-1',
    name: 'Test cycle',
    auditType: 'INTERN',
    scheduledStart: '2026-01-01T00:00:00.000Z',
    scheduledEnd: '2026-03-31T00:00:00.000Z',
    lawChangeCutoffDate: '2026-01-01T00:00:00.000Z',
    leadAuditorUserId: 'user-1',
    createdByUserId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    sealedAt: '2026-04-24T12:00:00.000Z',
    sealedByUserId: 'user-1',
    scopeDefinition: { kind: 'all' },
    overrideReason: null,
    draftDocumentsAtSeal: [],
    items: [],
    findings: [],
    evidence: [],
  }
}

describe('buildSealManifest', () => {
  it('sorts items by id ascending', () => {
    const input = makeBaseInput()
    input.items = [
      {
        id: 'c',
        lawListItemId: 'l-c',
        efterlevnadsbedomning: null,
        motiveringSha256: null,
        reviewedAt: null,
        reviewedByUserId: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
      {
        id: 'a',
        lawListItemId: 'l-a',
        efterlevnadsbedomning: null,
        motiveringSha256: null,
        reviewedAt: null,
        reviewedByUserId: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
      {
        id: 'b',
        lawListItemId: 'l-b',
        efterlevnadsbedomning: null,
        motiveringSha256: null,
        reviewedAt: null,
        reviewedByUserId: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
    ]
    const result = buildSealManifest(input)
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts findings by id ascending', () => {
    const input = makeBaseInput()
    input.findings = [
      {
        id: 'z',
        type: 'OBSERVATION',
        severity: null,
        title: 'z',
        descriptionSha256: 'x',
        rootCauseSha256: null,
        lawListItemId: null,
        requirementId: null,
        correctiveActionTaskId: null,
        dueDate: null,
        closedAt: null,
        closedByUserId: null,
      },
      {
        id: 'a',
        type: 'AVVIKELSE',
        severity: 'MINOR',
        title: 'a',
        descriptionSha256: 'x',
        rootCauseSha256: null,
        lawListItemId: null,
        requirementId: null,
        correctiveActionTaskId: null,
        dueDate: null,
        closedAt: null,
        closedByUserId: null,
      },
    ]
    const result = buildSealManifest(input)
    expect(result.findings.map((f) => f.id)).toEqual(['a', 'z'])
  })

  it('sorts evidence by (kind, evidenceId) composite', () => {
    const input = makeBaseInput()
    input.evidence = [
      {
        lawListItemId: null,
        requirementId: null,
        kind: 'FILE',
        evidenceId: 'f-2',
        sha256: 'x',
      },
      {
        lawListItemId: null,
        requirementId: null,
        kind: 'DOCUMENT',
        evidenceId: 'd-1',
        sha256: 'x',
      },
      {
        lawListItemId: null,
        requirementId: null,
        kind: 'FILE',
        evidenceId: 'f-1',
        sha256: 'x',
      },
    ]
    const result = buildSealManifest(input)
    expect(result.evidence.map((e) => `${e.kind}:${e.evidenceId}`)).toEqual([
      'DOCUMENT:d-1',
      'FILE:f-1',
      'FILE:f-2',
    ])
  })

  it('preserves null values (does not omit nullable fields)', () => {
    const input = makeBaseInput()
    input.overrideReason = null
    const result = buildSealManifest(input)
    expect(result.overrideReason).toBeNull()
    expect('overrideReason' in result).toBe(true)
  })

  it('does NOT embed raw motivering text — only the sha256 hash', () => {
    const input = makeBaseInput()
    input.items = [
      {
        id: 'a',
        lawListItemId: 'l-a',
        efterlevnadsbedomning: 'UPPFYLLD',
        motiveringSha256: 'abc123',
        reviewedAt: null,
        reviewedByUserId: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
    ]
    const result = buildSealManifest(input)
    const serialised = JSON.stringify(result)
    expect(serialised).toContain('"motiveringSha256":"abc123"')
    // Prove the type doesn't have a raw `motivering` key
    expect(serialised).not.toContain('"motivering":')
  })

  it('v0.5 — draftDocumentsAtSeal sorted by id; empty array preserved', () => {
    const input = makeBaseInput()
    input.draftDocumentsAtSeal = [
      { id: 'd-z', title: 'Brandskydd' },
      { id: 'd-a', title: 'Avfallsregister' },
    ]
    const result = buildSealManifest(input)
    expect(result.draftDocumentsAtSeal.map((d) => d.id)).toEqual(['d-a', 'd-z'])

    // Empty case stays empty (not omitted) — preserves the canonical hash
    // shape across cycles with and without the override invoked.
    const empty = buildSealManifest(makeBaseInput())
    expect(empty.draftDocumentsAtSeal).toEqual([])
    expect('draftDocumentsAtSeal' in empty).toBe(true)
  })

  it('does not mutate the input', () => {
    const input = makeBaseInput()
    input.items = [
      {
        id: 'c',
        lawListItemId: 'l-c',
        efterlevnadsbedomning: null,
        motiveringSha256: null,
        reviewedAt: null,
        reviewedByUserId: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
      {
        id: 'a',
        lawListItemId: 'l-a',
        efterlevnadsbedomning: null,
        motiveringSha256: null,
        reviewedAt: null,
        reviewedByUserId: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
    ]
    const originalOrder = input.items.map((i) => i.id)
    buildSealManifest(input)
    expect(input.items.map((i) => i.id)).toEqual(originalOrder)
  })
})
