# Amendment Data Model & Version Reconstruction

## Overview

This document describes how we store amendments and reconstruct historical versions of Swedish laws.

## Database Schema

### Core Tables

```prisma
// The amendment document (PDF) - one row per SFS amendment
model AmendmentDocument {
  id              String   @id @default(cuid())
  sfsNumber       String   @unique  // "2022:1109"

  // Storage
  storagePath     String   // Supabase: "sfs-amendments/2022/SFS2022-1109.pdf"
  originalUrl     String   // Source URL for reference
  fileSize        Int      // Bytes

  // Base law reference
  baseLawSfs      String   // "1977:1160" - the law being amended
  baseLawName     String?  // "arbetsmiljölagen"

  // Document metadata
  title           String?  // "Lag om ändring i arbetsmiljölagen (1977:1160)"
  effectiveDate   DateTime // When changes take effect
  publicationDate DateTime? // When published (Utfärdad)

  // Full text for search
  fullText        String   @db.Text

  // Processing status
  parseStatus     ParseStatus @default(PENDING)
  parseError      String?
  parsedAt        DateTime?
  confidence      Float?   // LLM confidence score (0-1)

  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  sectionChanges  SectionChange[]
  baseLaw         LegalDocument? @relation(fields: [baseLawSfs], references: [sfsNumber])

  @@index([baseLawSfs])
  @@index([effectiveDate])
}

// Individual section changes within an amendment
model SectionChange {
  id              String   @id @default(cuid())
  amendmentId     String
  amendment       AmendmentDocument @relation(fields: [amendmentId], references: [id], onDelete: Cascade)

  // Section reference
  chapter         String?  // "7" for "7 kap." or null
  section         String   // "15" or "2a"

  // Change details
  changeType      ChangeType  // amended, repealed, new, renumbered
  oldNumber       String?     // For renumbering: original number
  description     String?     // Brief description of change

  // Text content (extracted from PDF)
  oldText         String?  @db.Text  // Previous text (if available)
  newText         String?  @db.Text  // New text content

  // Ordering within the amendment
  sortOrder       Int      @default(0)

  @@unique([amendmentId, chapter, section, changeType])
  @@index([amendmentId])
}

enum ParseStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  NEEDS_REVIEW
}

enum ChangeType {
  amended      // "ska ha följande lydelse"
  repealed     // "upphävs", "upphöra att gälla"
  new          // "nya paragrafer", "införas"
  renumbered   // "X § blir Y §"
}
```

## Example Data

For SFS 2022:1109 (arbetsmiljölagen amendment):

### AmendmentDocument row:
```json
{
  "id": "clx123abc",
  "sfsNumber": "2022:1109",
  "baseLawSfs": "1977:1160",
  "baseLawName": "arbetsmiljölagen",
  "title": "Lag om ändring i arbetsmiljölagen (1977:1160)",
  "effectiveDate": "2022-07-25",
  "publicationDate": "2022-06-22",
  "storagePath": "sfs-amendments/2022/SFS2022-1109.pdf",
  "parseStatus": "COMPLETED",
  "confidence": 0.95
}
```

### SectionChange rows (9 total):
```json
[
  { "chapter": "1", "section": "2", "changeType": "amended", "description": "Scope extended to include market surveillance" },
  { "chapter": "7", "section": "15", "changeType": "new", "description": "Market surveillance provisions", "newText": "Bestämmelser om marknadskontroll finns i..." },
  { "chapter": "7", "section": "16", "changeType": "new", "description": "Authority powers", "newText": "Vid marknadskontroll enligt förordning..." },
  { "chapter": "7", "section": "17", "changeType": "new", "description": "Injunctions", "newText": "..." },
  { "chapter": "7", "section": "18", "changeType": "new", "description": "Penalty fees", "newText": "..." },
  { "chapter": "7", "section": "19", "changeType": "new", "description": "Police assistance", "newText": "..." },
  { "chapter": "7", "section": "20", "changeType": "new", "description": "Confidentiality", "newText": "..." },
  { "chapter": "9", "section": "2", "changeType": "amended", "description": "Appeal procedures modified" },
  { "chapter": "9", "section": "5", "changeType": "amended", "description": "Immediate effect extended" }
]
```

## Version Reconstruction Algorithm

### Getting "Law as of Date X"

```typescript
async function getLawVersionAtDate(
  baseLawSfs: string,  // "1977:1160"
  asOfDate: Date       // The date to reconstruct
): Promise<LawVersion> {

  // 1. Get current consolidated law from Riksdagen API
  const currentLaw = await fetchCurrentLaw(baseLawSfs)

  // 2. Get all amendments AFTER asOfDate (these need to be "undone")
  const amendmentsToUndo = await db.amendmentDocument.findMany({
    where: {
      baseLawSfs,
      effectiveDate: { gt: asOfDate }
    },
    include: { sectionChanges: true },
    orderBy: { effectiveDate: 'desc' }  // Most recent first
  })

  // 3. Apply reverse changes
  let lawText = currentLaw.sections

  for (const amendment of amendmentsToUndo) {
    for (const change of amendment.sectionChanges) {
      lawText = applyReverseChange(lawText, change)
    }
  }

  return {
    baseLawSfs,
    asOfDate,
    sections: lawText,
    lastAmendment: getLastAmendmentBefore(baseLawSfs, asOfDate)
  }
}

function applyReverseChange(
  sections: Map<string, SectionContent>,
  change: SectionChange
): Map<string, SectionContent> {
  const key = `${change.chapter || ''}:${change.section}`

  switch (change.changeType) {
    case 'new':
      // Section was added - remove it
      sections.delete(key)
      break

    case 'repealed':
      // Section was removed - restore it (need oldText)
      if (change.oldText) {
        sections.set(key, { text: change.oldText })
      }
      break

    case 'amended':
      // Section was changed - restore old version
      if (change.oldText) {
        sections.set(key, { text: change.oldText })
      }
      break

    case 'renumbered':
      // Section was renumbered - reverse the renumbering
      const content = sections.get(key)
      if (content && change.oldNumber) {
        sections.delete(key)
        sections.set(`${change.chapter || ''}:${change.oldNumber}`, content)
      }
      break
  }

  return sections
}
```

### Getting Amendment History for a Section

```typescript
async function getSectionHistory(
  baseLawSfs: string,
  chapter: string | null,
  section: string
): Promise<SectionHistory[]> {

  const changes = await db.sectionChange.findMany({
    where: {
      amendment: { baseLawSfs },
      chapter,
      section
    },
    include: { amendment: true },
    orderBy: { amendment: { effectiveDate: 'desc' } }
  })

  return changes.map(change => ({
    date: change.amendment.effectiveDate,
    amendmentSfs: change.amendment.sfsNumber,
    changeType: change.changeType,
    description: change.description,
    oldText: change.oldText,
    newText: change.newText
  }))
}
```

## Example: Reconstructing arbetsmiljölagen History

```
Current (2024-12-11):
  - 1 kap. 2 § [text from 2022:1109]
  - 7 kap. 15-20 §§ [added by 2022:1109]
  - 8 kap. 4 § [REPEALED by 2024:804]

As of 2024-11-07 (before 2024:804):
  - UNDO 2024:804 → restore 8 kap. 4 §
  - 8 kap. 4 § [text from 2013:610]

As of 2022-07-24 (before 2022:1109):
  - UNDO 2022:1109 → remove 7 kap. 15-20 §§
  - UNDO 2022:1109 → restore old 1 kap. 2 §
  - 7 kap. 15-20 §§ [DO NOT EXIST]
  - 1 kap. 2 § [text from 2018:126]

As of 2019-11-14 (before 2019:614):
  - UNDO all subsequent amendments
  - 2 kap. 8 § [text from before 2019:614]
```

## Diff Generation

To show what changed between versions:

```typescript
async function generateDiff(
  baseLawSfs: string,
  fromDate: Date,
  toDate: Date
): Promise<Diff[]> {

  const fromVersion = await getLawVersionAtDate(baseLawSfs, fromDate)
  const toVersion = await getLawVersionAtDate(baseLawSfs, toDate)

  const diffs: Diff[] = []

  // Find added sections
  for (const [key, content] of toVersion.sections) {
    if (!fromVersion.sections.has(key)) {
      diffs.push({ type: 'added', section: key, newText: content.text })
    }
  }

  // Find removed sections
  for (const [key, content] of fromVersion.sections) {
    if (!toVersion.sections.has(key)) {
      diffs.push({ type: 'removed', section: key, oldText: content.text })
    }
  }

  // Find changed sections
  for (const [key, toContent] of toVersion.sections) {
    const fromContent = fromVersion.sections.get(key)
    if (fromContent && fromContent.text !== toContent.text) {
      diffs.push({
        type: 'changed',
        section: key,
        oldText: fromContent.text,
        newText: toContent.text
      })
    }
  }

  return diffs
}
```

## Challenge: Getting Old Text

The main challenge is getting the **old text** before an amendment. Options:

### Option A: Extract from Amendment PDF
Some amendment PDFs include the old text inline (less common)

### Option B: Chain of Amendments
Work backwards: the "newText" of the previous amendment IS the "oldText" of the next amendment

### Option C: SE-Lex Git History
The SE-Lex project has Git commits for each amendment - we can reference their diffs

### Option D: Historical Snapshots
Periodically snapshot full law texts from Riksdagen API (expensive storage but reliable)

## Recommended Approach

1. **Store section changes** with `newText` extracted from each amendment PDF
2. **Build the chain**: Each amendment's `newText` becomes the next amendment's implicit `oldText`
3. **For base text**: Store the original law text (from oldest available source)
4. **Reconstruct on-demand**: Apply/reverse changes to generate any historical version

This gives us:
- Efficient storage (only store diffs)
- Full history reconstruction
- Accurate version comparison
- Search across all versions

---

## Future: RAG Optimization

> **Note:** RAG chunking and embedding generation is deferred to a separate story after amendment backfill is complete. The data model above provides the foundation - amendments with normalized section changes can be chunked and embedded later.

Key considerations for future RAG work:
- Chunk by section change for granular retrieval
- Include temporal context (when changes took effect)
- "Why" context (EU directives, propositions) requires external data sources beyond the amendment PDFs themselves
