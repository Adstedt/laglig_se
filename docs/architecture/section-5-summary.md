# Section 5 Summary ✅

## 5.8 External API Integration Clients

**Purpose:** TypeScript clients for integrating with external Swedish legal data sources (Riksdagen, Domstolsverket, EUR-Lex, Fortnox, Bolagsverket).

**Location:** `lib/external-apis/*.ts`

---

### 5.8.1 Riksdagen API Client

**File:** `lib/external-apis/riksdagen.ts`

**Purpose:** Fetch SFS laws from Riksdagen's Dokument API (11,351 laws from 1968-present)

```typescript
import { z } from 'zod'

// Schema validation for API responses
const RiksdagenSFSSchema = z.object({
  id: z.string(),
  dok_id: z.string(),
  beteckning: z.string(), // e.g., "2011:1029"
  titel: z.string(),
  datum: z.string(), // ISO date
  organ: z.string(), // Ministry
  undertitel: z.string().optional(), // "t.o.m. SFS 2023:253"
  dokument_url_html: z.string(),
  dokument_url_text: z.string(),
  summary: z.string().optional(),
  rm: z.string(), // Year
  publicerad: z.string(), // ISO datetime
})

export type RiksdagenSFS = z.infer<typeof RiksdagenSFSSchema>

export class RiksdagenClient {
  private baseURL = 'https://data.riksdagen.se'
  private requestsPerSecond = 5 // Conservative rate limit

  /**
   * Fetch paginated list of SFS documents
   * @param page - Page number (1-indexed)
   * @param pageSize - Results per page (max 100)
   */
  async fetchSFSList(
    page: number = 1,
    pageSize: number = 100
  ): Promise<{
    documents: RiksdagenSFS[]
    totalPages: number
    totalDocuments: number
  }> {
    const url = `${this.baseURL}/dokumentlista/?doktyp=SFS&utformat=json&p=${page}&sz=${pageSize}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        `Riksdagen API error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    const documents = Array.isArray(data.dokumentlista.dokument)
      ? data.dokumentlista.dokument
      : [data.dokumentlista.dokument]

    // Validate each document
    const validated = documents.map((doc) => RiksdagenSFSSchema.parse(doc))

    return {
      documents: validated,
      totalPages: parseInt(data.dokumentlista['@sidor']),
      totalDocuments: parseInt(data.dokumentlista['@traffar']),
    }
  }

  /**
   * Fetch full text of a specific SFS law
   * @param id - Document ID (e.g., "sfs-2011-1029")
   * @param format - 'text' or 'html'
   */
  async fetchSFSFullText(
    id: string,
    format: 'text' | 'html' = 'text'
  ): Promise<string> {
    const url = `${this.baseURL}/dokument/${id}.${format}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch SFS full text: ${response.status}`)
    }

    return await response.text()
  }

  /**
   * Fetch JSON metadata for a specific SFS law
   * @param id - Document ID
   */
  async fetchSFSMetadata(id: string): Promise<RiksdagenSFS> {
    const url = `${this.baseURL}/dokument/${id}.json`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch SFS metadata: ${response.status}`)
    }

    const data = await response.json()
    return RiksdagenSFSSchema.parse(data.dokument)
  }

  /**
   * Batch fetch all SFS laws with rate limiting
   */
  async *fetchAllSFS(): AsyncGenerator<RiksdagenSFS[], void, void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await this.fetchSFSList(page, 100)

      yield result.documents

      hasMore = page < result.totalPages
      page++

      // Rate limiting: wait 200ms between requests (5 req/sec)
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }
  }
}

// Singleton instance
export const riksdagenClient = new RiksdagenClient()
```

**Usage in ingestion script:**

```typescript
// scripts/ingest-sfs.ts

import { riksdagenClient } from '@/lib/external-apis/riksdagen'
import { prisma } from '@/lib/prisma'

export async function ingestAllSFS() {
  let processed = 0

  for await (const batch of riksdagenClient.fetchAllSFS()) {
    for (const sfs of batch) {
      // Fetch full text
      const fullText = await riksdagenClient.fetchSFSFullText(sfs.id, 'text')

      // Store in database
      await prisma.legalDocument.upsert({
        where: { document_number: `SFS ${sfs.beteckning}` },
        create: {
          content_type: 'SFS_LAW',
          document_number: `SFS ${sfs.beteckning}`,
          title: sfs.titel,
          full_text: fullText,
          effective_date: new Date(sfs.datum),
          publication_date: new Date(sfs.publicerad),
          status: 'ACTIVE',
          source_url: `https://data.riksdagen.se/dokument/${sfs.id}.html`,
          metadata: {
            riksdagen_id: sfs.id,
            organ: sfs.organ,
            latest_amendment: sfs.undertitel,
          },
        },
        update: {
          full_text: fullText,
          updated_at: new Date(),
        },
      })

      processed++
      console.log(`Processed ${processed}/11351 SFS laws`)
    }
  }

  return processed
}
```

---

### 5.8.2 Domstolsverket PUH API Client

**File:** `lib/external-apis/domstolsverket.ts`

**Purpose:** Fetch court cases from Domstolsverket PUH API (AD, HFD, HD, HovR)

```typescript
import { z } from 'zod'

// Schema validation
const LagrumDTOSchema = z.object({
  sfsNummer: z.string(), // "SFS 1977:1160"
  referens: z.string().optional(), // "3 kap. 2 §"
})

const DomstolDTOSchema = z.object({
  domstolKod: z.string(), // "HD", "HovR-Stockholm"
  domstolNamn: z.string(), // "Högsta domstolen"
})

const PubliceringDTOSchema = z.object({
  id: z.string().uuid(),
  gruppKorrelationsnummer: z.string(),
  ecliNummer: z.string().optional(),
  domstol: DomstolDTOSchema,
  typ: z.string(), // "Dom", "Beslut"
  malNummerLista: z.array(z.string()),
  avgorandedatum: z.string(), // ISO date
  publiceringstid: z.string(), // ISO datetime
  sammanfattning: z.string().optional(),
  innehall: z.string().optional(), // HTML full text
  benamning: z.string().optional(),
  arVagledande: z.boolean(),
  referatNummerLista: z.array(z.string()), // ["NJA 2023 s. 456"]
  arbetsdomstolenDomsnummer: z.string().optional(),
  lagrumLista: z.array(LagrumDTOSchema),
  nyckelordLista: z.array(z.string()),
  rattsomradeLista: z.array(z.string()),
})

export type PubliceringDTO = z.infer<typeof PubliceringDTOSchema>

export class DomstolsverketClient {
  private baseURL = 'https://api.domstol.se/puh/v1' // Production URL (TBD - verify with Domstolsverket)
  private requestsPerSecond = 5

  /**
   * Fetch court cases by court code with pagination
   * @param courtCode - "AD", "HD", "HFD", "HovR-Stockholm", etc.
   * @param page - Page number (0-indexed)
   * @param pageSize - Results per page
   */
  async fetchCasesByCourt(
    courtCode: string,
    page: number = 0,
    pageSize: number = 100
  ): Promise<{
    cases: PubliceringDTO[]
    hasMore: boolean
  }> {
    const url = `${this.baseURL}/publiceringar?domstolkod=${courtCode}&page=${page}&pagesize=${pageSize}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Domstolsverket API error: ${response.status}`)
    }

    const data = await response.json()

    // Validate
    const cases = data.map((c: any) => PubliceringDTOSchema.parse(c))

    return {
      cases,
      hasMore: cases.length === pageSize,
    }
  }

  /**
   * Advanced search with filters
   */
  async searchCases(filters: {
    domstolKodLista?: string[]
    sfsNummerLista?: string[]
    arVagledande?: boolean
    fromDatum?: string
    toDatum?: string
    sidIndex?: number
    antalPerSida?: number
  }): Promise<{
    total: number
    cases: PubliceringDTO[]
  }> {
    const url = `${this.baseURL}/sok`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sidIndex: filters.sidIndex || 0,
        antalPerSida: filters.antalPerSida || 100,
        sortorder: 'avgorandedatum',
        asc: false,
        filter: {
          domstolKodLista: filters.domstolKodLista,
          sfsNummerLista: filters.sfsNummerLista,
          arVagledande: filters.arVagledande,
          intervall: filters.fromDatum
            ? {
                fromDatum: filters.fromDatum,
                toDatum:
                  filters.toDatum || new Date().toISOString().split('T')[0],
              }
            : undefined,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const data = await response.json()

    return {
      total: data.total,
      cases: data.publiceringLista.map((c: any) =>
        PubliceringDTOSchema.parse(c)
      ),
    }
  }

  /**
   * Get all courts available in API
   */
  async fetchCourts(): Promise<Array<{ kod: string; namn: string }>> {
    const url = `${this.baseURL}/domstolar`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch courts: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * Batch fetch cases from priority courts (AD → HFD → HD → HovR)
   */
  async *fetchAllCasesByPriority(): AsyncGenerator<{
    court: string
    cases: PubliceringDTO[]
  }> {
    const priorityCourts = [
      'AD',
      'HFD',
      'HD',
      'HovR-Stockholm',
      'HovR-Göteborg',
    ]

    for (const courtCode of priorityCourts) {
      let page = 0
      let hasMore = true

      while (hasMore) {
        const result = await this.fetchCasesByCourt(courtCode, page, 100)

        yield {
          court: courtCode,
          cases: result.cases,
        }

        hasMore = result.hasMore
        page++

        // Rate limiting
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
    }
  }
}

// Singleton instance
export const domstolsverketClient = new DomstolsverketClient()
```

**Usage in ingestion script:**

```typescript
// scripts/ingest-court-cases.ts

import { domstolsverketClient } from '@/lib/external-apis/domstolsverket'
import { prisma } from '@/lib/prisma'

function mapCourtCodeToContentType(courtCode: string): ContentType {
  if (courtCode === 'AD') return 'AD_LABOUR_COURT'
  if (courtCode === 'HFD') return 'HFD_ADMIN_SUPREME'
  if (courtCode === 'HD') return 'HD_SUPREME_COURT'
  if (courtCode.startsWith('HovR')) return 'HOVR_COURT_APPEAL'
  return 'HD_SUPREME_COURT' // Fallback
}

export async function ingestAllCourtCases() {
  let processed = 0

  for await (const {
    court,
    cases,
  } of domstolsverketClient.fetchAllCasesByPriority()) {
    for (const courtCase of cases) {
      const contentType = mapCourtCodeToContentType(
        courtCase.domstol.domstolKod
      )

      // Create legal document
      const doc = await prisma.legalDocument.create({
        data: {
          content_type: contentType,
          document_number: courtCase.referatNummerLista[0] || courtCase.id,
          title:
            courtCase.benamning ||
            `${courtCase.domstol.domstolNamn} ${courtCase.avgorandedatum}`,
          summary: courtCase.sammanfattning,
          full_text: courtCase.innehall ? stripHTML(courtCase.innehall) : '',
          publication_date: new Date(courtCase.publiceringstid),
          effective_date: new Date(courtCase.avgorandedatum),
          status: 'ACTIVE',
          source_url: `https://www.domstol.se/publiceringar/${courtCase.id}`,
          metadata: {
            ecli: courtCase.ecliNummer,
            is_guiding: courtCase.arVagledande,
            case_numbers: courtCase.malNummerLista,
            keywords: courtCase.nyckelordLista,
            legal_areas: courtCase.rattsomradeLista,
          },
        },
      })

      // Create court case record
      await prisma.courtCase.create({
        data: {
          document_id: doc.id,
          court_name: courtCase.domstol.domstolNamn,
          case_number: courtCase.malNummerLista[0],
          decision_date: new Date(courtCase.avgorandedatum),
        },
      })

      // Create cross-references to cited SFS laws
      for (const lagrum of courtCase.lagrumLista) {
        const citedLaw = await prisma.legalDocument.findUnique({
          where: { document_number: lagrum.sfsNummer },
        })

        if (citedLaw) {
          await prisma.crossReference.create({
            data: {
              source_document_id: doc.id,
              target_document_id: citedLaw.id,
              reference_type: 'CITES',
              context: lagrum.referens,
            },
          })
        }
      }

      processed++
      console.log(`[${court}] Processed ${processed} court cases`)
    }
  }

  return processed
}
```

---

### 5.8.3 Rate Limiting & Retry Strategy

**Shared utilities for all external API clients:**

```typescript
// lib/external-apis/utils.ts

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (response.ok) {
        return response
      }

      // Rate limited - exponential backoff
      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // Server error - retry
      if (response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
        continue
      }

      // Other errors - don't retry
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }

      console.warn(`Fetch failed (attempt ${attempt}/${maxRetries}):`, error)
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
    }
  }

  throw new Error('Max retries exceeded')
}

export function createRateLimiter(requestsPerSecond: number) {
  const delay = 1000 / requestsPerSecond
  let lastRequest = 0

  return async function rateLimitedFetch(url: string, options?: RequestInit) {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequest

    if (timeSinceLastRequest < delay) {
      await new Promise((resolve) =>
        setTimeout(resolve, delay - timeSinceLastRequest)
      )
    }

    lastRequest = Date.now()

    return fetchWithRetry(url, options)
  }
}
```

---

### 5.8.4 Additional External API Clients (Summary)

**Fortnox API** (`lib/external-apis/fortnox.ts`)

- OAuth 2.0 authentication
- Fetch employee data for HR module
- Sync company financial data

**Bolagsverket API** (`lib/external-apis/bolagsverket.ts`)

- Fetch company information by org number
- Used in onboarding process (Epic 4)

**EUR-Lex CELLAR API** (`lib/external-apis/eurlex.ts`)

- SPARQL queries for EU regulations/directives
- Fetch Swedish translations
- National Implementation Measures (NIM)

**Stripe API** (`lib/external-apis/stripe.ts`)

- Subscription management
- Payment processing
- Webhook handling

**See Section 7 (External APIs) for complete documentation of all external integrations.**

---

**This API specification supports:**

- ✅ All 8 PRD Epics
- ✅ Hybrid architecture (Server Actions + REST)
- ✅ Production-ready authentication
- ✅ Comprehensive rate limiting
- ✅ OpenAPI 3.0 specification
- ✅ Versioning strategy

**Next:** Section 6 - Components
