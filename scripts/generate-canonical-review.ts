#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Generate HTML review files for canonical pipeline output.
 * Pulls real documents from the DB and shows before/after normalization,
 * derived JSON, and derived markdown.
 *
 * Usage: npx tsx scripts/generate-canonical-review.ts
 * Output: data/canonical-review/*.html
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import { PrismaClient, ContentType } from '@prisma/client'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()
const OUT_DIR = resolve(process.cwd(), 'data/canonical-review')

interface ReviewDoc {
  label: string
  slug: string
  documentNumber: string
  title: string
  contentType: ContentType
  originalHtml: string
  canonicalHtml: string
  wasNormalized: boolean
  json: unknown
  validation: { valid: boolean; errors: string[] }
  markdown: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildReviewHtml(doc: ReviewDoc): string {
  const jsonStr = JSON.stringify(doc.json, null, 2)

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(doc.documentNumber)} — Canonical Review</title>
  <style>
    :root { --bg: #f8f9fa; --card: #fff; --border: #dee2e6; --accent: #0d6efd; --pass: #198754; --fail: #dc3545; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: #212529; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #6c757d; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .meta span { display: inline-block; margin-right: 1.5rem; }
    .badge { display: inline-block; padding: 0.15em 0.5em; border-radius: 4px; font-size: 0.8rem; font-weight: 600; color: #fff; }
    .badge-pass { background: var(--pass); }
    .badge-fail { background: var(--fail); }
    .badge-type { background: var(--accent); }
    .badge-norm { background: #6f42c1; }
    .tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 0; }
    .tab { padding: 0.6rem 1.2rem; cursor: pointer; border: 2px solid transparent; border-bottom: none; background: none; font-size: 0.95rem; font-weight: 500; color: #6c757d; border-radius: 6px 6px 0 0; }
    .tab:hover { color: #212529; background: #e9ecef; }
    .tab.active { color: var(--accent); border-color: var(--border); border-bottom-color: var(--card); background: var(--card); margin-bottom: -2px; }
    .panel { display: none; background: var(--card); border: 2px solid var(--border); border-top: none; border-radius: 0 0 8px 8px; padding: 1.5rem; overflow: auto; }
    .panel.active { display: block; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem; font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace; line-height: 1.5; }
    .rendered { padding: 1rem; }
    .rendered h1, .rendered h2, .rendered h3 { margin-top: 1em; margin-bottom: 0.3em; }
    .rendered p { margin: 0.4em 0; }
    .rendered table { border-collapse: collapse; margin: 1em 0; }
    .rendered th, .rendered td { border: 1px solid var(--border); padding: 0.4em 0.8em; text-align: left; }
    .rendered th { background: #f1f3f5; font-weight: 600; }
    .diff-label { font-size: 0.8rem; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .side-by-side > div { overflow: auto; max-height: 600px; border: 1px solid var(--border); border-radius: 6px; padding: 1rem; }
    .errors { background: #fff5f5; border: 1px solid var(--fail); border-radius: 6px; padding: 1rem; margin-top: 1rem; }
    .errors li { color: var(--fail); margin-left: 1.5rem; }
    @media (max-width: 900px) { .side-by-side { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(doc.documentNumber)} — ${escapeHtml(doc.title)}</h1>
  <div class="meta">
    <span class="badge badge-type">${doc.contentType}</span>
    <span class="badge ${doc.validation.valid ? 'badge-pass' : 'badge-fail'}">${doc.validation.valid ? 'VALID' : 'INVALID'}</span>
    ${doc.wasNormalized ? '<span class="badge badge-norm">NORMALIZED</span>' : '<span class="badge" style="background:#6c757d">ALREADY CANONICAL</span>'}
    <span>HTML: ${doc.canonicalHtml.length.toLocaleString()} chars</span>
    <span>JSON: ${jsonStr.length.toLocaleString()} chars</span>
    <span>MD: ${doc.markdown.length.toLocaleString()} chars</span>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="showTab(event, 'rendered')">Rendered HTML</button>
    <button class="tab" onclick="showTab(event, 'html-source')">HTML Source</button>
    <button class="tab" onclick="showTab(event, 'json')">Derived JSON</button>
    <button class="tab" onclick="showTab(event, 'markdown')">Derived Markdown</button>
    ${doc.wasNormalized ? '<button class="tab" onclick="showTab(event, \'before-after\')">Before → After</button>' : ''}
  </div>

  <div id="rendered" class="panel active">
    <div class="rendered">
      ${doc.canonicalHtml}
    </div>
  </div>

  <div id="html-source" class="panel">
    <pre>${escapeHtml(doc.canonicalHtml)}</pre>
  </div>

  <div id="json" class="panel">
    <pre>${escapeHtml(jsonStr)}</pre>
    ${!doc.validation.valid ? `<div class="errors"><strong>Validation errors:</strong><ul>${doc.validation.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul></div>` : ''}
  </div>

  <div id="markdown" class="panel">
    <pre>${escapeHtml(doc.markdown)}</pre>
  </div>

  ${
    doc.wasNormalized
      ? `
  <div id="before-after" class="panel">
    <div class="side-by-side">
      <div>
        <div class="diff-label">Original (from DB)</div>
        <pre>${escapeHtml(doc.originalHtml.slice(0, 15000))}${doc.originalHtml.length > 15000 ? '\n\n... truncated ...' : ''}</pre>
      </div>
      <div>
        <div class="diff-label">Normalized (canonical)</div>
        <pre>${escapeHtml(doc.canonicalHtml.slice(0, 15000))}${doc.canonicalHtml.length > 15000 ? '\n\n... truncated ...' : ''}</pre>
      </div>
    </div>
  </div>
  `
      : ''
  }

  <script>
    function showTab(e, id) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      document.getElementById(id).classList.add('active');
    }
  </script>
</body>
</html>`
}

function buildIndexHtml(docs: ReviewDoc[]): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Story 14.1 — Canonical Pipeline Review</title>
  <style>
    :root { --bg: #f8f9fa; --card: #fff; --border: #dee2e6; --accent: #0d6efd; --pass: #198754; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: #212529; padding: 2rem; line-height: 1.6; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .subtitle { color: #6c757d; margin-bottom: 2rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.2rem 1.5rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; text-decoration: none; color: inherit; transition: box-shadow 0.15s; }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .card-left h2 { font-size: 1.1rem; margin-bottom: 0.2rem; }
    .card-left .doc-num { color: #6c757d; font-size: 0.9rem; }
    .badge { display: inline-block; padding: 0.15em 0.5em; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: #fff; margin-left: 0.5rem; }
    .badge-type { background: var(--accent); }
    .badge-pass { background: var(--pass); }
    .badge-norm { background: #6f42c1; }
    .arrow { font-size: 1.5rem; color: #adb5bd; }
  </style>
</head>
<body>
  <h1>Story 14.1 — Canonical Pipeline Review</h1>
  <p class="subtitle">Click each document to review rendered HTML, source, derived JSON, and markdown.</p>
  ${docs
    .map(
      (d) => `
  <a class="card" href="${d.slug}.html">
    <div class="card-left">
      <h2>${escapeHtml(d.label)}</h2>
      <div class="doc-num">${escapeHtml(d.documentNumber)} — ${escapeHtml(d.title)}</div>
    </div>
    <div>
      <span class="badge badge-type">${d.contentType}</span>
      <span class="badge badge-pass">VALID</span>
      ${d.wasNormalized ? '<span class="badge badge-norm">NORM</span>' : ''}
      <span class="arrow">→</span>
    </div>
  </a>
  `
    )
    .join('')}
</body>
</html>`
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const reviews: ReviewDoc[] = []

  // 1. SFS Law — real from DB
  console.log('Fetching SFS 1977:1160...')
  const sfsLaw = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      content_type: true,
    },
  })

  if (sfsLaw?.html_content) {
    const normalized = normalizeSfsLaw(sfsLaw.html_content, {
      documentNumber: sfsLaw.document_number,
      title: sfsLaw.title,
    })
    const json = parseCanonicalHtml(normalized)
    const validation = validateCanonicalJson(json)
    const markdown = htmlToMarkdown(normalized)
    reviews.push({
      label: 'SFS Law (Riksdag → normalized)',
      slug: 'sfs-law',
      documentNumber: sfsLaw.document_number,
      title: sfsLaw.title,
      contentType: sfsLaw.content_type,
      originalHtml: sfsLaw.html_content,
      canonicalHtml: normalized,
      wasNormalized: normalized !== sfsLaw.html_content,
      json,
      validation,
      markdown,
    })
    console.log(
      `  ✓ ${sfsLaw.document_number} (${sfsLaw.html_content.length} → ${normalized.length} chars, valid: ${validation.valid})`
    )
  } else {
    console.log('  ✗ Not found in DB')
  }

  // 2. SFS Amendment — should already be canonical
  console.log('Fetching an SFS amendment...')
  const amendment = await prisma.legalDocument.findFirst({
    where: {
      content_type: ContentType.SFS_AMENDMENT,
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      content_type: true,
    },
    orderBy: { document_number: 'desc' },
  })

  if (amendment?.html_content) {
    const json = parseCanonicalHtml(amendment.html_content)
    const validation = validateCanonicalJson(json)
    const markdown = htmlToMarkdown(amendment.html_content)
    reviews.push({
      label: 'SFS Amendment (already canonical)',
      slug: 'sfs-amendment',
      documentNumber: amendment.document_number,
      title: amendment.title,
      contentType: amendment.content_type,
      originalHtml: amendment.html_content,
      canonicalHtml: amendment.html_content,
      wasNormalized: false,
      json,
      validation,
      markdown,
    })
    console.log(
      `  ✓ ${amendment.document_number} (${amendment.html_content.length} chars, valid: ${validation.valid})`
    )
  }

  // 3. AFS regulation (html-scraped)
  console.log('Fetching an AFS regulation...')
  const afs = await prisma.legalDocument.findFirst({
    where: {
      content_type: ContentType.AGENCY_REGULATION,
      html_content: { not: null },
      document_number: { startsWith: 'AFS' },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      content_type: true,
    },
    orderBy: { document_number: 'asc' },
  })

  if (afs?.html_content) {
    const json = parseCanonicalHtml(afs.html_content)
    const validation = validateCanonicalJson(json)
    const markdown = htmlToMarkdown(afs.html_content)
    reviews.push({
      label: 'AFS Agency Regulation',
      slug: 'afs-regulation',
      documentNumber: afs.document_number,
      title: afs.title,
      contentType: afs.content_type,
      originalHtml: afs.html_content,
      canonicalHtml: afs.html_content,
      wasNormalized: false,
      json,
      validation,
      markdown,
    })
    console.log(
      `  ✓ ${afs.document_number} (${afs.html_content.length} chars, valid: ${validation.valid})`
    )
  }

  // 4. EU regulation
  console.log('Fetching an EU regulation...')
  const eu = await prisma.legalDocument.findFirst({
    where: {
      content_type: ContentType.EU_REGULATION,
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      content_type: true,
    },
    orderBy: { document_number: 'asc' },
  })

  if (eu?.html_content) {
    const json = parseCanonicalHtml(eu.html_content)
    const validation = validateCanonicalJson(json)
    const markdown = htmlToMarkdown(eu.html_content)
    reviews.push({
      label: 'EU Regulation',
      slug: 'eu-regulation',
      documentNumber: eu.document_number,
      title: eu.title,
      contentType: eu.content_type,
      originalHtml: eu.html_content,
      canonicalHtml: eu.html_content,
      wasNormalized: false,
      json,
      validation,
      markdown,
    })
    console.log(
      `  ✓ ${eu.document_number} (${eu.html_content.length} chars, valid: ${validation.valid})`
    )
  }

  // 5. Flat agency regulation (MSBFS or NFS — no chapters)
  console.log('Fetching a flat agency regulation...')
  const flat = await prisma.legalDocument.findFirst({
    where: {
      content_type: ContentType.AGENCY_REGULATION,
      html_content: { not: null },
      document_number: { startsWith: 'MSBFS' },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      content_type: true,
    },
    orderBy: { document_number: 'asc' },
  })

  if (flat?.html_content) {
    const json = parseCanonicalHtml(flat.html_content)
    const validation = validateCanonicalJson(json)
    const markdown = htmlToMarkdown(flat.html_content)
    reviews.push({
      label: 'Flat Agency Regulation (no chapters)',
      slug: 'flat-regulation',
      documentNumber: flat.document_number,
      title: flat.title,
      contentType: flat.content_type,
      originalHtml: flat.html_content,
      canonicalHtml: flat.html_content,
      wasNormalized: false,
      json,
      validation,
      markdown,
    })
    console.log(
      `  ✓ ${flat.document_number} (${flat.html_content.length} chars, valid: ${validation.valid})`
    )
  }

  // Write HTML files
  console.log(`\nWriting ${reviews.length} review files to ${OUT_DIR}/...`)
  for (const doc of reviews) {
    const html = buildReviewHtml(doc)
    const filepath = resolve(OUT_DIR, `${doc.slug}.html`)
    fs.writeFileSync(filepath, html, 'utf-8')
    console.log(`  → ${doc.slug}.html (${(html.length / 1024).toFixed(0)} KB)`)
  }

  // Write index
  const indexHtml = buildIndexHtml(reviews)
  fs.writeFileSync(resolve(OUT_DIR, 'index.html'), indexHtml, 'utf-8')
  console.log(`  → index.html`)

  console.log(`\nDone! Open: data/canonical-review/index.html`)
}

main()
  .catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
