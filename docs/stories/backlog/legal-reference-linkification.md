# Story: Legal Reference Linkification (Internal Linking)

## Status

Backlog

## Story

**As a** user reading a legal document,
**I want** references to other laws, court cases, and EU documents to be clickable links,
**So that** I can easily navigate to related legal sources without manual searching.

## Context

Legal documents frequently reference other documents in plain text:

- "enligt 5 § lagen (2012:295)"
- "EU-förordning 2016/679 (GDPR)"
- "jfr NJA 2020 s. 45"

Currently these are plain text. Linkifying them provides:

- **Better UX**: One-click navigation to referenced documents
- **SEO boost**: Internal linking improves search rankings
- **Content discoverability**: Users find related content naturally
- **Legal research**: Easier to trace legal relationships

## Reference Patterns

### Swedish SFS Laws

| Pattern          | Example                       | Document Number |
| ---------------- | ----------------------------- | --------------- |
| Bare reference   | `2012:295`                    | `SFS 2012:295`  |
| With "lag"       | `lag (2012:295)`              | `SFS 2012:295`  |
| Definite article | `lagen (2012:295)`            | `SFS 2012:295`  |
| Förordning       | `förordning (2018:1472)`      | `SFS 2018:1472` |
| With section     | `5 § lagen (2012:295)`        | `SFS 2012:295`  |
| With chapter     | `2 kap. 3 § lagen (2012:295)` | `SFS 2012:295`  |

**Regex:**

```typescript
// Basic SFS reference
/(?:lag(?:en)?|förordning(?:en)?)\s*\((\d{4}):(\d+)\)/gi

// Bare SFS number (more aggressive, may have false positives)
/\b(\d{4}):(\d+)\b/g

// With section reference
/(\d+)\s*(?:kap\.)?\s*(\d+)\s*§\s*(?:lag(?:en)?|förordning(?:en)?)\s*\((\d{4}):(\d+)\)/gi
```

### EU Regulations

| Pattern     | Example                                | Document Number |
| ----------- | -------------------------------------- | --------------- |
| Full format | `förordning (EU) 2016/679`             | `EU 2016/679`   |
| Hyphenated  | `EU-förordning 2016/679`               | `EU 2016/679`   |
| With name   | `dataskyddsförordningen (EU) 2016/679` | `EU 2016/679`   |

**Regex:**

```typescript
;/(?:EU-)?förordning(?:en)?\s*\(?EU\)?\s*(\d{4})\/(\d+)/gi
```

### EU Directives

| Pattern   | Example                 | Document Number |
| --------- | ----------------------- | --------------- |
| EG suffix | `direktiv 2006/123/EG`  | `EU 2006/123`   |
| EU suffix | `direktiv 2019/1158/EU` | `EU 2019/1158`  |

**Regex:**

```typescript
;/direktiv\s*(\d{4})\/(\d+)\/E[GU]/gi
```

### Swedish Court Cases

| Court        | Pattern           | Example           | Document Number   |
| ------------ | ----------------- | ----------------- | ----------------- |
| HD (Supreme) | `NJA YYYY s. N`   | `NJA 2020 s. 45`  | `NJA 2020 s. 45`  |
| HFD (Admin)  | `HFD YYYY ref. N` | `HFD 2020 ref. 5` | `HFD 2020 ref. 5` |
| HFD (old)    | `RÅ YYYY ref. N`  | `RÅ 2010 ref. 1`  | `RÅ 2010 ref. 1`  |
| AD (Labour)  | `AD YYYY nr N`    | `AD 2019 nr 45`   | `AD 2019 nr 45`   |
| MÖD (Env)    | `MÖD YYYY:N`      | `MÖD 2018:3`      | `MÖD 2018:3`      |
| MIG (Migr)   | `MIG YYYY:N`      | `MIG 2017:1`      | `MIG 2017:1`      |

**Regex:**

```typescript
// NJA (Supreme Court)
/NJA\s+(\d{4})\s+s\.\s*(\d+)/gi

// HFD (Supreme Administrative Court, 2011+)
/HFD\s+(\d{4})\s+ref\.\s*(\d+)/gi

// RÅ (Supreme Administrative Court, pre-2011)
/RÅ\s+(\d{4})\s+ref\.\s*(\d+)/gi

// AD (Labour Court)
/AD\s+(\d{4})\s+nr\s*(\d+)/gi

// MÖD (Environmental Court of Appeal)
/MÖD\s+(\d{4}):(\d+)/gi

// MIG (Migration Court of Appeal)
/MIG\s+(\d{4}):(\d+)/gi
```

## Acceptance Criteria

### AC1: Reference Detection Library

- [ ] Create `lib/linkify/legal-references.ts`
- [ ] Implement detection for all pattern types above
- [ ] Handle overlapping matches correctly
- [ ] Return structured reference data with positions

### AC2: Database Lookup

- [ ] Batch lookup detected references against `legal_documents`
- [ ] Match by `document_number` field
- [ ] Handle missing documents gracefully (don't linkify if not in DB)
- [ ] Cache lookups for performance

### AC3: CrossReference Storage (Optional)

- [ ] Store detected references in `CrossReference` table during ingestion
- [ ] Set `reference_type = REFERENCES` or `CITES`
- [ ] Store context snippet for hover previews

### AC4: HTML Linkification

- [ ] Convert plain text references to `<a>` tags
- [ ] Link to `/rattskallor/{slug}` or appropriate route
- [ ] Include `title` attribute with full document name
- [ ] Preserve original text as link label

### AC5: Ingestion Integration

- [ ] Run linkification during document ingestion
- [ ] Store linkified HTML in `html_content` field
- [ ] Update existing documents (backfill script)

### AC6: Performance

- [ ] Process 170K+ documents efficiently
- [ ] Batch database lookups (not N+1)
- [ ] Consider caching document_number → slug mapping

## Technical Implementation

### Reference Detector

```typescript
// lib/linkify/legal-references.ts

export interface DetectedReference {
  match: string // Original text: "lagen (2012:295)"
  type: ContentType // SFS_LAW, EU_REGULATION, etc.
  documentNumber: string // Normalized: "SFS 2012:295"
  startIndex: number // Position in source text
  endIndex: number
  section?: string // "5 §" if detected
  chapter?: string // "2 kap." if detected
}

interface PatternConfig {
  type: ContentType
  regex: RegExp
  toDocNumber: (match: RegExpMatchArray) => string
}

const PATTERNS: PatternConfig[] = [
  {
    type: ContentType.SFS_LAW,
    regex: /(?:lag(?:en)?|förordning(?:en)?)\s*\((\d{4}):(\d+)\)/gi,
    toDocNumber: (m) => `SFS ${m[1]}:${m[2]}`,
  },
  {
    type: ContentType.EU_REGULATION,
    regex: /(?:EU-)?förordning(?:en)?\s*\(?EU\)?\s*(\d{4})\/(\d+)/gi,
    toDocNumber: (m) => `EU ${m[1]}/${m[2]}`,
  },
  {
    type: ContentType.EU_DIRECTIVE,
    regex: /direktiv\s*(\d{4})\/(\d+)\/E[GU]/gi,
    toDocNumber: (m) => `EU ${m[1]}/${m[2]}`,
  },
  {
    type: ContentType.COURT_CASE_HD,
    regex: /NJA\s+(\d{4})\s+s\.\s*(\d+)/gi,
    toDocNumber: (m) => `NJA ${m[1]} s. ${m[2]}`,
  },
  {
    type: ContentType.COURT_CASE_HFD,
    regex: /HFD\s+(\d{4})\s+ref\.\s*(\d+)/gi,
    toDocNumber: (m) => `HFD ${m[1]} ref. ${m[2]}`,
  },
  {
    type: ContentType.COURT_CASE_AD,
    regex: /AD\s+(\d{4})\s+nr\s*(\d+)/gi,
    toDocNumber: (m) => `AD ${m[1]} nr ${m[2]}`,
  },
]

export function detectReferences(text: string): DetectedReference[] {
  const refs: DetectedReference[] = []

  for (const pattern of PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0

    let match
    while ((match = pattern.regex.exec(text)) !== null) {
      refs.push({
        match: match[0],
        type: pattern.type,
        documentNumber: pattern.toDocNumber(match),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  // Sort by position, handle overlaps
  return refs.sort((a, b) => a.startIndex - b.startIndex)
}
```

### Linkifier

```typescript
// lib/linkify/linkify-document.ts

import { prisma } from '@/lib/prisma'
import { detectReferences, DetectedReference } from './legal-references'

interface DocumentSlug {
  document_number: string
  slug: string
  title: string
}

export async function linkifyText(text: string): Promise<string> {
  const refs = detectReferences(text)

  if (refs.length === 0) return text

  // Batch lookup all document numbers
  const docNumbers = [...new Set(refs.map((r) => r.documentNumber))]
  const docs = await prisma.legalDocument.findMany({
    where: { document_number: { in: docNumbers } },
    select: { document_number: true, slug: true, title: true },
  })

  const slugMap = new Map<string, DocumentSlug>(
    docs.map((d) => [d.document_number, d])
  )

  // Build result, replacing from end to preserve indexes
  let result = text
  for (const ref of refs.reverse()) {
    const doc = slugMap.get(ref.documentNumber)
    if (doc) {
      const link = `<a href="/rattskallor/${doc.slug}" class="legal-ref" title="${doc.title}">${ref.match}</a>`
      result =
        result.slice(0, ref.startIndex) + link + result.slice(ref.endIndex)
    }
  }

  return result
}

// For batch processing during ingestion
export async function linkifyDocuments(documentIds: string[]): Promise<void> {
  // Build document_number → slug cache once
  const allDocs = await prisma.legalDocument.findMany({
    select: { document_number: true, slug: true, title: true },
  })
  const slugMap = new Map(allDocs.map((d) => [d.document_number, d]))

  for (const id of documentIds) {
    const doc = await prisma.legalDocument.findUnique({
      where: { id },
      select: { id: true, full_text: true },
    })

    if (!doc?.full_text) continue

    const refs = detectReferences(doc.full_text)

    // Store CrossReferences
    for (const ref of refs) {
      const targetDoc = slugMap.get(ref.documentNumber)
      if (targetDoc) {
        await prisma.crossReference.upsert({
          where: {
            source_document_id_target_document_id: {
              source_document_id: id,
              target_document_id: targetDoc.id,
            },
          },
          create: {
            source_document_id: id,
            target_document_id: targetDoc.id,
            reference_type: 'REFERENCES',
            context: ref.match,
          },
          update: {},
        })
      }
    }

    // Generate linkified HTML
    const html = await linkifyTextWithCache(doc.full_text, slugMap)

    await prisma.legalDocument.update({
      where: { id },
      data: { html_content: html },
    })
  }
}
```

### Frontend Component

```typescript
// components/features/law/legal-content.tsx
'use client'

interface LegalContentProps {
  htmlContent: string | null
  fullText: string | null
}

export function LegalContent({ htmlContent, fullText }: LegalContentProps) {
  // Prefer linkified HTML, fallback to plain text
  const content = htmlContent || fullText

  if (!content) return null

  if (htmlContent) {
    return (
      <div
        className="legal-content prose prose-sm"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    )
  }

  return (
    <div className="legal-content prose prose-sm whitespace-pre-wrap">
      {fullText}
    </div>
  )
}
```

### CSS for Links

```css
/* styles/legal-content.css */
.legal-content a.legal-ref {
  color: var(--color-primary);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.legal-content a.legal-ref:hover {
  text-decoration-style: solid;
}
```

## Architecture Decision

### Recommended: Hybrid Approach

1. **During ingestion**: Detect references → Store in `CrossReference` table
2. **During ingestion**: Generate linkified HTML → Store in `html_content`
3. **On render**: Use pre-generated `html_content` (fast)
4. **Backfill script**: Process existing 170K documents

### Schema Usage

Already exists:

```prisma
model LegalDocument {
  full_text     String?  @db.Text  // Plain text (for search/RAG)
  html_content  String?  @db.Text  // Linkified HTML (for rendering)
}

model CrossReference {
  source_document_id  String
  target_document_id  String
  reference_type      ReferenceType  // REFERENCES, CITES
  context             String?        // Snippet with reference
}
```

## Edge Cases

1. **Self-references**: Law references itself → Don't linkify
2. **Missing documents**: Referenced doc not in DB → Keep as plain text
3. **Overlapping patterns**: "lagen (2012:295)" contains bare "2012:295" → Use longest match
4. **HTML escaping**: Ensure no XSS from document content
5. **Broken references**: Typos in source text → Won't match, acceptable

## Performance Considerations

- **170K documents** × average 10 references = 1.7M lookups
- **Solution**: Build in-memory `document_number → slug` map (< 50MB)
- **Batch processing**: Process 100 documents at a time
- **Estimated time**: ~2-4 hours for full backfill

## Dependencies

- **Depends on**: Stories 2.2, 2.3, 2.4 (documents must be ingested first)
- **Enhances**: All document display pages

## Estimation

- Reference detection library: Small (2-3 hours)
- Linkification logic: Small (2 hours)
- Ingestion integration: Medium (3-4 hours)
- Backfill script: Small (2 hours)
- Frontend styling: Small (1 hour)
- **Total**: ~10-12 hours

## Change Log

| Date       | Version | Description                                                                            | Author      |
| ---------- | ------- | -------------------------------------------------------------------------------------- | ----------- |
| 2025-12-25 | 1.0     | Initial story - comprehensive pattern analysis, implementation approach, code examples | James (Dev) |
