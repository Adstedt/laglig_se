/**
 * Story 21.11 — Unit tests for `lib/compliance-audit/revisionsrapport-renderer.ts`.
 *
 * Coverage:
 *  - Golden fixture determinism (AC 13 — blocking CI)
 *  - Section presence + order
 *  - EXTERN/INTERN label + copy sweep (FR18)
 *  - Seal block conditional (FR13)
 *  - Konklusion branching (all four branches)
 *  - Empty states for each finding type
 *  - Severity subgrouping
 *  - Defensive null fields
 *  - Swedish locale formatting
 *  - 200-item performance assertion (IV2)
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  renderRevisionsrapport,
  type RevisionsrapportInput,
  type EvidenceSnapshotRow,
} from '@/lib/compliance-audit/revisionsrapport-renderer'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import type { AuditType, EfterlevnadsBedomning } from '@prisma/client'

const FIXTURE_DIR = join(process.cwd(), 'lib/compliance-audit/__fixtures__')
const FIXTURE_INPUT_PATH = join(FIXTURE_DIR, 'revisionsrapport-input.json')
const FIXTURE_OUTPUT_PATH = join(FIXTURE_DIR, 'revisionsrapport-output.html')

// ============================================================================
// Fixture builders
// ============================================================================

function fixedDate(iso: string): Date {
  return new Date(iso)
}

function makeCycle(overrides: Partial<CycleDetail> = {}): CycleDetail {
  const base: CycleDetail = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Årskontroll 2026 — AB Testbolaget',
    status: 'AVSLUTAD',
    auditType: 'EXTERN' as AuditType,
    scheduledStart: fixedDate('2026-01-15T00:00:00.000Z'),
    scheduledEnd: fixedDate('2026-03-31T00:00:00.000Z'),
    lawChangeCutoffDate: fixedDate('2026-01-01T00:00:00.000Z'),
    leadAuditor: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Anna Andersson',
    },
    lawList: {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'ISO 14001 laglista — verksamhet Uppsala',
    },
    itemCount: 3,
    createdAt: fixedDate('2026-01-10T10:00:00.000Z'),
    updatedAt: fixedDate('2026-04-01T12:00:00.000Z'),
    lawListId: '55555555-5555-4555-8555-555555555555',
    scopeDefinition: { kind: 'all' },
    // Story 21.26 — sealHash dropped from CycleDetail; sealedAt now records
    // the AVSLUTAD-completion timestamp.
    sealedAt: fixedDate('2026-04-01T14:30:00.000Z'),
    sealedBy: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Anna Andersson',
    },
    createdBy: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Anna Andersson',
    },
    deletedAt: null,
  }
  return { ...base, ...overrides }
}

function makeItem(
  overrides: Partial<CycleItemRow> &
    Pick<
      CycleItemRow,
      'id' | 'lawListItemId' | 'lawTitle' | 'lawDocumentNumber'
    >
): CycleItemRow {
  return {
    groupId: null,
    groupName: null,
    sourceComplianceStatus: 'UPPFYLLD',
    sourceResponsibleUser: null,
    efterlevnadsbedomning: 'UPPFYLLD',
    motivering: null,
    reviewedAt: null,
    reviewedBy: null,
    signedOffAt: null,
    signedOffBy: null,
    kravpunkterSnapshot: null,
    businessContext: null,
    ...overrides,
  } as CycleItemRow
}

function makeFinding(
  overrides: Partial<FindingRow> & Pick<FindingRow, 'id' | 'cycleId' | 'title'>
): FindingRow {
  return {
    type: 'AVVIKELSE',
    severity: 'MAJOR',
    description: 'Finding description.',
    rootCause: null,
    dueDate: null,
    closedAt: null,
    closedBy: null,
    lawListItemId: null,
    lawListItem: null,
    requirementId: null,
    requirement: null,
    correctiveActionTaskId: null,
    correctiveActionTask: null,
    createdAt: fixedDate('2026-02-01T10:00:00.000Z'),
    updatedAt: fixedDate('2026-02-01T10:00:00.000Z'),
    ...overrides,
  } as FindingRow
}

/**
 * The golden fixture. EXTERN + sealed + 3 items (UPPFYLLD / EJ_UPPFYLLD /
 * EJ_TILLAMPLIG) + 3 findings (1 AVVIKELSE MAJOR with task link, 1
 * OBSERVATION, 1 FORBATTRING closed) + 1 evidence snapshot.
 */
function buildFixtureInput(): RevisionsrapportInput {
  const cycle = makeCycle()

  const items: CycleItemRow[] = [
    makeItem({
      id: 'aaaa1111-1111-4111-8111-111111111111',
      lawListItemId: 'bbbb1111-1111-4111-8111-111111111111',
      lawTitle: 'Miljöbalken',
      lawDocumentNumber: 'SFS 1998:808',
      groupId: 'gggg1111-1111-4111-8111-111111111111',
      groupName: 'Miljörätt',
      efterlevnadsbedomning: 'UPPFYLLD',
      motivering: 'Organisationen har rutiner på plats.',
      sourceResponsibleUser: {
        id: 'uuuu1111-1111-4111-8111-111111111111',
        name: 'Erik Eriksson',
      },
      signedOffAt: fixedDate('2026-03-15T09:00:00.000Z'),
      signedOffBy: {
        id: 'uuuu1111-1111-4111-8111-111111111111',
        name: 'Erik Eriksson',
      },
    }),
    makeItem({
      id: 'aaaa2222-2222-4222-8222-222222222222',
      lawListItemId: 'bbbb2222-2222-4222-8222-222222222222',
      lawTitle: 'Arbetsmiljölagen',
      lawDocumentNumber: 'SFS 1977:1160',
      groupId: 'gggg2222-2222-4222-8222-222222222222',
      groupName: 'Arbetsmiljö',
      efterlevnadsbedomning: 'EJ_UPPFYLLD',
      motivering: 'Systematiskt arbetsmiljöarbete saknas dokumentation.',
      sourceResponsibleUser: null,
      signedOffAt: fixedDate('2026-03-20T11:30:00.000Z'),
      signedOffBy: {
        id: 'uuuu2222-2222-4222-8222-222222222222',
        name: 'Maria Svensson',
      },
    }),
    makeItem({
      id: 'aaaa3333-3333-4333-8333-333333333333',
      lawListItemId: 'bbbb3333-3333-4333-8333-333333333333',
      lawTitle: 'Lag om kassaregister',
      lawDocumentNumber: 'SFS 2007:592',
      groupId: null,
      groupName: null,
      efterlevnadsbedomning: 'EJ_TILLAMPLIG',
      motivering: 'Organisationen bedriver ingen kontantförsäljning.',
      sourceResponsibleUser: null,
      signedOffAt: fixedDate('2026-03-10T14:00:00.000Z'),
      signedOffBy: {
        id: 'uuuu1111-1111-4111-8111-111111111111',
        name: 'Erik Eriksson',
      },
    }),
  ]

  const findings: FindingRow[] = [
    makeFinding({
      id: 'ffff1111-1111-4111-8111-111111111111',
      cycleId: cycle.id,
      type: 'AVVIKELSE',
      severity: 'MAJOR',
      title: 'Saknar skriftlig riskbedömning',
      description:
        'Organisationens systematiska arbetsmiljöarbete saknar skriftlig riskbedömning enligt AFS 2001:1.',
      rootCause: 'Otydligt ansvar för SAM-processen.',
      dueDate: fixedDate('2026-05-31T00:00:00.000Z'),
      lawListItemId: 'bbbb2222-2222-4222-8222-222222222222',
      lawListItem: {
        id: 'bbbb2222-2222-4222-8222-222222222222',
        title: 'Arbetsmiljölagen',
        documentNumber: 'SFS 1977:1160',
      },
      correctiveActionTaskId: 'tttt1111-1111-4111-8111-111111111111',
      correctiveActionTask: {
        id: 'tttt1111-1111-4111-8111-111111111111',
        title: 'Upprätta skriftlig riskbedömning',
        completedAt: null,
      },
      createdAt: fixedDate('2026-03-20T12:00:00.000Z'),
    }),
    makeFinding({
      id: 'ffff2222-2222-4222-8222-222222222222',
      cycleId: cycle.id,
      type: 'OBSERVATION',
      severity: null,
      title: 'Rutinen för kemikaliehantering är utdaterad',
      description: 'Rutinen refererar till upphävd AFS.',
      createdAt: fixedDate('2026-03-18T10:00:00.000Z'),
    }),
    makeFinding({
      id: 'ffff3333-3333-4333-8333-333333333333',
      cycleId: cycle.id,
      type: 'FORBATTRING',
      severity: null,
      title: 'Möjlighet att digitalisera SAM-dokumentation',
      description: 'Pappersbaserat idag — kan flyttas till systemstöd.',
      closedAt: fixedDate('2026-04-01T10:00:00.000Z'),
      closedBy: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Anna Andersson',
      },
      createdAt: fixedDate('2026-03-25T14:00:00.000Z'),
    }),
  ]

  const snapshots: EvidenceSnapshotRow[] = [
    {
      id: 'ssss1111-1111-4111-8111-111111111111',
      lawListItemId: 'bbbb1111-1111-4111-8111-111111111111',
      requirementId: null,
      evidenceKind: 'FILE',
      evidenceSha256:
        '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
      capturedAt: fixedDate('2026-04-01T14:30:00.000Z'),
      displayName: 'Miljöutredning-2026.pdf',
    },
  ]

  return {
    cycle,
    items,
    findings,
    snapshots,
    workspace: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'AB Testbolaget',
    },
    generatedAt: '2026-04-23T08:00:00.000Z',
  }
}

// ============================================================================
// Golden fixture
// ============================================================================

describe('renderRevisionsrapport — golden fixture (AC 13)', () => {
  it('matches the committed HTML byte-for-byte', async () => {
    const input = buildFixtureInput()
    const html = renderRevisionsrapport(input)

    // Serialise the input fixture for diffability — unconditional overwrite
    // so the committed JSON always tracks `buildFixtureInput()`. Runs before
    // the HTML snapshot so `vitest -u` flows update both in lockstep.
    writeFileSync(
      FIXTURE_INPUT_PATH,
      JSON.stringify(input, null, 2) + '\n',
      'utf-8'
    )

    // Snapshot to file so drift is caught in CI. First run writes the file;
    // subsequent runs compare. Update via `vitest -u` after a deliberate
    // renderer change (see fixture update policy in story AC 13).
    await expect(html).toMatchFileSnapshot(FIXTURE_OUTPUT_PATH)
  })
})

// ============================================================================
// Determinism
// ============================================================================

describe('renderRevisionsrapport — determinism', () => {
  it('two consecutive calls on identical input produce identical strings', () => {
    const input = buildFixtureInput()
    const a = renderRevisionsrapport(input)
    const b = renderRevisionsrapport(input)
    expect(a).toBe(b)
  })

  it('items in non-alphabetised group order still produce alphabetised scope prose', () => {
    const input = buildFixtureInput()
    // Force a groups-scope with groupName ordering reversed at source; assert
    // output lists groups alphabetically regardless of input order.
    const shuffled: RevisionsrapportInput = {
      ...input,
      cycle: {
        ...input.cycle,
        scopeDefinition: {
          kind: 'groups',
          groupIds: ['gggg2222-2222-4222-8222-222222222222'],
        },
      },
      items: [
        { ...input.items[1]!, groupName: 'Öppen' },
        { ...input.items[0]!, groupName: 'Apa' },
        { ...input.items[2]!, groupName: 'Öppen' },
      ],
    }
    const html = renderRevisionsrapport(shuffled)
    // Apa should appear before Öppen in the emitted prose (sv collation).
    const apaIdx = html.indexOf('Apa')
    const oppenIdx = html.indexOf('Öppen')
    expect(apaIdx).toBeGreaterThan(0)
    expect(oppenIdx).toBeGreaterThan(apaIdx)
  })
})

// ============================================================================
// Section presence + order
// ============================================================================

describe('renderRevisionsrapport — section structure', () => {
  const SECTION_IDS = [
    'titelsida',
    'omfattning',
    'revisionskriterier',
    'metodik',
    'sammanfattning',
    'avvikelser',
    'observationer',
    'forbattringsforslag',
    'styrkor',
    'konklusion',
    'signatarer',
  ] as const

  it('includes every mandatory section in the documented order', () => {
    const html = renderRevisionsrapport(buildFixtureInput())
    const indices = SECTION_IDS.map((id) => html.indexOf(`id="${id}"`))
    indices.forEach((idx) => expect(idx).toBeGreaterThan(0))
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]!)
    }
  })

  it('emits a table-of-contents with one entry per content section', () => {
    const html = renderRevisionsrapport(buildFixtureInput())
    expect(html).toContain('<nav class="toc">')
    // 11 TOC entries (every section except titelsida — Story 21.22 added
    // efterlevnadsbeskrivningar).
    const tocEntries = html.match(/<li><a href="#/g) ?? []
    expect(tocEntries.length).toBe(11)
  })
})

// ============================================================================
// EXTERN vs INTERN framing sweep (FR18)
// ============================================================================

describe('renderRevisionsrapport — INTERN/EXTERN framing (FR18)', () => {
  const baseInput = buildFixtureInput()

  function withAuditType(auditType: AuditType): RevisionsrapportInput {
    return {
      ...baseInput,
      cycle: { ...baseInput.cycle, auditType },
    }
  }

  it('EXTERN uses ISO-flavoured section headings', () => {
    const html = renderRevisionsrapport(withAuditType('EXTERN'))
    expect(html).toContain('<h2>Revisionskriterier</h2>')
    expect(html).toContain('<h2>Metodik</h2>')
    expect(html).toContain('<h2>Signatarer</h2>')
  })

  it('INTERN uses neutral Swedish section headings', () => {
    const html = renderRevisionsrapport(withAuditType('INTERN'))
    expect(html).toContain('<h2>Kriterier</h2>')
    expect(html).toContain('<h2>Metod</h2>')
    expect(html).toContain('<h2>Signering</h2>')
    // And does NOT contain the EXTERN framing.
    expect(html).not.toContain('<h2>Revisionskriterier</h2>')
  })

  it('EXTERN cover metadata uses Revisionsledare / Revisionstyp: Extern', () => {
    const html = renderRevisionsrapport(withAuditType('EXTERN'))
    expect(html).toContain('Revisionsledare:')
    expect(html).toContain('Revisionstyp: Extern')
  })

  it('INTERN cover metadata uses Kontrolledare / Kontrolltyp: Intern', () => {
    const html = renderRevisionsrapport(withAuditType('INTERN'))
    expect(html).toContain('Kontrolledare:')
    expect(html).toContain('Kontrolltyp: Intern')
    expect(html).not.toContain('Revisionsledare:')
  })

  it('EXTERN kriterier prose starts with "Revisionen genomförs"', () => {
    const html = renderRevisionsrapport(withAuditType('EXTERN'))
    expect(html).toContain('Revisionen genomförs mot kraven')
  })

  it('INTERN kriterier prose starts with "Kontrollen genomförs"', () => {
    const html = renderRevisionsrapport(withAuditType('INTERN'))
    expect(html).toContain('Kontrollen genomförs mot kraven')
  })

  it('EXTERN metodik starts with "Revisionen har utförts" and includes ISO 19011', () => {
    const html = renderRevisionsrapport(withAuditType('EXTERN'))
    expect(html).toContain('Revisionen har utförts')
    expect(html).toContain(
      'Revisionens genomförande följer principerna i ISO 19011'
    )
  })

  it('INTERN metodik starts with "Genomgången har utförts" and omits ISO 19011', () => {
    const html = renderRevisionsrapport(withAuditType('INTERN'))
    expect(html).toContain('Genomgången har utförts')
    expect(html).not.toContain('ISO 19011')
  })
})

// ============================================================================
// Story 21.26 — Seal block conditional (FR13) tests removed alongside the
// SEAL collapse. sealHash is gone; the title-page "Avslutad kontroll" block
// renders sealed_at + sealed_by directly when set. Surface coverage moves to
// the AVSLUTAD-cycle render tests in the rest of this file.
// ============================================================================

// ============================================================================
// Bakgrund (description) section
// ============================================================================

describe('renderRevisionsrapport — bakgrund section', () => {
  it('omits the section + TOC entry entirely when description is null', () => {
    const html = renderRevisionsrapport(buildFixtureInput())
    expect(html).not.toContain('id="bakgrund"')
    expect(html).not.toContain('Bakgrund och syfte')
  })

  it('renders the section heading + body and adds a TOC entry when description is set', () => {
    const base = buildFixtureInput()
    const withDescription: RevisionsrapportInput = {
      ...base,
      cycle: {
        ...base.cycle,
        description:
          'Triggad av Q1 miljötillbud.\nÅrlig ISO 14001-kontroll per ledningsbeslut 2026-02-12.',
      },
    }
    const html = renderRevisionsrapport(withDescription)
    expect(html).toContain('<section id="bakgrund">')
    expect(html).toContain('Bakgrund och syfte')
    expect(html).toContain('Triggad av Q1 miljötillbud.')
    expect(html).toContain('ledningsbeslut 2026-02-12.')
    // Multiline description preserves newlines as <br/>
    expect(html).toContain('miljötillbud.<br/>Årlig')
    // TOC entry present
    expect(html).toContain('<a href="#bakgrund">Bakgrund och syfte</a>')
  })

  it('escapes HTML in the description body', () => {
    const base = buildFixtureInput()
    const withDescription: RevisionsrapportInput = {
      ...base,
      cycle: {
        ...base.cycle,
        description: 'Bakgrund <script>alert(1)</script>',
      },
    }
    const html = renderRevisionsrapport(withDescription)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('treats whitespace-only description as empty (omits section)', () => {
    const base = buildFixtureInput()
    const withWhitespace: RevisionsrapportInput = {
      ...base,
      cycle: { ...base.cycle, description: '   \n  \t  ' },
    }
    const html = renderRevisionsrapport(withWhitespace)
    expect(html).not.toContain('id="bakgrund"')
    expect(html).not.toContain('Bakgrund och syfte')
  })
})

// ============================================================================
// Konklusion branches
// ============================================================================

describe('renderRevisionsrapport — konklusion branches', () => {
  const base = buildFixtureInput()

  function withItemsAndFindings(
    items: CycleItemRow[],
    findings: FindingRow[]
  ): RevisionsrapportInput {
    return { ...base, items, findings }
  }

  const mkItem = (bedomning: EfterlevnadsBedomning | null, i: number) =>
    makeItem({
      id: `aaaa${i}000-0000-4000-8000-000000000000`,
      lawListItemId: `bbbb${i}000-0000-4000-8000-000000000000`,
      lawTitle: `Lag ${i}`,
      lawDocumentNumber: `SFS 0000:${i}`,
      efterlevnadsbedomning: bedomning,
      signedOffAt: fixedDate('2026-03-01T00:00:00.000Z'),
      signedOffBy: { id: base.cycle.leadAuditor.id, name: 'X' },
    })

  it('branch 1: all uppfyllda + zero open avvikelser → "Samtliga tillämpliga krav … uppfyllda"', () => {
    const html = renderRevisionsrapport(
      withItemsAndFindings(
        [mkItem('UPPFYLLD', 1), mkItem('EJ_TILLAMPLIG', 2)],
        []
      )
    )
    expect(html).toContain('Samtliga tillämpliga krav')
    expect(html).toContain('Inga öppna avvikelser kvarstår')
  })

  it('branch 2: any EJ_UPPFYLLD → "identifierade N krav som inte är uppfyllda"', () => {
    const html = renderRevisionsrapport(
      withItemsAndFindings(
        [mkItem('UPPFYLLD', 1), mkItem('EJ_UPPFYLLD', 2)],
        []
      )
    )
    expect(html).toContain('identifierade 1 krav som inte är uppfyllda')
  })

  it('branch 2: any open AVVIKELSE → same copy', () => {
    const html = renderRevisionsrapport(
      withItemsAndFindings(
        [mkItem('UPPFYLLD', 1)],
        [
          makeFinding({
            id: 'ffff0000-0000-4000-8000-000000000000',
            cycleId: base.cycle.id,
            title: 'Open avvikelse',
            severity: 'MAJOR',
          }),
        ]
      )
    )
    expect(html).toContain('öppen(a) avvikelse(r)')
  })

  it('branch 3: DELVIS only → "i huvudsak uppfylla kraven"', () => {
    const html = renderRevisionsrapport(
      withItemsAndFindings([mkItem('DELVIS', 1), mkItem('UPPFYLLD', 2)], [])
    )
    expect(html).toContain('i huvudsak uppfylla kraven')
    expect(html).toContain('1 krav är delvis uppfyllda')
  })

  it('branch 4 (fallback): zero items triggers fallback copy', () => {
    const html = renderRevisionsrapport(withItemsAndFindings([], []))
    expect(html).toContain(
      'Kontrollen har genomförts och samtliga dokument har bedömts'
    )
  })
})

// ============================================================================
// Empty states
// ============================================================================

describe('renderRevisionsrapport — empty states', () => {
  it('zero findings of each type render the "Inga …" copy', () => {
    const base = buildFixtureInput()
    const noFindings: RevisionsrapportInput = { ...base, findings: [] }
    const html = renderRevisionsrapport(noFindings)
    expect(html).toContain('Inga avvikelser identifierade.')
    expect(html).toContain('Inga observationer identifierade.')
    expect(html).toContain('Inga förbättringsförslag identifierade.')
  })

  it('zero items does not throw and renders the omfattning empty-state row', () => {
    const base = buildFixtureInput()
    const empty: RevisionsrapportInput = { ...base, items: [] }
    expect(() => renderRevisionsrapport(empty)).not.toThrow()
    const html = renderRevisionsrapport(empty)
    expect(html).toContain('Kontrollen har inga poster.')
  })
})

// ============================================================================
// Severity subgrouping + defensive nulls
// ============================================================================

describe('renderRevisionsrapport — severity + defensive nulls', () => {
  it('avvikelser render MAJOR before MINOR with both subheadings', () => {
    const base = buildFixtureInput()
    const findings: FindingRow[] = [
      makeFinding({
        id: 'ffff0001-0001-4001-8001-000000000001',
        cycleId: base.cycle.id,
        title: 'Major 1',
        severity: 'MAJOR',
        createdAt: fixedDate('2026-02-01T10:00:00.000Z'),
      }),
      makeFinding({
        id: 'ffff0002-0002-4002-8002-000000000002',
        cycleId: base.cycle.id,
        title: 'Major 2',
        severity: 'MAJOR',
        createdAt: fixedDate('2026-02-02T10:00:00.000Z'),
      }),
      makeFinding({
        id: 'ffff0003-0003-4003-8003-000000000003',
        cycleId: base.cycle.id,
        title: 'Minor 1',
        severity: 'MINOR',
        createdAt: fixedDate('2026-02-03T10:00:00.000Z'),
      }),
    ]
    const html = renderRevisionsrapport({ ...base, findings })
    const majorIdx = html.indexOf('Allvarlighetsgrad: Major')
    const minorIdx = html.indexOf('Allvarlighetsgrad: Minor')
    expect(majorIdx).toBeGreaterThan(0)
    expect(minorIdx).toBeGreaterThan(majorIdx)
  })

  it('null-severity AVVIKELSE renders under "Allvarlighetsgrad saknas" without throwing', () => {
    const base = buildFixtureInput()
    const findings: FindingRow[] = [
      makeFinding({
        id: 'ffff0004-0004-4004-8004-000000000004',
        cycleId: base.cycle.id,
        title: 'Missing severity',
        type: 'AVVIKELSE',
        severity: null,
      }),
    ]
    expect(() => renderRevisionsrapport({ ...base, findings })).not.toThrow()
    const html = renderRevisionsrapport({ ...base, findings })
    expect(html).toContain('Allvarlighetsgrad saknas')
  })

  it('finding without lawListItem back-reference renders "Dokument: —"', () => {
    const base = buildFixtureInput()
    const findings: FindingRow[] = [
      makeFinding({
        id: 'ffff0005-0005-4005-8005-000000000005',
        cycleId: base.cycle.id,
        title: 'Orphan avvikelse',
        lawListItemId: null,
        lawListItem: null,
      }),
    ]
    const html = renderRevisionsrapport({ ...base, findings })
    expect(html).toContain('Dokument: —')
  })
})

// ============================================================================
// Swedish locale formatting
// ============================================================================

describe('renderRevisionsrapport — Swedish date formatting', () => {
  it('formats months in Swedish (not English)', () => {
    const html = renderRevisionsrapport(buildFixtureInput())
    // Golden fixture has scheduledStart 2026-01-15, generatedAt 2026-04-23.
    // Swedish month abbreviations: jan, feb, mar, apr…
    expect(html).toMatch(/\bjan\.? 2026\b|\b15 jan\.? 2026\b/i)
    expect(html).toMatch(/\bapr\.? 2026\b|\b23 apr\.? 2026\b/i)
    // Ensure English month names don't leak through.
    expect(html).not.toMatch(/\bJan\s+2026\b/)
    expect(html).not.toContain('January')
    expect(html).not.toContain('April')
  })
})

// ============================================================================
// Performance (IV2)
// ============================================================================

describe('renderRevisionsrapport — performance (IV2)', () => {
  it('renders a 200-item cycle with 50 findings in under 2s', () => {
    const base = buildFixtureInput()
    const bigItems: CycleItemRow[] = Array.from({ length: 200 }, (_, i) =>
      makeItem({
        id: `aaaa${String(i).padStart(4, '0')}-0000-4000-8000-000000000000`,
        lawListItemId: `bbbb${String(i).padStart(4, '0')}-0000-4000-8000-000000000000`,
        lawTitle: `Lag nr ${i}`,
        lawDocumentNumber: `SFS 2026:${i}`,
        efterlevnadsbedomning:
          i % 4 === 0
            ? 'UPPFYLLD'
            : i % 4 === 1
              ? 'DELVIS'
              : i % 4 === 2
                ? 'EJ_UPPFYLLD'
                : 'EJ_TILLAMPLIG',
        signedOffAt: fixedDate('2026-03-01T00:00:00.000Z'),
        signedOffBy: { id: base.cycle.leadAuditor.id, name: 'Signerare' },
      })
    )
    const bigFindings: FindingRow[] = Array.from({ length: 50 }, (_, i) =>
      makeFinding({
        id: `ffff${String(i).padStart(4, '0')}-0000-4000-8000-000000000000`,
        cycleId: base.cycle.id,
        title: `Finding ${i}`,
        type:
          i % 3 === 0
            ? 'AVVIKELSE'
            : i % 3 === 1
              ? 'OBSERVATION'
              : 'FORBATTRING',
        severity: i % 3 === 0 ? 'MAJOR' : null,
        createdAt: fixedDate(
          `2026-02-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`
        ),
      })
    )
    const big: RevisionsrapportInput = {
      ...base,
      items: bigItems,
      findings: bigFindings,
    }

    const start = performance.now()
    const html = renderRevisionsrapport(big)
    const duration = performance.now() - start

    expect(html.length).toBeGreaterThan(10_000)
    expect(duration).toBeLessThan(2000)
  })
})
