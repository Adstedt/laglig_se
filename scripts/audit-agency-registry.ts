#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 8.17 — Audit Agency Registry Completeness
 *
 * Two modes:
 *   Default:      Fetches agency listing pages, compares to registry, outputs audit report
 *   --verify-db:  Cross-references all non-stub registry entries against database
 *
 * Usage:
 *   npx tsx scripts/audit-agency-registry.ts
 *   npx tsx scripts/audit-agency-registry.ts --verify-db
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'node:url'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import * as path from 'path'
import * as cheerio from 'cheerio'
import { PrismaClient } from '@prisma/client'
import {
  type AgencyAuthority,
  type AgencyPdfDocument,
  SUPPORTED_AUTHORITIES,
  getRegistryByAuthority,
} from '../lib/agency/agency-pdf-registry'
import { AFS_REGISTRY } from '../lib/agency/afs-registry'

const prisma = new PrismaClient()

// ============================================================================
// Types
// ============================================================================

interface AuditEntry {
  documentNumber: string
  title: string
  inRegistry: boolean
  status: 'existing' | 'new' | 'stub'
}

interface AgencyAuditResult {
  authority: string
  listingUrl: string
  foundOnWebsite: AuditEntry[]
  inRegistryOnly: string[]
  newToAdd: AuditEntry[]
  fetchError?: string
  notes?: string
}

interface VerifyDbResult {
  documentNumber: string
  source: 'agency-pdf' | 'afs'
  hasDbRecord: boolean
  hasHtmlContent: boolean
  hasMarkdownContent: boolean
  hasFullText: boolean
  status: 'pass' | 'missing' | 'incomplete'
}

// ============================================================================
// Agency Listing Page URLs
// ============================================================================

const AGENCY_LISTING_URLS: Record<AgencyAuthority, string> = {
  msbfs: 'https://www.mcf.se/sv/regler/gallande-regler/',
  nfs: 'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/',
  'elsak-fs':
    'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/',
  kifs: 'https://www.kemi.se/lagar-och-regler/lagstiftningar-inom-kemikalieomradet/kemikalieinspektionens-foreskrifter-kifs',
  bfs: 'https://forfattningssamling.boverket.se/',
  skvfs: 'https://www4.skatteverket.se/rattsligvagledning/341539.html',
  'scb-fs':
    'https://www.scb.se/om-scb/scbs-verksamhet/regelverk-och-policyer/foreskrifter/',
  ssmfs: 'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/',
  stafs: 'https://www.swedac.se/dokument/',
  srvfs: 'https://www.mcf.se/sv/regler/gallande-regler/',
}

// ============================================================================
// Fetch Helpers
// ============================================================================

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LagligBot/1.0; +https://laglig.se)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      console.warn(`  [WARN] HTTP ${response.status} from ${url}`)
      return null
    }
    return await response.text()
  } catch (err) {
    console.warn(
      `  [WARN] Fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}

// ============================================================================
// Per-Agency Extraction Logic
// ============================================================================

function extractMsbfsAndSrvfs(
  html: string,
  prefix: 'MSBFS' | 'SRVFS'
): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  // mcf.se lists regulations as links — look for links containing the prefix
  $('a').each((_, el) => {
    const text = $(el).text().trim()
    const match = text.match(new RegExp(`(${prefix}\\s+\\d{4}[:/]\\d+)`, 'i'))
    if (match) {
      const docNum = match[1]!.replace('/', ':').replace(/\s+/g, ' ')
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text,
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  // Also scan headings and list items
  $('h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = new RegExp(`(${prefix}\\s+\\d{4}[:/]\\d+)`, 'gi')
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = match[1]!.replace('/', ':').replace(/\s+/g, ' ')
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractNfs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td, span').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /NFS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `NFS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractElsakFs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /ELSÄK-FS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `ELSÄK-FS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractKifs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /KIFS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `KIFS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractBfs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /BFS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `BFS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractSkvfs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /SKVFS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `SKVFS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractScbFs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /SCB-FS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `SCB-FS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractSsmfs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /SSMFS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `SSMFS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractStafs(html: string): AuditEntry[] {
  const $ = cheerio.load(html)
  const entries: AuditEntry[] = []
  const seen = new Set<string>()

  $('a, h1, h2, h3, h4, li, p, td').each((_, el) => {
    const text = $(el).text().trim()
    const regex = /STAFS\s+(\d{4})[:/](\d+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const docNum = `STAFS ${match[1]}:${match[2]}`
      if (!seen.has(docNum)) {
        seen.add(docNum)
        entries.push({
          documentNumber: docNum,
          title: text.slice(0, 200),
          inRegistry: false,
          status: 'new',
        })
      }
    }
  })

  return entries
}

function extractDocumentsFromHtml(
  html: string,
  authority: AgencyAuthority
): AuditEntry[] {
  switch (authority) {
    case 'msbfs':
      return extractMsbfsAndSrvfs(html, 'MSBFS')
    case 'srvfs':
      return extractMsbfsAndSrvfs(html, 'SRVFS')
    case 'nfs':
      return extractNfs(html)
    case 'elsak-fs':
      return extractElsakFs(html)
    case 'kifs':
      return extractKifs(html)
    case 'bfs':
      return extractBfs(html)
    case 'skvfs':
      return extractSkvfs(html)
    case 'scb-fs':
      return extractScbFs(html)
    case 'ssmfs':
      return extractSsmfs(html)
    case 'stafs':
      return extractStafs(html)
    default:
      return []
  }
}

// ============================================================================
// Audit Mode (Default)
// ============================================================================

async function auditAgency(
  authority: AgencyAuthority
): Promise<AgencyAuditResult> {
  const listingUrl = AGENCY_LISTING_URLS[authority]
  const registry = getRegistryByAuthority(authority)
  const registryDocNums = new Set(registry.map((d) => d.documentNumber))

  console.log(`\n--- Auditing ${authority.toUpperCase()} ---`)
  console.log(`  Listing URL: ${listingUrl}`)
  console.log(`  Registry entries: ${registry.length}`)

  const html = await fetchPage(listingUrl)
  if (!html) {
    return {
      authority,
      listingUrl,
      foundOnWebsite: [],
      inRegistryOnly: [...registryDocNums],
      newToAdd: [],
      fetchError: 'Failed to fetch listing page',
    }
  }

  const found = extractDocumentsFromHtml(html, authority)
  console.log(`  Documents found on website: ${found.length}`)

  // Cross-reference with registry
  const foundDocNums = new Set(found.map((e) => e.documentNumber))

  for (const entry of found) {
    if (registryDocNums.has(entry.documentNumber)) {
      entry.inRegistry = true
      const regDoc = registry.find(
        (d) => d.documentNumber === entry.documentNumber
      )
      entry.status = regDoc?.stubOnly ? 'stub' : 'existing'
    }
  }

  const newToAdd = found.filter((e) => !e.inRegistry)
  const inRegistryOnly = registry
    .filter((d) => !foundDocNums.has(d.documentNumber))
    .map((d) => d.documentNumber)

  console.log(`  Already in registry: ${found.length - newToAdd.length}`)
  console.log(`  New to add: ${newToAdd.length}`)
  console.log(`  In registry but not found on page: ${inRegistryOnly.length}`)

  return {
    authority,
    listingUrl,
    foundOnWebsite: found,
    inRegistryOnly,
    newToAdd,
  }
}

function generateAuditReport(results: AgencyAuditResult[]): string {
  const lines: string[] = []
  const timestamp = new Date().toISOString()

  lines.push('# Agency Registry Audit Report')
  lines.push('')
  lines.push(`**Generated:** ${timestamp}`)
  lines.push(
    `**Purpose:** Compare agency website listings against registry entries`
  )
  lines.push('')

  // Summary table
  lines.push('## Summary')
  lines.push('')
  lines.push(
    '| Agency | On Website | In Registry | New | Registry-Only | Status |'
  )
  lines.push(
    '|--------|-----------|-------------|-----|---------------|--------|'
  )

  for (const r of results) {
    const onWeb = r.foundOnWebsite.length
    const inReg = r.foundOnWebsite.filter((e) => e.inRegistry).length
    const newCount = r.newToAdd.length
    const regOnly = r.inRegistryOnly.length
    const status = r.fetchError
      ? 'FETCH ERROR'
      : newCount > 0
        ? 'NEEDS UPDATE'
        : 'OK'
    lines.push(
      `| ${r.authority.toUpperCase()} | ${onWeb} | ${inReg} | ${newCount} | ${regOnly} | ${status} |`
    )
  }

  lines.push('')

  // Per-agency details
  for (const r of results) {
    lines.push(`## ${r.authority.toUpperCase()}`)
    lines.push('')
    lines.push(`**Listing URL:** ${r.listingUrl}`)
    lines.push('')

    if (r.fetchError) {
      lines.push(`**Error:** ${r.fetchError}`)
      lines.push('')
      if (r.notes) {
        lines.push(`**Notes:** ${r.notes}`)
        lines.push('')
      }
      continue
    }

    if (r.newToAdd.length > 0) {
      lines.push('### New Documents Found')
      lines.push('')
      for (const e of r.newToAdd) {
        lines.push(`- **${e.documentNumber}**: ${e.title}`)
      }
      lines.push('')
    }

    if (r.inRegistryOnly.length > 0) {
      lines.push('### In Registry But Not Found On Page')
      lines.push('')
      lines.push(
        '_These may be older regulations not listed on the main page, or the extraction may have missed them._'
      )
      lines.push('')
      for (const docNum of r.inRegistryOnly) {
        lines.push(`- ${docNum}`)
      }
      lines.push('')
    }

    if (r.newToAdd.length === 0 && r.inRegistryOnly.length === 0) {
      lines.push('Registry is complete for this agency.')
      lines.push('')
    }

    if (r.notes) {
      lines.push(`**Notes:** ${r.notes}`)
      lines.push('')
    }
  }

  // Access limitations
  lines.push('## Access Limitations')
  lines.push('')
  lines.push(
    '- **BFS (Boverket):** forfattningssamling.boverket.se uses dynamic JS rendering; automated extraction may be incomplete'
  )
  lines.push(
    '- **SKVFS (Skatteverket):** Older format website; some PDFs only available via Web Archive'
  )
  lines.push(
    '- **STAFS (Swedac):** Document listing uses WordPress; filtering for STAFS prefix required'
  )
  lines.push(
    '- **SCB-FS:** Regulations listed on sub-pages by topic; main page may not show all'
  )
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Verify DB Mode (--verify-db)
// ============================================================================

async function verifyDb(): Promise<void> {
  console.log('='.repeat(60))
  console.log('Verify DB — Registry vs Database Cross-Reference')
  console.log('='.repeat(60))
  console.log()

  const results: VerifyDbResult[] = []

  // 1. Check all non-stub agency PDF registry entries
  for (const authority of SUPPORTED_AUTHORITIES) {
    const registry = getRegistryByAuthority(authority)
    for (const doc of registry) {
      if (doc.stubOnly) continue

      const dbRecord = await prisma.legalDocument.findUnique({
        where: { document_number: doc.documentNumber },
        select: {
          html_content: true,
          markdown_content: true,
          full_text: true,
          content_type: true,
        },
      })

      if (!dbRecord) {
        results.push({
          documentNumber: doc.documentNumber,
          source: 'agency-pdf',
          hasDbRecord: false,
          hasHtmlContent: false,
          hasMarkdownContent: false,
          hasFullText: false,
          status: 'missing',
        })
      } else {
        const hasHtml = dbRecord.html_content != null
        const hasMd = dbRecord.markdown_content != null
        const hasText = dbRecord.full_text != null
        const complete = hasHtml && hasMd && hasText
        results.push({
          documentNumber: doc.documentNumber,
          source: 'agency-pdf',
          hasDbRecord: true,
          hasHtmlContent: hasHtml,
          hasMarkdownContent: hasMd,
          hasFullText: hasText,
          status: complete ? 'pass' : 'incomplete',
        })
      }
    }
  }

  // 2. Check all AFS registry entries (standalone, keep-whole, split parents + chapters)
  for (const doc of AFS_REGISTRY) {
    if (doc.tier === 'SPLIT') {
      // Check parent
      const parentDocNum = doc.documentNumber
      const parentRecord = await prisma.legalDocument.findUnique({
        where: { document_number: parentDocNum },
        select: {
          html_content: true,
          markdown_content: true,
          full_text: true,
        },
      })

      // Parent entries for SPLIT docs may have null content (they are omnibus containers)
      // Just check they exist
      results.push({
        documentNumber: parentDocNum,
        source: 'afs',
        hasDbRecord: parentRecord != null,
        hasHtmlContent: parentRecord?.html_content != null,
        hasMarkdownContent: parentRecord?.markdown_content != null,
        hasFullText: parentRecord?.full_text != null,
        status: parentRecord != null ? 'pass' : 'missing',
      })

      // Check each chapter
      for (const chapter of doc.chapters) {
        const chapterDocNum = `${doc.documentNumber} kap. ${chapter.number}`
        const chapterRecord = await prisma.legalDocument.findUnique({
          where: { document_number: chapterDocNum },
          select: {
            html_content: true,
            markdown_content: true,
            full_text: true,
          },
        })

        if (!chapterRecord) {
          results.push({
            documentNumber: chapterDocNum,
            source: 'afs',
            hasDbRecord: false,
            hasHtmlContent: false,
            hasMarkdownContent: false,
            hasFullText: false,
            status: 'missing',
          })
        } else {
          const hasHtml = chapterRecord.html_content != null
          const hasMd = chapterRecord.markdown_content != null
          const hasText = chapterRecord.full_text != null
          results.push({
            documentNumber: chapterDocNum,
            source: 'afs',
            hasDbRecord: true,
            hasHtmlContent: hasHtml,
            hasMarkdownContent: hasMd,
            hasFullText: hasText,
            status: hasHtml && hasMd && hasText ? 'pass' : 'incomplete',
          })
        }
      }
    } else {
      // STANDALONE or KEEP_WHOLE
      const dbRecord = await prisma.legalDocument.findUnique({
        where: { document_number: doc.documentNumber },
        select: {
          html_content: true,
          markdown_content: true,
          full_text: true,
        },
      })

      if (!dbRecord) {
        results.push({
          documentNumber: doc.documentNumber,
          source: 'afs',
          hasDbRecord: false,
          hasHtmlContent: false,
          hasMarkdownContent: false,
          hasFullText: false,
          status: 'missing',
        })
      } else {
        const hasHtml = dbRecord.html_content != null
        const hasMd = dbRecord.markdown_content != null
        const hasText = dbRecord.full_text != null
        results.push({
          documentNumber: doc.documentNumber,
          source: 'afs',
          hasDbRecord: true,
          hasHtmlContent: hasHtml,
          hasMarkdownContent: hasMd,
          hasFullText: hasText,
          status: hasHtml && hasMd && hasText ? 'pass' : 'incomplete',
        })
      }
    }
  }

  // Print results
  const passed = results.filter((r) => r.status === 'pass')
  const missing = results.filter((r) => r.status === 'missing')
  const incomplete = results.filter((r) => r.status === 'incomplete')

  console.log(`Total entries checked: ${results.length}`)
  console.log(`  Pass: ${passed.length}`)
  console.log(`  Missing: ${missing.length}`)
  console.log(`  Incomplete: ${incomplete.length}`)
  console.log()

  if (missing.length > 0) {
    console.log('--- Missing DB Records ---')
    for (const r of missing) {
      console.log(`  [MISSING] ${r.documentNumber} (${r.source})`)
    }
    console.log()
  }

  if (incomplete.length > 0) {
    console.log('--- Incomplete Content ---')
    for (const r of incomplete) {
      const fields: string[] = []
      if (!r.hasHtmlContent) fields.push('html_content')
      if (!r.hasMarkdownContent) fields.push('markdown_content')
      if (!r.hasFullText) fields.push('full_text')
      console.log(
        `  [INCOMPLETE] ${r.documentNumber} (${r.source}) — missing: ${fields.join(', ')}`
      )
    }
    console.log()
  }

  if (missing.length === 0 && incomplete.length === 0) {
    console.log('ALL ENTRIES PASS — registry and database are in sync.')
  } else {
    console.log(
      `VERIFICATION FAILED: ${missing.length} missing, ${incomplete.length} incomplete`
    )
    process.exit(1)
  }
}

// ============================================================================
// URL Validation Mode (--validate-urls)
// ============================================================================

async function validateUrls(): Promise<void> {
  console.log('='.repeat(60))
  console.log('URL Validation — Checking sourceUrl and pdfUrl accessibility')
  console.log('='.repeat(60))
  console.log()

  const allDocs: AgencyPdfDocument[] = []
  for (const authority of SUPPORTED_AUTHORITIES) {
    allDocs.push(...getRegistryByAuthority(authority))
  }

  let passed = 0
  let failed = 0
  const failures: {
    docNum: string
    urlType: string
    url: string
    status: string
  }[] = []

  for (const doc of allDocs) {
    // Check sourceUrl
    try {
      const res = await fetch(doc.sourceUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LagligBot/1.0; +https://laglig.se)',
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      if (res.ok) {
        passed++
      } else {
        failures.push({
          docNum: doc.documentNumber,
          urlType: 'sourceUrl',
          url: doc.sourceUrl,
          status: `HTTP ${res.status}`,
        })
        failed++
      }
    } catch (err) {
      failures.push({
        docNum: doc.documentNumber,
        urlType: 'sourceUrl',
        url: doc.sourceUrl,
        status: err instanceof Error ? err.message : String(err),
      })
      failed++
    }

    // Check pdfUrl
    try {
      const res = await fetch(doc.pdfUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LagligBot/1.0; +https://laglig.se)',
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      if (res.ok) {
        passed++
      } else {
        failures.push({
          docNum: doc.documentNumber,
          urlType: 'pdfUrl',
          url: doc.pdfUrl,
          status: `HTTP ${res.status}`,
        })
        failed++
      }
    } catch (err) {
      failures.push({
        docNum: doc.documentNumber,
        urlType: 'pdfUrl',
        url: doc.pdfUrl,
        status: err instanceof Error ? err.message : String(err),
      })
      failed++
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`URLs checked: ${passed + failed}`)
  console.log(`  Pass: ${passed}`)
  console.log(`  Fail: ${failed}`)
  console.log()

  if (failures.length > 0) {
    console.log('--- Failed URLs ---')
    for (const f of failures) {
      console.log(`  [FAIL] ${f.docNum} ${f.urlType}: ${f.url} — ${f.status}`)
    }
  } else {
    console.log('ALL URLs ACCESSIBLE')
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  if (argv.includes('--verify-db')) {
    await verifyDb()
    return
  }

  if (argv.includes('--validate-urls')) {
    await validateUrls()
    return
  }

  // Default: audit mode
  console.log('='.repeat(60))
  console.log('Agency Registry Audit')
  console.log('='.repeat(60))

  const results: AgencyAuditResult[] = []

  for (const authority of SUPPORTED_AUTHORITIES) {
    const result = await auditAgency(authority)
    results.push(result)
    // Rate limit between agencies
    await new Promise((r) => setTimeout(r, 1000))
  }

  // Generate and write report
  const report = generateAuditReport(results)
  const reportPath = path.resolve(process.cwd(), 'data/agency-audit-report.md')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, report)

  console.log()
  console.log(`Audit report written to: ${reportPath}`)
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error('Fatal:', e)
      process.exit(1)
    })
    .finally(() => void prisma.$disconnect())
}

// Exported for testing
export {
  extractDocumentsFromHtml,
  generateAuditReport,
  type AuditEntry,
  type AgencyAuditResult,
  type VerifyDbResult,
}
