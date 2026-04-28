/**
 * Story 21.11 — Deterministic HTML renderer for revisionsrapport.
 *
 * Pure function. No DB access, no `fetch`, no `Date.now()`, no `Math.random()`,
 * no `crypto.randomUUID()`, no external I/O. Every rendered string is derived
 * from the `RevisionsrapportInput` argument — `generatedAt` is caller-supplied
 * so the renderer itself never calls `new Date()` to read the clock.
 *
 * Output is a complete, self-contained HTML document (`<!DOCTYPE>…</html>`)
 * with inline `<style>`. Story 21.12 will feed this string to Puppeteer for
 * PDF generation; the self-contained shape is deliberate so the PDF pipeline
 * needs zero external CSS.
 *
 * Determinism is enforced by a golden-fixture test in
 * `tests/unit/lib/compliance-audit/revisionsrapport-renderer.test.ts`.
 * Any intentional change to the rendered output must update both
 * `__fixtures__/revisionsrapport-input.json` and
 * `__fixtures__/revisionsrapport-output.html` in the same PR.
 *
 * Section structure + copy rules: see `docs/stories/21.11.revisionsrapport-html-renderer.md`.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import type {
  ComplianceCycleStatus,
  EfterlevnadsBedomning,
  FindingSeverity,
  FindingType,
} from '@prisma/client'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'

// ============================================================================
// Public types
// ============================================================================

export interface EvidenceSnapshotRow {
  id: string
  lawListItemId: string | null
  requirementId: string | null
  evidenceKind: 'FILE' | 'DOCUMENT'
  evidenceSha256: string
  capturedAt: Date
  displayName: string
}

export interface RevisionsrapportInput {
  cycle: CycleDetail
  items: CycleItemRow[]
  findings: FindingRow[]
  snapshots: EvidenceSnapshotRow[]
  workspace: { id: string; name: string }
  generatedAt: string
}

// ============================================================================
// Module-private labels + helpers
// ============================================================================

type SectionVariant = 'internal' | 'external'

type SectionId =
  | 'titelsida'
  | 'bakgrund'
  | 'omfattning'
  | 'revisionskriterier'
  | 'metodik'
  | 'sammanfattning'
  | 'efterlevnadsbeskrivningar'
  | 'avvikelser'
  | 'observationer'
  | 'forbattringsforslag'
  | 'styrkor'
  | 'konklusion'
  | 'signatarer'

const SECTION_LABELS: Record<SectionVariant, Record<SectionId, string>> = {
  internal: {
    titelsida: '',
    bakgrund: 'Bakgrund och syfte',
    omfattning: 'Omfattning',
    revisionskriterier: 'Kriterier',
    metodik: 'Metod',
    sammanfattning: 'Sammanfattning',
    efterlevnadsbeskrivningar: 'Efterlevnadsbeskrivningar',
    avvikelser: 'Avvikelser',
    observationer: 'Observationer',
    forbattringsforslag: 'Förbättringsförslag',
    styrkor: 'Styrkor',
    konklusion: 'Konklusion',
    signatarer: 'Signering',
  },
  external: {
    titelsida: '',
    bakgrund: 'Bakgrund och syfte',
    omfattning: 'Omfattning',
    revisionskriterier: 'Revisionskriterier',
    metodik: 'Metodik',
    sammanfattning: 'Sammanfattning',
    efterlevnadsbeskrivningar: 'Efterlevnadsbeskrivningar',
    avvikelser: 'Avvikelser',
    observationer: 'Observationer',
    forbattringsforslag: 'Förbättringsförslag',
    styrkor: 'Styrkor',
    konklusion: 'Konklusion',
    signatarer: 'Signatarer',
  },
}

const TOC_ORDER: SectionId[] = [
  'bakgrund',
  'omfattning',
  'revisionskriterier',
  'metodik',
  'sammanfattning',
  'efterlevnadsbeskrivningar',
  'avvikelser',
  'observationer',
  'forbattringsforslag',
  'styrkor',
  'konklusion',
  'signatarer',
]

function bedomningLabel(value: EfterlevnadsBedomning | null): string {
  switch (value) {
    case 'UPPFYLLD':
      return 'Uppfylld'
    case 'DELVIS':
      return 'Delvis uppfylld'
    case 'EJ_UPPFYLLD':
      return 'Ej uppfylld'
    case 'EJ_TILLAMPLIG':
      return 'Ej tillämplig'
    case null:
      return '—'
  }
}

function cycleStatusLabel(status: ComplianceCycleStatus): string {
  switch (status) {
    case 'PLANERAD':
      return 'Planerad'
    case 'PAGAENDE':
      return 'Pågående'
    case 'AVSLUTAD':
      return 'Avslutad'
  }
}

function severityLabel(severity: FindingSeverity | null): string {
  if (severity === 'MAJOR') return 'Major'
  if (severity === 'MINOR') return 'Minor'
  return 'Okänd'
}

function formatDate(value: Date | string, pattern = 'd MMM yyyy'): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return format(date, pattern, { locale: sv })
}

/**
 * Mirrors `lib/documents/tiptap-to-pdf.ts:87-93`. Kept inline so the renderer
 * stays self-contained for Story 21.12's PDF pipeline — do NOT import.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeNullable(
  value: string | null | undefined,
  fallback = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback
  return escapeHtml(value)
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, Math.max(0, max - 1)) + '…'
}

function escapeHtmlMultiline(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br/>')
}

// ============================================================================
// Inline style block
// ============================================================================

const STYLE_BLOCK = `<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    padding: 24px;
  }
  h1 { font-size: 22pt; margin-bottom: 16px; }
  h2 { font-size: 16pt; margin: 24px 0 12px; }
  h3 { font-size: 13pt; margin: 12px 0 6px; }
  h4 { font-size: 11pt; font-weight: 600; margin: 8px 0 4px; }
  p { margin: 6px 0; }
  ol, ul { margin: 6px 0 6px 24px; }
  section { page-break-inside: avoid; margin-bottom: 24px; }
  .meta { font-size: 10pt; color: #444; margin: 2px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 10pt; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  .seal-block {
    background: #ecfdf5;
    border: 1px solid #10b981;
    padding: 16px;
    border-radius: 4px;
    margin: 16px 0;
  }
  .seal-block h3 { margin-top: 0; }
  .seal-hash {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    word-break: break-all;
    display: block;
    margin-top: 8px;
  }
  .badge {
    display: inline-block;
    font-size: 9pt;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: 8px;
  }
  .badge-major { color: #dc2626; background: #fef2f2; }
  .badge-minor { color: #d97706; background: #fffbeb; }
  .finding {
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    padding: 12px;
    margin: 12px 0;
    page-break-inside: avoid;
  }
  .finding-meta { font-size: 9pt; color: #666; margin: 4px 0 8px; }
  .description { margin: 8px 0; }
  .root-cause, .corrective-action { font-size: 10pt; margin-top: 6px; }
  .toc ol { list-style: decimal inside; padding-left: 0; }
  .toc li { margin: 3px 0; }
  .toc a { color: #2563eb; text-decoration: none; }
  .toc .toc-sub { display: block; font-size: 9pt; color: #666; margin-left: 20px; }
  .empty-state { font-style: italic; color: #666; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; }
</style>`

// ============================================================================
// Pre-aggregated counts (computed once per render)
// ============================================================================

interface RenderCounts {
  total: number
  uppfyllda: number
  delvis: number
  ejUppfyllda: number
  ejTillampliga: number
  obedomda: number
  avvikelser: number
  avvikelserMajor: number
  avvikelserMinor: number
  observationer: number
  forbattringsforslag: number
  openFindings: number
  closedFindings: number
  openAvvikelser: number
}

function computeCounts(
  items: CycleItemRow[],
  findings: FindingRow[]
): RenderCounts {
  let uppfyllda = 0
  let delvis = 0
  let ejUppfyllda = 0
  let ejTillampliga = 0
  let obedomda = 0
  for (const item of items) {
    switch (item.efterlevnadsbedomning) {
      case 'UPPFYLLD':
        uppfyllda++
        break
      case 'DELVIS':
        delvis++
        break
      case 'EJ_UPPFYLLD':
        ejUppfyllda++
        break
      case 'EJ_TILLAMPLIG':
        ejTillampliga++
        break
      case null:
        obedomda++
        break
    }
  }

  let avvikelser = 0
  let avvikelserMajor = 0
  let avvikelserMinor = 0
  let observationer = 0
  let forbattringsforslag = 0
  let openFindings = 0
  let closedFindings = 0
  let openAvvikelser = 0
  for (const f of findings) {
    if (f.type === 'AVVIKELSE') {
      avvikelser++
      if (f.severity === 'MAJOR') avvikelserMajor++
      if (f.severity === 'MINOR') avvikelserMinor++
      if (f.closedAt === null) openAvvikelser++
    } else if (f.type === 'OBSERVATION') {
      observationer++
    } else if (f.type === 'FORBATTRING') {
      forbattringsforslag++
    }
    if (f.closedAt === null) openFindings++
    else closedFindings++
  }

  return {
    total: items.length,
    uppfyllda,
    delvis,
    ejUppfyllda,
    ejTillampliga,
    obedomda,
    avvikelser,
    avvikelserMajor,
    avvikelserMinor,
    observationer,
    forbattringsforslag,
    openFindings,
    closedFindings,
    openAvvikelser,
  }
}

// ============================================================================
// Section renderers
// ============================================================================

function renderTitelsida(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const { cycle, workspace, generatedAt } = input
  const leaderLabel =
    variant === 'external' ? 'Revisionsledare' : 'Kontrolledare'
  const typeLabel = variant === 'external' ? 'Revisionstyp' : 'Kontrolltyp'
  const typeValue = cycle.auditType === 'EXTERN' ? 'Extern' : 'Intern'

  const periodStart = formatDate(cycle.scheduledStart)
  const periodEnd = formatDate(cycle.scheduledEnd)
  const generatedLabel = formatDate(generatedAt, 'd MMM yyyy HH:mm')

  // Story 21.26 — sealHash dropped from CycleDetail. Completion-block now
  // shows just the timestamp + signer when AVSLUTAD/ARKIVERAD; no hash.
  let sealBlock = ''
  if (cycle.sealedAt !== null) {
    const sealedAt = formatDate(cycle.sealedAt, 'd MMM yyyy HH:mm')
    const sealedBy = cycle.sealedBy?.name ?? '—'
    sealBlock = `
    <div class="seal-block">
      <h3>Avslutad kontroll</h3>
      <p class="meta">Avslutad: ${escapeHtml(sealedAt)}</p>
      <p class="meta">Avslutad av: ${escapeHtml(sealedBy)}</p>
    </div>`
  }

  return `  <section id="titelsida">
    <h1>${escapeHtml(cycle.name)}</h1>
    <div class="metadata">
      <p class="meta">Laglista: ${escapeHtml(cycle.lawList.name)}</p>
      <p class="meta">Period: ${escapeHtml(periodStart)}–${escapeHtml(periodEnd)}</p>
      <p class="meta">${leaderLabel}: ${escapeNullable(cycle.leadAuditor.name)}</p>
      <p class="meta">${typeLabel}: ${typeValue}</p>
      <p class="meta">Status: ${escapeHtml(cycleStatusLabel(cycle.status))}</p>
      <p class="meta">Workspace: ${escapeHtml(workspace.name)}</p>
      <p class="meta">Rapport genererad: ${escapeHtml(generatedLabel)}</p>
    </div>${sealBlock}
  </section>`
}

function renderTOC(
  input: RevisionsrapportInput,
  variant: SectionVariant,
  counts: RenderCounts
): string {
  const hasDescription = Boolean(input.cycle.description?.trim())
  const entries = TOC_ORDER.filter((id) => id !== 'bakgrund' || hasDescription)
    .map((id) => {
      const label = SECTION_LABELS[variant][id]
      let sub = ''
      if (id === 'sammanfattning') {
        sub = `<span class="toc-sub">${counts.total} dokument, ${input.findings.length} findings</span>`
      }
      return `      <li><a href="#${id}">${escapeHtml(label)}</a>${sub}</li>`
    })
    .join('\n')
  return `  <nav class="toc">
    <h2>Innehåll</h2>
    <ol>
${entries}
    </ol>
  </nav>`
}

function renderBakgrund(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const description = input.cycle.description?.trim()
  if (!description) return ''
  const heading = SECTION_LABELS[variant].bakgrund
  return `  <section id="bakgrund">
    <h2>${escapeHtml(heading)}</h2>
    <p>${escapeHtmlMultiline(description)}</p>
  </section>`
}

function renderOmfattning(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const { cycle, items } = input
  const listName = escapeHtml(cycle.lawList.name)

  let prose = ''
  switch (cycle.scopeDefinition.kind) {
    case 'all':
      prose = `Kontrollen omfattar samtliga dokument i laglistan "${listName}" (${items.length} dokument).`
      break
    case 'groups': {
      const groupNames = Array.from(
        new Set(
          items.map((i) => i.groupName).filter((n): n is string => n !== null)
        )
      ).sort((a, b) => a.localeCompare(b, 'sv'))
      const groupList =
        groupNames.length > 0
          ? groupNames.map((n) => escapeHtml(n)).join(', ')
          : '—'
      prose = `Kontrollen omfattar följande grupper i laglistan "${listName}": ${groupList}. Totalt ${items.length} dokument.`
      break
    }
    case 'items':
      prose = `Kontrollen omfattar ${items.length} specifikt utvalda dokument ur laglistan "${listName}".`
      break
  }

  const rows = items
    .map((item) => {
      const signedCell = item.signedOffAt
        ? `✓ ${escapeNullable(item.signedOffBy?.name ?? null)}`
        : '—'
      return `        <tr>
          <td>${escapeHtml(item.lawTitle)}</td>
          <td>${escapeHtml(item.lawDocumentNumber)}</td>
          <td>${escapeNullable(item.groupName)}</td>
          <td>${escapeHtml(bedomningLabel(item.efterlevnadsbedomning))}</td>
          <td>${escapeNullable(item.sourceResponsibleUser?.name ?? null)}</td>
          <td>${signedCell}</td>
        </tr>`
    })
    .join('\n')

  const tableBody =
    items.length === 0
      ? `        <tr><td colspan="6" class="empty-state">Kontrollen har inga poster.</td></tr>`
      : rows

  return `  <section id="omfattning">
    <h2>${SECTION_LABELS[variant].omfattning}</h2>
    <p>${prose}</p>
    <table>
      <thead>
        <tr>
          <th>Dokument</th>
          <th>Dok.nr</th>
          <th>Grupp</th>
          <th>Bedömning</th>
          <th>Ansvarig</th>
          <th>Signerad</th>
        </tr>
      </thead>
      <tbody>
${tableBody}
      </tbody>
    </table>
  </section>`
}

function renderRevisionskriterier(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const { cycle } = input
  const listName = escapeHtml(cycle.lawList.name)
  const cutoff = formatDate(cycle.lawChangeCutoffDate)
  const firstSentence =
    variant === 'external'
      ? `Revisionen genomförs mot kraven i laglistan "${listName}" (extern revision).`
      : `Kontrollen genomförs mot kraven i laglistan "${listName}" (intern kontroll).`
  const secondSentence = `Bedömningsgrund: gällande svensk lagstiftning samt organisationens egna kravpunkter per dokument i laglistan per ${escapeHtml(cutoff)}.`
  return `  <section id="revisionskriterier">
    <h2>${SECTION_LABELS[variant].revisionskriterier}</h2>
    <p>${firstSentence}</p>
    <p>${secondSentence}</p>
  </section>`
}

function renderMetodik(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const { cycle } = input
  const leaderName = escapeNullable(cycle.leadAuditor.name)
  const firstVerb = variant === 'external' ? 'Revisionen' : 'Genomgången'
  const ledBy = variant === 'external' ? 'Revisionen' : 'Kontrollen'
  const firstSentence = `${firstVerb} har utförts som en strukturerad dokumentgranskning av varje ingående dokument. För varje dokument har efterlevnad bedömts på skalan Uppfylld / Delvis uppfylld / Ej uppfylld / Ej tillämplig, med motivering.`
  const secondSentence = `Eventuella avvikelser, observationer och förbättringsförslag dokumenteras separat. Varje bedömning har signerats av ansvarig. ${ledBy} har letts av ${leaderName}.`
  const thirdSentence =
    variant === 'external'
      ? `<p>Revisionens genomförande följer principerna i ISO 19011.</p>`
      : ''
  return `  <section id="metodik">
    <h2>${SECTION_LABELS[variant].metodik}</h2>
    <p>${firstSentence}</p>
    <p>${secondSentence}</p>
    ${thirdSentence}
  </section>`
}

function renderSammanfattning(
  variant: SectionVariant,
  counts: RenderCounts
): string {
  const rows: Array<[string, number | string]> = [
    ['Totalt antal dokument', counts.total],
    ['Uppfyllda', counts.uppfyllda],
    ['Delvis uppfyllda', counts.delvis],
    ['Ej uppfyllda', counts.ejUppfyllda],
    ['Ej tillämpliga', counts.ejTillampliga],
    ['Obedömda', counts.obedomda],
    ['Antal avvikelser', counts.avvikelser],
    ['— varav major', counts.avvikelserMajor],
    ['— varav minor', counts.avvikelserMinor],
    ['Antal observationer', counts.observationer],
    ['Antal förbättringsförslag', counts.forbattringsforslag],
    [
      'Öppna / stängda findings',
      `${counts.openFindings} / ${counts.closedFindings}`,
    ],
  ]
  const body = rows
    .map(
      ([label, value]) =>
        `        <tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`
    )
    .join('\n')
  return `  <section id="sammanfattning">
    <h2>${SECTION_LABELS[variant].sammanfattning}</h2>
    <table>
      <tbody>
${body}
      </tbody>
    </table>
  </section>`
}

function renderFindingArticle(finding: FindingRow): string {
  const severityBadge =
    finding.severity === 'MAJOR'
      ? `<span class="badge badge-major">${severityLabel('MAJOR')}</span>`
      : finding.severity === 'MINOR'
        ? `<span class="badge badge-minor">${severityLabel('MINOR')}</span>`
        : ''

  const dokument = escapeNullable(finding.lawListItem?.title ?? null)
  const kravpunkt = finding.requirement?.text
    ? escapeHtml(truncate(finding.requirement.text, 120))
    : '—'
  const due = finding.dueDate ? formatDate(finding.dueDate) : '—'
  const statusText = finding.closedAt
    ? `Stängd ${formatDate(finding.closedAt)}`
    : 'Öppen'

  let rootCause = ''
  if (finding.rootCause) {
    rootCause = `
      <div class="root-cause"><strong>Grundorsak:</strong> ${escapeHtml(finding.rootCause)}</div>`
  }

  let correctiveAction = ''
  if (finding.correctiveActionTaskId && finding.correctiveActionTask) {
    const stateSuffix = finding.correctiveActionTask.completedAt
      ? ' (klar)'
      : ' (pågår)'
    correctiveAction = `
      <div class="corrective-action"><strong>Korrigerande åtgärd:</strong> uppgift ${escapeHtml(finding.correctiveActionTask.title)}${stateSuffix}</div>`
  }

  return `    <article class="finding">
      <h3>${escapeHtml(finding.title)}${severityBadge}</h3>
      <div class="finding-meta">Dokument: ${dokument} · Kravpunkt: ${kravpunkt} · Förfallodatum: ${escapeHtml(due)} · Status: ${escapeHtml(statusText)}</div>
      <p class="description">${escapeHtmlMultiline(finding.description)}</p>${rootCause}${correctiveAction}
    </article>`
}

function renderAvvikelser(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const avvikelser = input.findings.filter((f) => f.type === 'AVVIKELSE')
  if (avvikelser.length === 0) {
    return `  <section id="avvikelser">
    <h2>${SECTION_LABELS[variant].avvikelser}</h2>
    <p class="empty-state">Inga avvikelser identifierade.</p>
  </section>`
  }

  const groups: Array<{
    severity: FindingSeverity | null
    heading: string
    items: FindingRow[]
  }> = [
    {
      severity: 'MAJOR',
      heading: 'Allvarlighetsgrad: Major',
      items: avvikelser.filter((f) => f.severity === 'MAJOR'),
    },
    {
      severity: 'MINOR',
      heading: 'Allvarlighetsgrad: Minor',
      items: avvikelser.filter((f) => f.severity === 'MINOR'),
    },
    {
      severity: null,
      heading: 'Allvarlighetsgrad saknas',
      items: avvikelser.filter((f) => f.severity === null),
    },
  ]

  const rendered = groups
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const articles = [...g.items]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(renderFindingArticle)
        .join('\n')
      return `    <h3>${escapeHtml(g.heading)}</h3>
${articles}`
    })
    .join('\n')

  return `  <section id="avvikelser">
    <h2>${SECTION_LABELS[variant].avvikelser}</h2>
${rendered}
  </section>`
}

function renderFindingGroup(
  input: RevisionsrapportInput,
  variant: SectionVariant,
  id: Extract<SectionId, 'observationer' | 'forbattringsforslag'>,
  type: FindingType,
  emptyCopy: string
): string {
  const subset = input.findings.filter((f) => f.type === type)
  if (subset.length === 0) {
    return `  <section id="${id}">
    <h2>${SECTION_LABELS[variant][id]}</h2>
    <p class="empty-state">${escapeHtml(emptyCopy)}</p>
  </section>`
  }
  const articles = [...subset]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(renderFindingArticle)
    .join('\n')
  return `  <section id="${id}">
    <h2>${SECTION_LABELS[variant][id]}</h2>
${articles}
  </section>`
}

/**
 * Story 21.22: per-item compliance narratives. The field accepts rich text
 * (from RichTextEditor on the law-list-item modal). For determinism + PDF
 * safety we strip the HTML tags down to plain text and re-escape — preserves
 * paragraph structure via line breaks but drops link styling, fonts, etc.
 */
function stripRichTextToPlain(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderEfterlevnadsbeskrivningar(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const itemsWithNarrative = input.items.filter((i) => {
    const narrative = i.complianceNarrative
    return (
      narrative !== null &&
      narrative !== undefined &&
      narrative.trim().length > 0
    )
  })

  if (itemsWithNarrative.length === 0) {
    return `  <section id="efterlevnadsbeskrivningar">
    <h2>${SECTION_LABELS[variant].efterlevnadsbeskrivningar}</h2>
    <p class="empty-state">Ingen efterlevnadsbeskrivning har dokumenterats för granskade dokument.</p>
  </section>`
  }

  const articles = itemsWithNarrative
    .map((item) => {
      const plain = stripRichTextToPlain(item.complianceNarrative ?? '')
      return `    <article class="finding">
      <h3>${escapeHtml(item.lawTitle)}</h3>
      <div class="finding-meta">${escapeHtml(item.lawDocumentNumber)} · Bedömning: ${escapeHtml(bedomningLabel(item.efterlevnadsbedomning))}</div>
      <p class="description">${escapeHtmlMultiline(plain)}</p>
    </article>`
    })
    .join('\n')

  return `  <section id="efterlevnadsbeskrivningar">
    <h2>${SECTION_LABELS[variant].efterlevnadsbeskrivningar}</h2>
${articles}
  </section>`
}

function renderStyrkor(variant: SectionVariant): string {
  return `  <section id="styrkor">
    <h2>${SECTION_LABELS[variant].styrkor}</h2>
    <p class="empty-state">Styrkor dokumenteras i kommande versioner av revisionsrapporten.</p>
  </section>`
}

function renderKonklusion(
  input: RevisionsrapportInput,
  variant: SectionVariant,
  counts: RenderCounts
): string {
  const listName = escapeHtml(input.cycle.lawList.name)
  let paragraph: string

  const allUppfylldaOrEjTillampliga =
    counts.total > 0 && counts.uppfyllda + counts.ejTillampliga === counts.total

  if (allUppfylldaOrEjTillampliga && counts.openAvvikelser === 0) {
    paragraph = `Samtliga tillämpliga krav i laglistan "${listName}" bedöms som uppfyllda. Inga öppna avvikelser kvarstår vid rapporttillfället.`
  } else if (counts.ejUppfyllda > 0 || counts.openAvvikelser > 0) {
    paragraph = `Kontrollen identifierade ${counts.ejUppfyllda} krav som inte är uppfyllda samt ${counts.openAvvikelser} öppen(a) avvikelse(r) som kräver åtgärd. Se avsnittet Avvikelser för detaljer och ansvariga åtgärdsuppgifter.`
  } else if (counts.delvis > 0) {
    paragraph = `Kontrollen bedöms i huvudsak uppfylla kraven i laglistan "${listName}". ${counts.delvis} krav är delvis uppfyllda och bör följas upp enligt angivna förbättringsförslag.`
  } else {
    paragraph = `Kontrollen har genomförts och samtliga dokument har bedömts. Se sammanfattning och avvikelselistan för detaljer.`
  }

  return `  <section id="konklusion">
    <h2>${SECTION_LABELS[variant].konklusion}</h2>
    <p>${paragraph}</p>
  </section>`
}

function renderSignatarer(
  input: RevisionsrapportInput,
  variant: SectionVariant
): string {
  const signed = input.items.filter((i) => i.signedOffAt !== null)
  const body =
    signed.length === 0
      ? `        <tr><td colspan="5" class="empty-state">Inga poster har signerats ännu.</td></tr>`
      : signed
          .map((item) => {
            const motivering = item.motivering
              ? escapeHtml(truncate(item.motivering, 200))
              : '—'
            const signerad = item.signedOffBy?.name
              ? escapeHtml(item.signedOffBy.name)
              : '—'
            const datum = item.signedOffAt ? formatDate(item.signedOffAt) : '—'
            return `        <tr>
          <td>${escapeHtml(item.lawTitle)}</td>
          <td>${escapeHtml(bedomningLabel(item.efterlevnadsbedomning))}</td>
          <td>${motivering}</td>
          <td>${signerad}</td>
          <td>${datum}</td>
        </tr>`
          })
          .join('\n')

  return `  <section id="signatarer">
    <h2>${SECTION_LABELS[variant].signatarer}</h2>
    <table>
      <thead>
        <tr>
          <th>Dokument</th>
          <th>Bedömning</th>
          <th>Motivering</th>
          <th>Signerad av</th>
          <th>Datum</th>
        </tr>
      </thead>
      <tbody>
${body}
      </tbody>
    </table>
  </section>`
}

function renderFooter(input: RevisionsrapportInput): string {
  // Story 21.26 — sealSuffix removed; sealHash no longer exists on CycleDetail.
  const { cycle, generatedAt } = input
  const generatedLabel = formatDate(generatedAt, 'd MMM yyyy HH:mm')
  const shortId = cycle.id.slice(0, 8)
  return `  <footer>
    Rapport genererad ${escapeHtml(generatedLabel)} · Kontroll-ID: ${escapeHtml(shortId)}… · Laglig.se
  </footer>`
}

// ============================================================================
// Main orchestrator
// ============================================================================

export function renderRevisionsrapport(input: RevisionsrapportInput): string {
  const variant: SectionVariant =
    input.cycle.auditType === 'EXTERN' ? 'external' : 'internal'
  const counts = computeCounts(input.items, input.findings)
  const title = escapeHtml(input.cycle.name)
  const bakgrund = renderBakgrund(input, variant)

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>${title} — Revisionsrapport</title>
  ${STYLE_BLOCK}
</head>
<body>
${renderTitelsida(input, variant)}
${renderTOC(input, variant, counts)}${bakgrund ? `\n${bakgrund}` : ''}
${renderOmfattning(input, variant)}
${renderRevisionskriterier(input, variant)}
${renderMetodik(input, variant)}
${renderSammanfattning(variant, counts)}
${renderEfterlevnadsbeskrivningar(input, variant)}
${renderAvvikelser(input, variant)}
${renderFindingGroup(input, variant, 'observationer', 'OBSERVATION', 'Inga observationer identifierade.')}
${renderFindingGroup(input, variant, 'forbattringsforslag', 'FORBATTRING', 'Inga förbättringsförslag identifierade.')}
${renderStyrkor(variant)}
${renderKonklusion(input, variant, counts)}
${renderSignatarer(input, variant)}
${renderFooter(input)}
</body>
</html>`
}
