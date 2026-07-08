/* eslint-disable no-console */
/**
 * EU Consolidated-Text Corpus Ingester (Story 2.6, Task A2)
 *
 * Three decoupled, independently re-runnable stages — normalization is POST ingestion:
 *   Stage 1 (ingest):   fetch consolidated/original Swedish HTML (raw) + metadata baseline, upsert on base CELEX
 *   Stage 2 (normalize): transformEuHtml -> preamble merge -> linkify -> html-to-markdown, write back (no CELLAR re-fetch)
 *   Stage 3 (embed):     chunk + embed via syncDocumentChunks
 *
 * Usage:
 *   npx tsx scripts/ingest-eu-corpus.ts --stage all --celex 32016R0679,32019L1937
 *   npx tsx scripts/ingest-eu-corpus.ts --stage all --dry                # 10-doc dry-run set (AC 3a)
 *   npx tsx scripts/ingest-eu-corpus.ts --stage all --all --resume      # full corpus, checkpointed (AC 9)
 *   npx tsx scripts/ingest-eu-corpus.ts --all --limit 50                # first 50 corpus docs
 *   npx tsx scripts/ingest-eu-corpus.ts --all --retire                  # + AC 12a retire bucket
 *   npx tsx scripts/ingest-eu-corpus.ts --sample 30                     # no-write transformer prevalence sample
 *
 * Checkpoint: data/eu-corpus-checkpoint.json (gitignored). --resume skips docs
 * whose requested stages already completed. Env from .env.local; lib modules
 * imported dynamically AFTER dotenv.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import * as fs from 'fs'
import * as path from 'path'
import type { DocumentRelationships } from '../lib/external/eurlex'

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

const CHECKPOINT_PATH = path.join(
  process.cwd(),
  'data',
  'eu-corpus-checkpoint.json'
)
const RELATIONSHIP_BATCH = 50

interface Args {
  stage: 'all' | 'ingest' | 'normalize' | 'embed'
  celex: string[]
  all: boolean
  dry: boolean
  base: boolean
  resume: boolean
  retire: boolean
  force: boolean
  limit: number | null
  sample: number | null
}

/**
 * Stage-2 text-retention floor. Sampling (2026-07-08, n=30) showed ~27% of the
 * corpus loses >30% of its text to the transformer's table-handling gap
 * (Merger-style). Below this floor we KEEP the raw HTML (readable, chunkable)
 * and flag the doc for the transformer-hardening follow-up story.
 */
const RETENTION_FLOOR = 0.7

/** One unit of work. `resolved` = consolidated version already known (corpus mode). */
interface WorkItem {
  celex: string
  consCelex: string | null
  consDate: Date | null
  resolved: boolean
}

type StageName = 'ingest' | 'normalize' | 'embed'

interface CheckpointDoc {
  ingest?: 'ok'
  normalize?: 'ok'
  embed?: 'ok'
  status?: string
  error?: string
}

interface Checkpoint {
  startedAt: string
  corpusSize?: number
  docs: Record<string, CheckpointDoc>
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const stage = (get('--stage') ?? 'all') as Args['stage']
  const all = argv.includes('--all')
  const dry = argv.includes('--dry')
  const celexArg = get('--celex')
  const celex = dry
    ? DRY_RUN_CELEX
    : celexArg
      ? celexArg
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : all
        ? []
        : DRY_RUN_CELEX
  const limitRaw = get('--limit')
  const sampleRaw = get('--sample')
  return {
    stage,
    celex,
    all,
    dry,
    base: argv.includes('--base'),
    resume: argv.includes('--resume'),
    retire: argv.includes('--retire'),
    force: argv.includes('--force'),
    limit: limitRaw ? parseInt(limitRaw, 10) : null,
    sample: sampleRaw ? parseInt(sampleRaw, 10) : null,
  }
}

function loadCheckpoint(): Checkpoint {
  try {
    const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Checkpoint
    if (parsed && typeof parsed.docs === 'object') return parsed
  } catch {
    /* no checkpoint yet */
  }
  return { startedAt: new Date().toISOString(), docs: {} }
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true })
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp))
}

function stagesRequested(stage: Args['stage']): StageName[] {
  return stage === 'all' ? ['ingest', 'normalize', 'embed'] : [stage]
}

function formatEta(processed: number, total: number, startMs: number): string {
  if (processed === 0) return '—'
  const elapsed = Date.now() - startMs
  const perDoc = elapsed / processed
  const remainingMs = perDoc * (total - processed)
  const mins = Math.round(remainingMs / 60000)
  return mins > 90 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`
}

/**
 * Best-effort render-cache invalidation after DB writes (Story 2.6 finding:
 * both EU render paths cache 1h; a plain script cannot call revalidateTag).
 */
async function invalidateRenderCaches(): Promise<void> {
  // INVALIDATE_BASE_URL lets the full production run target the deployed app
  // (localhost revalidateTag only clears the local dev server's cache).
  const baseUrl =
    process.env.INVALIDATE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.CRON_SECRET
  if (!baseUrl || !secret) {
    console.warn(
      '⚠️  Cache invalidation skipped (INVALIDATE_BASE_URL / NEXT_PUBLIC_APP_URL / CRON_SECRET missing) — pages may serve stale renders up to 1h.'
    )
    return
  }
  try {
    const res = await fetch(`${baseUrl}/api/internal/invalidate-cache`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ scope: 'eu' }),
    })
    const body = await res.json().catch(() => ({}))
    console.log(
      res.ok
        ? `🧹 Render caches invalidated (${JSON.stringify(body)})`
        : `⚠️  Cache invalidation failed: HTTP ${res.status} ${JSON.stringify(body)}`
    )
  } catch (err) {
    console.warn(
      `⚠️  Cache invalidation unreachable (${err instanceof Error ? err.message : err}) — pages may serve stale renders up to 1h.`
    )
  }
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

  // ---------------- Sampling mode (no DB writes) ----------------
  if (args.sample) {
    await runSample(
      args.sample,
      process.argv.includes('--celex') ? args.celex : null,
      eurlex,
      transformEuHtml,
      htmlToPlainText
    )
    return
  }

  // ---------------- Build the work list ----------------
  let items: WorkItem[]
  const corpusCelexSet = new Set<string>()
  if (args.all) {
    console.log('📥 Fetching in-force corpus (SPARQL)…')
    const corpus = await eurlex.fetchCorpus()
    const consolidated = corpus.filter((e) => e.latestConsolidatedCelex).length
    console.log(
      `📊 Corpus: ${corpus.length} base acts (${consolidated} consolidated / ${corpus.length - consolidated} original) — AC 2 split logged.`
    )
    corpus.forEach((e) => corpusCelexSet.add(e.celex))
    // Deterministic order → stable resume.
    corpus.sort((a, b) => a.celex.localeCompare(b.celex))
    items = corpus.map((e) => ({
      celex: e.celex,
      consCelex: e.latestConsolidatedCelex,
      consDate: e.latestConsolidatedDate,
      resolved: true,
    }))
    if (args.limit) items = items.slice(0, args.limit)
  } else {
    items = args.celex.map((c) => ({
      celex: c,
      consCelex: null,
      consDate: null,
      resolved: false,
    }))
  }

  const requested = stagesRequested(args.stage)
  const checkpoint = args.all ? loadCheckpoint() : null
  if (checkpoint) checkpoint.corpusSize = corpusCelexSet.size

  let skipped = 0
  if (checkpoint && args.resume) {
    const before = items.length
    items = items.filter((it) => {
      const done = checkpoint.docs[it.celex]
      return !done || !requested.every((s) => done[s] === 'ok')
    })
    skipped = before - items.length
    if (skipped)
      console.log(`⏭️  Resume: skipping ${skipped} already-completed docs.`)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(
    `🇪🇺 EU corpus ingester — stage=${args.stage}, docs=${items.length}${args.all ? ' (corpus mode)' : ''}`
  )
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const runIngest = args.stage === 'all' || args.stage === 'ingest'
  const runNormalize = args.stage === 'all' || args.stage === 'normalize'
  const runEmbed = args.stage === 'all' || args.stage === 'embed'

  // SlugMap for linkification (built once).
  const slugMap = runNormalize ? await buildSlugMap() : null

  // Corpus mode: prefetch relationships in batches of 50 (vs 1 SPARQL/doc).
  const relCache = new Map<string, DocumentRelationships>()

  const results: Array<Record<string, unknown>> = []
  const startMs = Date.now()
  let okCount = 0
  let errCount = 0
  let wroteAnything = false
  let processedCount = 0
  // Serializes relationship batch-prefetches so concurrent workers don't fire
  // duplicate SPARQL batches for the same window.
  let relFetchChain: Promise<void> = Promise.resolve()

  // Concurrency: overlap per-doc network latency (SPARQL/CELLAR/Haiku
  // prefixes/embeddings). Measured ceilings (2026-07-08): CELLAR limiter is
  // global in-process at 5 req/s (~2.5 req/doc → ~2 docs/s max), DB pool is
  // connection_limit=10, Anthropic tier 20k req/min (<2% used). 8 workers sits
  // under both hard limits; serial pace was 26s/doc (ETA ~47h), 4-way ~5s/doc.
  const CONCURRENCY = args.all ? 8 : 1

  async function processDoc(idx: number): Promise<void> {
    const item = items[idx]!
    const baseCelex = item.celex
    const row: Record<string, unknown> = { celex: baseCelex }
    const cpDoc: CheckpointDoc = checkpoint?.docs[baseCelex] ?? {}
    try {
      // Resolve the latest consolidated version (per-doc SPARQL only when the
      // corpus didn't already resolve it).
      let consCelex = item.consCelex
      let consDate = item.consDate
      if (!item.resolved) {
        const consResp = await eurlex.executeSparqlQuery(
          eurlex.buildLatestConsolidatedQuery([baseCelex])
        )
        for (const b of consResp.results.bindings) {
          const r = b as Record<string, { value: string } | undefined>
          const cc = r.consCelex?.value
          const cd = r.consDate?.value ? new Date(r.consDate.value) : null
          if (cc && cd && (!consDate || cd > consDate)) {
            consCelex = cc
            consDate = cd
          }
        }
      }
      // --base forces fetching the base act (full recitals/preamble) instead of
      // the consolidated version, whose CELLAR HTML strips recitals + footnotes.
      const fetchCelex = !args.base && consCelex ? consCelex : baseCelex
      row.consolidated = args.base
        ? `(base act; latest cons ${consCelex ?? 'none'})`
        : (consCelex ?? '(none — original)')

      let docId: string | null = null
      let metadataOnly = false

      // ---- STAGE 1: ingest raw + metadata baseline ----
      if (runIngest && !(args.resume && cpDoc.ingest === 'ok')) {
        const meta = await eurlex.fetchEuWorkMetadata(baseCelex)

        // Relationships: batched prefetch in corpus mode, per-doc otherwise.
        // Chained through relFetchChain so only one batch is in flight and
        // concurrent workers for the same window hit the cache instead.
        if (!relCache.has(baseCelex)) {
          relFetchChain = relFetchChain.then(async () => {
            if (relCache.has(baseCelex)) return
            const batch = args.all
              ? items
                  .slice(idx, idx + RELATIONSHIP_BATCH)
                  .map((i) => i.celex)
                  .filter((c) => !relCache.has(c))
              : [baseCelex]
            const rels = await eurlex.fetchDocumentRelationships(batch)
            for (const [k, v] of rels) relCache.set(k, v)
            // Mark misses so we don't re-query them.
            for (const c of batch) {
              if (!relCache.has(c)) {
                relCache.set(c, {
                  celex: c,
                  citesCelex: [],
                  legalBasisCelex: [],
                  amendedByCelex: [],
                  correctedByCelex: [],
                })
              }
            }
          })
          await relFetchChain
        }
        const rel = relCache.get(baseCelex)

        // Fetch content: prefer consolidated, fall back to base act.
        let content = await eurlex.fetchDocumentContentViaCellar(fetchCelex)
        if (!content && fetchCelex !== baseCelex) {
          content = await eurlex.fetchDocumentContentViaCellar(baseCelex)
        }
        // No SV HTML in CELLAR (pre-1970s tail): still create the metadata row
        // + EuDocument baseline so Phase B monitoring covers the FULL corpus;
        // the reader falls back to the EUR-Lex source_url link. Existing HTML
        // (e.g. a 2.4-era raw fetch) is never overwritten with nothing.
        const contentUnavailable = !content

        // Base CELEX shape: sector(1) + year(4) + type-letter + number, e.g. 32019L1937.
        const isDirective = /^\d{5}L/.test(baseCelex)
        const title = meta?.title ?? `EU ${baseCelex}`
        const slug = eurlex.generateEuSlug(title, baseCelex)
        const sourceUrl = `https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:${content ? fetchCelex : baseCelex}`
        const baseMetadata = {
          consolidatedCelex: consCelex,
          consolidatedDate: consDate
            ? consDate.toISOString().slice(0, 10)
            : null,
          entryIntoForceDates: meta?.entryIntoForceDates ?? [],
          deadlineDates: meta?.deadlineDates ?? [],
          // Which version html_content actually holds — drives the Stage 2
          // preamble merge (consolidated body lacks recitals; base has them).
          htmlSource: content
            ? fetchCelex === baseCelex
              ? 'base'
              : 'consolidated'
            : null,
          ...(contentUnavailable ? { contentUnavailable: true } : {}),
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
          source_url: sourceUrl,
          metadata: baseMetadata,
          status: 'ACTIVE' as const, // in the in-force corpus ⇒ active (un-retires)
          // Only touch html/full_text when we actually fetched content.
          ...(content
            ? { html_content: content.html, full_text: content.plainText } // RAW at stage 1; normalized in stage 2
            : {}),
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
        wroteAnything = true

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
        row.rawHtmlLen = content?.html.length ?? 0
        cpDoc.ingest = 'ok'

        // Metadata-only rows: nothing for stage 2/3 to do UNLESS an older
        // ingest (2.4 year-runs) left usable HTML on the row.
        if (contentUnavailable) {
          const existing = await prisma.legalDocument.findUnique({
            where: { id: doc.id },
            select: { html_content: true },
          })
          if (!existing?.html_content) {
            metadataOnly = true
            cpDoc.normalize = 'ok'
            cpDoc.embed = 'ok'
            row.status = 'METADATA_ONLY'
          }
        }
      }

      // Resolve docId if a later stage runs standalone (or ingest was skipped).
      if (!docId) {
        const byEu = await prisma.euDocument.findUnique({
          where: { celex_number: baseCelex },
          select: { document_id: true },
        })
        docId = byEu?.document_id ?? null
        if (!docId) {
          const existing = await prisma.legalDocument.findUnique({
            where: { document_number: baseCelex },
            select: { id: true },
          })
          docId = existing?.id ?? null
        }
      }
      if (!docId) {
        row.status = 'NOT_IN_DB'
        if (checkpoint) {
          checkpoint.docs[baseCelex] = { ...cpDoc, status: 'NOT_IN_DB' }
        }
        results.push(row)
        console.log(JSON.stringify(row))
        return
      }

      // ---- STAGE 2: normalize (transform -> merge preamble -> linkify -> markdown) ----
      if (
        runNormalize &&
        slugMap &&
        !metadataOnly &&
        !(args.resume && cpDoc.normalize === 'ok')
      ) {
        const doc = await prisma.legalDocument.findUnique({
          where: { id: docId },
          select: { html_content: true, title: true, metadata: true },
        })
        if (!doc?.html_content) {
          row.status = 'NO_RAW_HTML'
          if (checkpoint) {
            checkpoint.docs[baseCelex] = { ...cpDoc, status: 'NO_RAW_HTML' }
          }
          results.push(row)
          console.log(JSON.stringify(row))
          return
        }
        const prevMeta = (doc.metadata as Record<string, unknown> | null) ?? {}

        // Already-normalized guard (AC 12): the transformer expects raw CELLAR
        // markup; re-transforming its own output mangles it. `--force` only
        // makes sense after Stage 1 restored raw HTML.
        if (
          doc.html_content.includes('class="legal-document"') &&
          !args.force
        ) {
          row.normalize = 'ALREADY_NORMALIZED'
          cpDoc.normalize = 'ok'
        } else {
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
            const baseRaw =
              await eurlex.fetchDocumentContentViaCellar(baseCelex)
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

          // Retention guard: if the transform loses >30% of the document's text
          // (table-heavy docs, Merger-style), keep the RAW HTML — readable and
          // chunkable via raw-derived markdown — and flag for the
          // transformer-hardening follow-up. Raw stays in place, so the fix
          // re-runs Stage 2 later without any CELLAR re-fetch.
          // Measured on the PRE-merge transform: the spliced base-act preamble
          // adds text that would mask body loss on consolidated docs.
          const rawPlainLen = htmlToPlainText(doc.html_content).length
          const candidateLen = htmlToPlainText(transformed.html).length
          const retention = rawPlainLen > 0 ? candidateLen / rawPlainLen : 1
          row.retention = Number(retention.toFixed(2))

          if (retention < RETENTION_FLOOR) {
            const rawMarkdown = htmlToMarkdown(doc.html_content)
            const rawPlain = htmlToPlainText(doc.html_content)
            await prisma.legalDocument.update({
              where: { id: docId },
              data: {
                // html_content untouched (raw)
                markdown_content: rawMarkdown,
                full_text: rawPlain,
                json_content: Prisma.JsonNull,
                metadata: {
                  ...prevMeta,
                  structureType: transformed.structureType,
                  stats: transformed.stats,
                  transformRetention: Number(retention.toFixed(2)),
                  transformSkipped: 'low-retention',
                },
              },
            })
            row.normalize = 'KEPT_RAW (low retention)'
          } else {
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
                  transformRetention: Number(retention.toFixed(2)),
                },
              },
            })
            await saveCrossReferences(docId, linked.linkedReferences, plainText)
            row.linkedRefs = linked.linkedReferences.length
            row.mdLen = markdown.length
          }
          row.structureType = transformed.structureType
          cpDoc.normalize = 'ok'
          wroteAnything = true
        } // end already-normalized guard
      }

      // ---- STAGE 3: chunk + embed ----
      if (runEmbed && !metadataOnly && !(args.resume && cpDoc.embed === 'ok')) {
        const sync = await syncDocumentChunks(docId)
        row.chunks = sync.chunksCreated
        row.embedded = sync.chunksEmbedded
        cpDoc.embed = 'ok'
        wroteAnything = true
      }

      if (row.status !== 'METADATA_ONLY') row.status = 'OK'
      cpDoc.status = String(row.status)
      delete cpDoc.error
      okCount++
    } catch (err) {
      row.status = 'ERROR'
      row.error = err instanceof Error ? err.message : String(err)
      cpDoc.status = 'ERROR'
      cpDoc.error = String(row.error).slice(0, 300)
      errCount++
      if (err instanceof Error && err.stack) {
        console.error(`\n[STACK ${baseCelex}]\n${err.stack}\n`)
      }
    }
    if (checkpoint) checkpoint.docs[baseCelex] = cpDoc
    results.push(row)
    console.log(JSON.stringify(row))
  }

  // Worker pool: each worker pulls the next index until the list is drained.
  let nextIdx = 0
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(items.length, 1)) },
    async () => {
      for (;;) {
        const idx = nextIdx++
        if (idx >= items.length) return
        await processDoc(idx)
        processedCount++
        if (checkpoint && processedCount % 10 === 0) saveCheckpoint(checkpoint)
        if (args.all && processedCount % 25 === 0) {
          const rssMb = Math.round(process.memoryUsage().rss / 1e6)
          console.log(
            `⏱  ${processedCount}/${items.length} (ok=${okCount} err=${errCount}, rss=${rssMb}MB) — ETA ${formatEta(processedCount, items.length, startMs)}`
          )
        }
      }
    }
  )
  await Promise.all(workers)
  if (checkpoint) saveCheckpoint(checkpoint)

  // ---- Retire bucket (AC 12a): in-DB-but-not-in-corpus → ARCHIVED, never deleted ----
  if (args.retire) {
    if (!args.all) {
      console.warn(
        '⚠️  --retire requires --all (needs the full corpus set) — skipped.'
      )
    } else {
      console.log(
        '\n🗄  Reconciling retire bucket (in DB, not in in-force corpus)…'
      )
      const dbDocs = await prisma.legalDocument.findMany({
        where: { content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] } },
        select: {
          id: true,
          document_number: true,
          status: true,
          eu_document: { select: { celex_number: true } },
        },
      })
      const toRetire = dbDocs.filter((d) => {
        const celex = d.eu_document?.celex_number ?? d.document_number
        return celex && !corpusCelexSet.has(celex) && d.status === 'ACTIVE'
      })
      console.log(
        `   DB EU docs: ${dbDocs.length}; not in corpus & ACTIVE: ${toRetire.length}`
      )
      if (toRetire.length) {
        const ids = toRetire.map((d) => d.id)
        // Sequential-ish single statement; never delete (preserves law-list refs).
        await prisma.legalDocument.updateMany({
          where: { id: { in: ids } },
          data: { status: 'ARCHIVED' },
        })
        wroteAnything = true
        console.log(
          `   Retired ${ids.length} docs → ARCHIVED. Sample: ${toRetire
            .slice(0, 10)
            .map((d) => d.eu_document?.celex_number ?? d.document_number)
            .join(', ')}`
        )
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━ SUMMARY ━━━━━━━━━━━━━━━━━')
  if (results.length <= 60) console.table(results)
  const ok = results.filter((r) => r.status === 'OK').length
  const buckets: Record<string, number> = {}
  for (const r of results) {
    const s = String(r.status)
    buckets[s] = (buckets[s] ?? 0) + 1
  }
  console.log(`Buckets: ${JSON.stringify(buckets)}`)
  console.log(
    `\n✅ ${ok}/${results.length} OK${skipped ? ` (+${skipped} resumed-skip)` : ''}`
  )

  if (wroteAnything) await invalidateRenderCaches()
  await prisma.$disconnect()
}

/**
 * Transformer-prevalence sampling (no DB writes): fetch N random corpus docs
 * (or an explicit --celex list), transform in memory, and measure TEXT
 * RETENTION (transformed plain text ÷ raw plain text). Retention is the gate
 * metric — article-count heuristics false-flag `minimal` docs, which are pure
 * passthrough (retention 1.0); real loss happens on table-heavy flat docs.
 */
async function runSample(
  n: number,
  explicitCelex: string[] | null,
  eurlex: typeof import('../lib/external/eurlex'),
  transformEuHtml: typeof import('../lib/eu/eu-html-transformer').transformEuHtml,
  htmlToPlainText: (_html: string) => string
) {
  console.log(
    `🔬 Transformer retention sample: ${explicitCelex ? explicitCelex.length + ' explicit' : n + ' random corpus'} docs (no DB writes)`
  )
  const corpus = await eurlex.fetchCorpus()
  console.log(`📊 Corpus: ${corpus.length} base acts`)
  let sample: typeof corpus
  if (explicitCelex) {
    const byCelex = new Map(corpus.map((e) => [e.celex, e]))
    sample = explicitCelex.map(
      (c) =>
        byCelex.get(c) ?? {
          celex: c,
          contentType: 'EU_REGULATION' as const,
          latestConsolidatedCelex: null,
          latestConsolidatedDate: null,
        }
    )
  } else {
    // Shuffle (Fisher–Yates) and take N.
    for (let i = corpus.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[corpus[i], corpus[j]] = [corpus[j]!, corpus[i]!]
    }
    sample = corpus.slice(0, n)
  }

  const rows: Array<Record<string, unknown>> = []
  let suspects = 0
  for (const entry of sample) {
    const fetchCelex = entry.latestConsolidatedCelex ?? entry.celex
    const row: Record<string, unknown> = {
      celex: entry.celex,
      cons: entry.latestConsolidatedCelex ? 'y' : 'n',
    }
    try {
      let content = await eurlex.fetchDocumentContentViaCellar(fetchCelex)
      if (!content && fetchCelex !== entry.celex) {
        content = await eurlex.fetchDocumentContentViaCellar(entry.celex)
      }
      if (!content) {
        row.status = 'NO_CONTENT'
        rows.push(row)
        console.log(JSON.stringify(row))
        continue
      }
      const t = transformEuHtml(content.html, {
        celex: entry.celex,
        documentNumber: entry.celex,
      })
      const rawLen = content.plainText.length
      const outLen = htmlToPlainText(t.html).length
      const retention = rawLen > 0 ? outLen / rawLen : 1
      row.structure = t.structureType
      row.rawLen = rawLen
      row.retention = Number(retention.toFixed(2))
      row.arts = t.stats.articleCount
      row.tables = t.stats.tableCount
      // Suspect = losing >30% of the document's text (Merger-style table loss).
      const suspect = retention < 0.7
      row.suspect = suspect ? '⚠️' : ''
      if (suspect) suspects++
      row.status = 'OK'
    } catch (err) {
      row.status = 'ERROR'
      row.error = err instanceof Error ? err.message : String(err)
    }
    rows.push(row)
    console.log(JSON.stringify(row))
  }

  console.log('\n━━━━━━━━━━━━━ SAMPLE SUMMARY ━━━━━━━━━━━━━')
  console.table(rows)
  const okRows = rows.filter((r) => r.status === 'OK').length
  console.log(
    `\n${okRows}/${rows.length} transformed; suspects (<70% text retention): ${suspects} (${((suspects / Math.max(okRows, 1)) * 100).toFixed(0)}%)`
  )
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
