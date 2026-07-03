/* eslint-disable no-console */
/**
 * EU Consolidated-Text Corpus Ingester (Story 2.6, Task A2)
 *
 * Three decoupled, independently re-runnable stages — normalization is POST ingestion:
 *   Stage 1 (ingest):   fetch consolidated/original Swedish HTML (raw) + metadata baseline, upsert on base CELEX
 *   Stage 2 (normalize): transformEuHtml -> linkify -> html-to-markdown, write back (no CELLAR re-fetch)
 *   Stage 3 (embed):     chunk + embed via syncDocumentChunks
 *
 * Usage:
 *   npx tsx scripts/ingest-eu-corpus.ts --stage all --celex 32016R0679,32019L1937
 *   npx tsx scripts/ingest-eu-corpus.ts --stage all --dry           # 10-doc dry-run set (AC 3a)
 *   npx tsx scripts/ingest-eu-corpus.ts --stage ingest --limit 50
 *
 * Env is loaded from .env.local; lib modules are imported dynamically AFTER dotenv.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

// The AC-3a dry-run set: chaptered/flat/minimal, regs+dirs, consolidated+never-amended, multi-EIF.
const DRY_RUN_CELEX = [
  '32016R0679', // GDPR (reg, chaptered, consolidated) — known-good baseline
  '32006R1907', // REACH (reg, large chaptered, consolidated)
  '32020R0852', // Taxonomy (reg, consolidated)
  '32014R0139', // Merger Regulation (reg, 15 consolidated versions)
  '32024R1689', // AI Act (reg, multi entry-into-force + deadlines)
  '32006R0561', // Driving times (reg)
  '32019L1937', // Whistleblower (dir)
  '32003L0088', // Working Time (dir)
  '32020L2184', // Drinking Water (dir)
  '31992L0043', // Habitats (dir, older, consolidated)
]

interface Args {
  stage: 'all' | 'ingest' | 'normalize' | 'embed'
  celex: string[]
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const stage = (get('--stage') ?? 'all') as Args['stage']
  const celexArg = get('--celex')
  const celex = argv.includes('--dry')
    ? DRY_RUN_CELEX
    : celexArg
      ? celexArg
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : DRY_RUN_CELEX
  return { stage, celex }
}

async function main() {
  const args = parseArgs()
  const eurlex = await import('../lib/external/eurlex')
  const { transformEuHtml } = await import('../lib/eu/eu-html-transformer')
  const { mergeBasePreamble } = await import('../lib/eu/merge-preamble')
  const { buildSlugMap, linkifyHtmlContent, saveCrossReferences } =
    await import('../lib/linkify')
  const { htmlToMarkdown, htmlToPlainText } = await import(
    '../lib/transforms/html-to-markdown'
  )
  const { syncDocumentChunks } = await import('../lib/chunks')
  const { prisma } = await import('../lib/prisma')
  const { Prisma } = await import('@prisma/client')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(
    `🇪🇺 EU corpus ingester — stage=${args.stage}, docs=${args.celex.length}`
  )
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const runIngest = args.stage === 'all' || args.stage === 'ingest'
  const runNormalize = args.stage === 'all' || args.stage === 'normalize'
  const runEmbed = args.stage === 'all' || args.stage === 'embed'

  // SlugMap for linkification (built once).
  const slugMap = runNormalize ? await buildSlugMap() : null

  const results: Array<Record<string, unknown>> = []

  for (const baseCelex of args.celex) {
    const row: Record<string, unknown> = { celex: baseCelex }
    try {
      // Resolve the latest consolidated version for this base act.
      const consResp = await eurlex.executeSparqlQuery(
        eurlex.buildLatestConsolidatedQuery([baseCelex])
      )
      let consCelex: string | null = null
      let consDate: Date | null = null
      for (const b of consResp.results.bindings) {
        const r = b as Record<string, { value: string } | undefined>
        const cc = r.consCelex?.value
        const cd = r.consDate?.value ? new Date(r.consDate.value) : null
        if (cc && cd && (!consDate || cd > consDate)) {
          consCelex = cc
          consDate = cd
        }
      }
      // --base forces fetching the base act (full recitals/preamble) instead of
      // the consolidated version, whose CELLAR HTML strips recitals + footnotes.
      const useBase = process.argv.includes('--base')
      const fetchCelex = !useBase && consCelex ? consCelex : baseCelex
      row.consolidated = useBase
        ? `(base act; latest cons ${consCelex ?? 'none'})`
        : (consCelex ?? '(none — original)')

      let docId: string | null = null

      // ---- STAGE 1: ingest raw + metadata baseline ----
      if (runIngest) {
        const meta = await eurlex.fetchEuWorkMetadata(baseCelex)
        const rels = await eurlex.fetchDocumentRelationships([baseCelex])
        const rel = rels.get(baseCelex)

        // Fetch content: prefer consolidated, fall back to base act.
        let content = await eurlex.fetchDocumentContentViaCellar(fetchCelex)
        if (!content && fetchCelex !== baseCelex) {
          content = await eurlex.fetchDocumentContentViaCellar(baseCelex)
        }
        if (!content) {
          row.status = 'NO_CONTENT'
          results.push(row)
          continue
        }

        // Base CELEX shape: sector(1) + year(4) + type-letter + number, e.g. 32019L1937.
        const isDirective = /^\d{5}L/.test(baseCelex)
        const title = meta?.title ?? `EU ${baseCelex}`
        const slug = eurlex.generateEuSlug(title, baseCelex)
        const sourceUrl = `https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:${fetchCelex}`
        const baseMetadata = {
          consolidatedCelex: consCelex,
          consolidatedDate: consDate
            ? consDate.toISOString().slice(0, 10)
            : null,
          entryIntoForceDates: meta?.entryIntoForceDates ?? [],
          deadlineDates: meta?.deadlineDates ?? [],
          // Which version html_content actually holds — drives the Stage 2
          // preamble merge (consolidated body lacks recitals; base has them).
          htmlSource: fetchCelex === baseCelex ? 'base' : 'consolidated',
        }

        // Reconcile (AC 12a): find the existing row by CELEX first (handles
        // malformed document_numbers like "Regulation (EU) 2024/1689"), else by
        // base document_number, else create. Never create a duplicate that would
        // collide on the (title+celex) slug.
        const existingEu = await prisma.euDocument.findUnique({
          where: { celex_number: baseCelex },
          select: { document_id: true },
        })
        let existingId = existingEu?.document_id ?? null
        if (!existingId) {
          const byNum = await prisma.legalDocument.findUnique({
            where: { document_number: baseCelex },
            select: { id: true },
          })
          existingId = byNum?.id ?? null
        }

        const contentData = {
          content_type: (isDirective ? 'EU_DIRECTIVE' : 'EU_REGULATION') as
            | 'EU_DIRECTIVE'
            | 'EU_REGULATION',
          document_number: baseCelex, // normalize malformed ids to base CELEX
          html_content: content.html, // RAW at stage 1; normalized in stage 2
          full_text: content.plainText,
          source_url: sourceUrl,
          metadata: baseMetadata,
        }
        const doc = existingId
          ? await prisma.legalDocument.update({
              where: { id: existingId },
              data: contentData,
              select: { id: true },
            })
          : await prisma.legalDocument.create({
              data: { ...contentData, title, slug },
              select: { id: true },
            })
        docId = doc.id

        // EuDocument monitoring baseline.
        const transpositionDeadline =
          isDirective && meta?.deadlineDates.length
            ? new Date(meta.deadlineDates.slice().sort()[0]!)
            : null
        const euBaseline = {
          eli_identifier: meta?.eli ?? null,
          in_force: meta?.inForce ?? null,
          end_of_validity: meta?.endOfValidity ?? null,
          signature_date: meta?.signatureDate ?? null,
          eea_relevant: meta?.eeaRelevant ?? null,
          directory_codes: meta?.directoryCodes ?? [],
          subject_matters: meta?.subjectMatters ?? [],
          legal_basis_celex: rel?.legalBasisCelex ?? [],
          cites_celex: rel?.citesCelex ?? [],
          amended_by_celex: rel?.amendedByCelex ?? [],
          corrected_by_celex: rel?.correctedByCelex ?? [],
          transposition_deadline: transpositionDeadline,
        }
        await prisma.euDocument.upsert({
          where: { document_id: doc.id },
          create: {
            document_id: doc.id,
            celex_number: baseCelex,
            ...euBaseline,
          },
          update: euBaseline,
        })
        row.inForce = meta?.inForce
        row.amendedBy = rel?.amendedByCelex.length ?? 0
        row.rawHtmlLen = content.html.length
      }

      // Resolve docId if a later stage runs standalone.
      if (!docId) {
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: baseCelex },
          select: { id: true },
        })
        docId = existing?.id ?? null
      }
      if (!docId) {
        row.status = 'NOT_IN_DB'
        results.push(row)
        continue
      }

      // ---- STAGE 2: normalize (transform -> linkify -> markdown) ----
      if (runNormalize && slugMap) {
        const doc = await prisma.legalDocument.findUnique({
          where: { id: docId },
          select: { html_content: true, title: true, metadata: true },
        })
        if (!doc?.html_content) {
          row.status = 'NO_RAW_HTML'
          results.push(row)
          continue
        }
        const prevMeta = (doc.metadata as Record<string, unknown> | null) ?? {}
        const transformed = transformEuHtml(doc.html_content, {
          celex: baseCelex,
          documentNumber: baseCelex,
          shortTitle: doc.title ?? undefined,
        })

        // Preamble merge (Story 2.6): consolidated CELLAR HTML lacks recitals.
        // When html_content is the consolidated body, fetch the base act and
        // splice its recital-rich preamble into the consolidated article.
        let articleHtml = transformed.html
        if (prevMeta.htmlSource === 'consolidated') {
          const baseRaw = await eurlex.fetchDocumentContentViaCellar(baseCelex)
          if (baseRaw) {
            const baseXform = transformEuHtml(baseRaw.html, {
              celex: baseCelex,
              documentNumber: baseCelex,
              shortTitle: doc.title ?? undefined,
            })
            const m = mergeBasePreamble(transformed.html, baseXform.html)
            articleHtml = m.html
            row.preambleMerged = m.merged
            row.recitalParas = m.recitalParas
          } else {
            row.preambleMerged = 'base-fetch-failed'
          }
        }

        const linked = linkifyHtmlContent(articleHtml, slugMap, baseCelex)
        const markdown = htmlToMarkdown(linked.html)
        const plainText = htmlToPlainText(linked.html)
        await prisma.legalDocument.update({
          where: { id: docId },
          data: {
            html_content: linked.html,
            markdown_content: markdown,
            full_text: plainText,
            // EU docs have no canonical JSON; null out any stale showcase
            // json_content so chunking uses the markdown path (chunk-document.ts
            // assumes chapter.paragrafer exists for json_content).
            json_content: Prisma.JsonNull,
            metadata: {
              ...prevMeta,
              structureType: transformed.structureType,
              stats: transformed.stats,
            },
          },
        })
        await saveCrossReferences(docId, linked.linkedReferences, plainText)
        row.structureType = transformed.structureType
        row.linkedRefs = linked.linkedReferences.length
        row.mdLen = markdown.length
      }

      // ---- STAGE 3: chunk + embed ----
      if (runEmbed) {
        const sync = await syncDocumentChunks(docId)
        row.chunks = sync.chunksCreated
        row.embedded = sync.chunksEmbedded
      }

      row.status = 'OK'
    } catch (err) {
      row.status = 'ERROR'
      row.error = err instanceof Error ? err.message : String(err)
      if (err instanceof Error && err.stack) {
        console.error(`\n[STACK ${baseCelex}]\n${err.stack}\n`)
      }
    }
    results.push(row)
    console.log(JSON.stringify(row))
  }

  console.log('\n━━━━━━━━━━━━━━━━━ SUMMARY ━━━━━━━━━━━━━━━━━')
  console.table(results)
  const ok = results.filter((r) => r.status === 'OK').length
  console.log(`\n✅ ${ok}/${results.length} OK`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
