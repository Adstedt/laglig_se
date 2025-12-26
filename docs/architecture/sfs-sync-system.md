# SFS Sync System Architecture

> **Related Stories:** 2.28 (Unified SFS PDF Sync & Document Classification)
> **Last Updated:** 2025-12-26

## Overview

The SFS Sync System maintains synchronization between external Swedish legal data sources (Riksdagen API, svenskforfattningssamling.se) and our internal database. It handles:

- Detection of new and updated SFS documents
- PDF fetching and storage
- Document classification (lag/förordning)
- Amendment extraction and LLM parsing
- Retry mechanisms for failed operations

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────┐              ┌────────────────────────────────┐      │
│   │   Riksdagen API      │              │  svenskforfattningssamling.se  │      │
│   │   data.riksdagen.se  │              │                                │      │
│   ├──────────────────────┤              ├────────────────────────────────┤      │
│   │ • Document metadata  │              │ • PDF files                    │      │
│   │ • Full text (HTML)   │              │ • Amendment documents          │      │
│   │ • systemdatum        │              │                                │      │
│   │ • undertitel         │              │                                │      │
│   └──────────┬───────────┘              └───────────────┬────────────────┘      │
│              │                                          │                        │
└──────────────┼──────────────────────────────────────────┼────────────────────────┘
               │                                          │
               ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL CRON JOBS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │   sync-sfs          │  │  sync-sfs-updates   │  │  retry-failed-pdfs      │  │
│  │   Daily 4:00 AM     │  │  Daily 4:30 AM      │  │  Weekly Sunday 6:00 AM  │  │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────────┤  │
│  │ NEW documents       │  │ UPDATED documents   │  │ Failed PDF retries      │  │
│  │ (first-time sync)   │  │ (amendment detect)  │  │                         │  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └───────────┬─────────────┘  │
│             │                        │                         │                 │
└─────────────┼────────────────────────┼─────────────────────────┼─────────────────┘
              │                        │                         │
              ▼                        ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA STORAGE LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │      PostgreSQL (Prisma)     │    │       Supabase Storage               │   │
│  ├──────────────────────────────┤    ├──────────────────────────────────────┤   │
│  │ • LegalDocument              │    │  sfs-pdfs/                           │   │
│  │ • DocumentVersion            │    │  ├── 2024/                           │   │
│  │ • AmendmentDocument          │    │  │   ├── SFS2024-1087.pdf            │   │
│  │ • SectionChange              │    │  │   └── ...                         │   │
│  │ • ChangeDetection            │    │  └── 2025/                           │   │
│  └──────────────────────────────┘    │      ├── SFS2025-1581.pdf            │   │
│                                      │      └── ...                         │   │
│                                      └──────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cron Job Schedule

```
    UTC  0:00  1:00  2:00  3:00  4:00  4:30  5:00  5:30  6:00  ...  Sunday 6:00
         │     │     │     │     │     │     │     │     │           │
    ─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴───────────┴──────────▶
                                 │     │           │                 │
                                 ▼     ▼           ▼                 ▼
                           ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
                           │  sync-sfs   │   │sync-sfs-    │   │retry-failed │
                           │  (NEW docs) │   │updates      │   │-pdfs        │
                           │             │   │(UPDATES)    │   │             │
                           │  4:00 AM    │   │ 4:30 AM     │   │ Sunday      │
                           │  daily      │   │ daily       │   │ 6:00 AM     │
                           └─────────────┘   └─────────────┘   └─────────────┘

    CET/CEST equivalents:
    sync-sfs:         5:00 AM CET / 6:00 AM CEST
    sync-sfs-updates: 5:30 AM CET / 6:30 AM CEST
    retry-failed-pdfs: 7:00 AM CET / 8:00 AM CEST (Sundays only)
```

### vercel.json Configuration

```json
{
  "crons": [
    { "path": "/api/cron/sync-sfs", "schedule": "0 4 * * *" },
    { "path": "/api/cron/sync-sfs-updates", "schedule": "30 4 * * *" },
    { "path": "/api/cron/retry-failed-pdfs", "schedule": "0 6 * * 0" }
  ]
}
```

---

## sync-sfs-updates Flow (Amendment Detection)

This is the primary cron job for detecting and processing amendments.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    sync-sfs-updates CRON JOB (Daily 4:30 AM UTC)                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. FETCH RECENTLY UPDATED DOCUMENTS                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   GET data.riksdagen.se/dokumentlista/?doktyp=sfs&sort=systemdatum&sortorder=desc│
│                                                                                  │
│   Filter: systemdatum within last 48 hours                                       │
│   Max pages: 2 (configurable)                                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │  For each document:    │
                          └───────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 │                 ▼
        ┌───────────────────┐         │      ┌───────────────────┐
        │ In our database?  │         │      │ Already up-to-date?│
        │      NO           │         │      │       YES          │
        └─────────┬─────────┘         │      └─────────┬─────────┘
                  │                   │                │
                  ▼                   │                ▼
        ┌───────────────────┐         │      ┌───────────────────┐
        │     SKIP          │         │      │      SKIP         │
        │  (handled by      │         │      │  (no changes)     │
        │   sync-sfs)       │         │      │                   │
        └───────────────────┘         │      └───────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. FETCH UPDATED CONTENT                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────┐    ┌─────────────────┐                                    │
│   │ Fetch HTML      │    │ Fetch Full Text │   ◄── Parallel requests            │
│   │ /dokument/X.html│    │ /dokument/X.text│                                    │
│   └────────┬────────┘    └────────┬────────┘                                    │
│            └──────────┬───────────┘                                              │
│                       ▼                                                          │
│              ┌─────────────────┐                                                 │
│              │ newFullText     │                                                 │
│              │ newHtml         │                                                 │
│              └─────────────────┘                                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. EXTRACT ALL AMENDMENTS FROM FULL TEXT                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   extractAllSfsReferences(fullText)                                              │
│                                                                                  │
│   Regex: /(?:Lag|Förordning)\s*\((\d{4}:\d+)\)/gi                               │
│                                                                                  │
│   Example full text:                                                             │
│   "...enligt 5 § första stycket. Lag (2025:1559).                               │
│    6 § Arbetsgivaren ska... Lag (2025:1560).                                    │
│    7 § Om en arbetstagare... Förordning (2024:500)."                            │
│                                                                                  │
│   Extracted: ["2024:500", "2025:1559", "2025:1560"]                             │
│   Filter to current year: ["2025:1559", "2025:1560"]                            │
│                                                                                  │
│   ⚠️  WHY FULL TEXT? The undertitel field only shows the LATEST amendment.      │
│      Full text extraction catches ALL amendments (100% vs 75% detection).        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4. CHECK DATABASE FOR EXISTING AMENDMENTS                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   SELECT sfs_number FROM AmendmentDocument                                       │
│   WHERE sfs_number IN ('2025:1559', '2025:1560')                                │
│                                                                                  │
│   Result: ['2025:1559']  (already processed)                                    │
│   NEW amendments = ['2025:1560']  ◄── Only process this one!                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  5. FETCH PDFs FOR NEW AMENDMENTS                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   For each new amendment (e.g., "2025:1560"):                                   │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  constructPdfUrls("2025:1560", "2025-12-23")                            │   │
│   │                                                                          │   │
│   │  HTML: svenskforfattningssamling.se/doc/20251560.html                   │   │
│   │  PDF:  svenskforfattningssamling.se/sites/default/files/sfs/            │   │
│   │        2025-12/SFS2025-1560.pdf                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ┌────────────────────┐     ┌────────────────────────────────────────────┐     │
│   │  Rate Limiter      │     │  fetchAndStorePdf()                        │     │
│   │  1 req/sec         │────▶│  • Download PDF from svenskforfattnings... │     │
│   │                    │     │  • Upload to Supabase: sfs-pdfs/2025/      │     │
│   └────────────────────┘     │    SFS2025-1560.pdf                        │     │
│                              └────────────────────────────────────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  6. DATABASE TRANSACTION                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   prisma.$transaction:                                                           │
│                                                                                  │
│   a) Archive old version → DocumentVersion                                       │
│   b) Detect changes → ChangeDetection                                            │
│   c) Create AmendmentDocument record                                             │
│   d) Update LegalDocument with new content + classification metadata             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  7. LLM PARSING (Post-Transaction)                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   For each new AmendmentDocument with parse_status=PENDING:                      │
│                                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │ Download PDF │───▶│ Extract Text │───▶│ LLM Parse    │───▶│ Create       │  │
│   │ from Supabase│    │ using unpdf  │    │ with Claude  │    │ SectionChange│  │
│   └──────────────┘    └──────────────┘    └──────────────┘    │ records      │  │
│                                                               └──────────────┘  │
│                                                                                  │
│   ⚠️  LLM parsing runs OUTSIDE the main transaction for timeout safety.         │
│      Expected volume: 1-5 amendments/day.                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  8. NOTIFICATIONS & CACHE                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   • Invalidate Redis caches (if documents updated)                              │
│   • Send email notification with stats                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Amendment Detection: Full Text vs Undertitel

Understanding why full text extraction is necessary:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│            WHY FULL TEXT EXTRACTION IS NEEDED (100% vs 75%)                     │
└─────────────────────────────────────────────────────────────────────────────────┘

SCENARIO: Högskoleförordningen (1993:100) amended TWICE on same day

┌─────────────────────────────────────────────────────────────────────────────────┐
│  RIKSDAGEN API RESPONSE for base law 1993:100                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   {                                                                              │
│     "beteckning": "1993:100",                                                   │
│     "undertitel": "Ändrad: t.o.m. SFS 2025:1560",  ◄── ONLY shows LATEST!      │
│     "systemdatum": "2025-12-23 08:15:00"                                        │
│   }                                                                              │
│                                                                                  │
│   The undertitel ONLY shows 2025:1560                                           │
│   It does NOT show 2025:1559 which was also published same day!                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
               ┌───────────────────────┴───────────────────────┐
               │                                               │
               ▼                                               ▼
┌──────────────────────────────────┐       ┌──────────────────────────────────┐
│     OLD METHOD: undertitel only  │       │  NEW METHOD: Full Text Extract   │
├──────────────────────────────────┤       ├──────────────────────────────────┤
│                                  │       │                                  │
│  parseUndertitel(undertitel)     │       │  extractAllSfsReferences(text)   │
│         │                        │       │         │                        │
│         ▼                        │       │         ▼                        │
│  "SFS 2025:1560"                 │       │  Full text contains:             │
│                                  │       │                                  │
│  RESULT: Only 1 amendment        │       │  "5 kap. 12 § ... Lag (2025:1559)│
│          detected                │       │   6 kap. 3 § ... Lag (2025:1560)"│
│                                  │       │                                  │
│  ❌ MISSED: 2025:1559            │       │  RESULT: ["2025:1559","2025:1560"]│
│                                  │       │                                  │
│  Detection rate: 75%             │       │  ✅ BOTH amendments detected!    │
│                                  │       │  Detection rate: 100%            │
└──────────────────────────────────┘       └──────────────────────────────────┘
```

---

## Database Schema (Sync-Related Tables)

```
┌─────────────────────────────────┐
│         LegalDocument           │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ document_number: "SFS 1993:100" │
│ title: TEXT                     │
│ full_text: TEXT                 │
│ html_content: TEXT              │
│ content_type: SFS_LAW           │
│ publication_date: DATE          │
│ updated_at: TIMESTAMP           │
│                                 │
│ metadata: JSONB                 │
│ ├─ dokId: string               │
│ ├─ systemdatum: string         │
│ ├─ latestAmendment: string     │
│ ├─ lawType: "lag"|"förordning" │
│ ├─ documentCategory: string    │
│ └─ pdf: PdfMetadata | null     │
└───────────────┬─────────────────┘
                │ 1:N
                ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       DocumentVersion           │       │       AmendmentDocument          │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ id: UUID (PK)                   │       │ id: UUID (PK)                   │
│ document_id: UUID (FK)          │       │ sfs_number: "2025:1560"         │
│ version_date: TIMESTAMP         │       │ storage_path: "2025/SFS..."     │
│ full_text: TEXT                 │       │ original_url: string            │
│ amendment_sfs: string           │       │ file_size: INT                  │
└─────────────────────────────────┘       │ base_law_sfs: "1993:100"        │
                                          │ base_law_name: string           │
                                          │ title: string                   │
                                          │ effective_date: DATE            │
                                          │ parse_status: ENUM              │
                                          │ parsed_at: TIMESTAMP            │
                                          └───────────────┬─────────────────┘
                                                          │ 1:N
                                                          ▼
                                          ┌─────────────────────────────────┐
                                          │        SectionChange            │
                                          ├─────────────────────────────────┤
                                          │ id: UUID (PK)                   │
                                          │ amendment_id: UUID (FK)         │
                                          │ chapter: string                 │
                                          │ section: string                 │
                                          │ change_type: ENUM               │
                                          │ description: TEXT               │
                                          │ new_text: TEXT                  │
                                          │ sort_order: INT                 │
                                          └─────────────────────────────────┘
```

---

## Retry Mechanism

Failed PDF fetches are retried weekly:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               retry-failed-pdfs CRON JOB (Weekly Sunday 6:00 AM)                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. QUERY FAILED PDFs                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   SELECT * FROM LegalDocument                                                    │
│   WHERE content_type = 'SFS_LAW'                                                │
│     AND metadata->'pdf'->>'error' IS NOT NULL                                   │
│   ORDER BY updated_at ASC                                                        │
│   LIMIT 50                                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. RETRY EACH FAILED PDF                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   For each document:                                                             │
│   • Call fetchAndStorePdf(sfsNumber, publicationDate)                           │
│   • On success: Clear error field in metadata                                    │
│   • On failure: Update error message with new timestamp                          │
│   • Rate limit: 1.5 second delay between retries                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Source Files

| File                                      | Purpose                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `app/api/cron/sync-sfs/route.ts`          | New document sync (first-time ingestion)          |
| `app/api/cron/sync-sfs-updates/route.ts`  | Update detection + amendment processing           |
| `app/api/cron/retry-failed-pdfs/route.ts` | Weekly retry for failed PDFs                      |
| `lib/sfs/classify.ts`                     | Document classification (lag/förordning)          |
| `lib/sfs/pdf-urls.ts`                     | URL construction for svenskforfattningssamling.se |
| `lib/sfs/pdf-fetcher.ts`                  | PDF download + Supabase upload with rate limiting |
| `lib/sync/section-parser.ts`              | Full text amendment extraction                    |
| `lib/external/llm-amendment-parser.ts`    | Claude-based section change parsing               |

---

## Configuration

### Environment Variables

```env
CRON_SECRET=xxx           # Authorization for cron endpoints
SUPABASE_URL=xxx          # Supabase project URL
SUPABASE_SERVICE_KEY=xxx  # Service key for storage access
ANTHROPIC_API_KEY=xxx     # For LLM amendment parsing
```

### Rate Limiting

| Service                      | Rate Limit   | Implementation                      |
| ---------------------------- | ------------ | ----------------------------------- |
| Riksdagen API                | 100ms delay  | `CONFIG.DELAY_MS` in route          |
| svenskforfattningssamling.se | 1000ms delay | `PDF_FETCH_DELAY_MS` in pdf-fetcher |
| Retry job                    | 1500ms delay | `CONFIG.DELAY_MS` in retry route    |

---

## Monitoring & Observability

### Email Notifications

After each sync run, an email is sent with:

- Documents processed/updated/failed
- PDFs fetched/stored/failed
- Amendments created/parsed
- Duration and timestamp

### Logging

All cron jobs use prefixed logging:

- `[SYNC-SFS]` - New document sync
- `[SYNC-SFS-UPDATES]` - Update sync
- `[RETRY-FAILED-PDFS]` - Retry job
- `[PDF-FETCHER]` - PDF download operations

### Stats Tracked

```typescript
interface SyncStats {
  apiCount: number // Total in Riksdagen API
  fetched: number // Checked within time window
  updated: number // Successfully updated
  skipped: number // Already up-to-date
  failed: number // Errors during processing
  pdfsFetched: number // PDF download attempts
  pdfsStored: number // Successful uploads
  pdfsFailed: number // Failed uploads
  amendmentsCreated: number // New AmendmentDocument records
  amendmentsParsed: number // Successfully LLM-parsed
}
```

---

## Validation

The amendment detection was validated on real data:

| Detection Method     | Coverage         | Notes                         |
| -------------------- | ---------------- | ----------------------------- |
| Undertitel only      | 75% (15/20)      | Only catches latest amendment |
| Full text extraction | **100%** (20/20) | Catches all amendments        |

Test data: December 17 and 23, 2025 amendments from svenskforfattningssamling.se.
