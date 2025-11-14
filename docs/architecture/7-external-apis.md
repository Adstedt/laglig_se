# 7. External APIs

## 7.1 External API Strategy Overview

Laglig.se integrates with 6 critical external APIs to provide comprehensive legal compliance coverage. Our strategy emphasizes:

1. **Resilience** - Graceful degradation when APIs are unavailable
2. **Performance** - Aggressive caching to minimize API calls
3. **Compliance** - Respect rate limits and terms of service
4. **Cost Control** - Monitor and optimize API usage costs
5. **Data Freshness** - Balance between real-time data and cached results

**API Priority Tiers:**

- **Tier 1 (MVP Critical):** Riksdagen, Domstolsverket - Core legal content
- **Tier 2 (MVP Important):** Bolagsverket, Stripe - Business operations
- **Tier 3 (Post-MVP):** Fortnox, EUR-Lex - Enhancement features

---

## 7.2 Riksdagen API Integration

**Purpose:** Primary source for Swedish legislation (SFS laws)

**Production Endpoints:**

- List endpoint: `https://data.riksdagen.se/dokumentlista/`
- Document endpoint: `https://data.riksdagen.se/dokument/{dok_id}`
- Full text: `https://data.riksdagen.se/dokument/{dok_id}.html`

**Key Implementation Details:**

### Data Volume & Ingestion Strategy

```typescript
// Initial full ingestion: 11,351 SFS laws (1968-present)
// Daily incremental updates: ~5-20 new/amended laws

interface IngestionStrategy {
  initialLoad: {
    totalDocuments: 11351
    batchSize: 50
    estimatedTime: '48 hours'
    parallelWorkers: 3
  }
  incremental: {
    schedule: '0 2 * * *' // 2 AM daily
    lookbackDays: 7 // Check last week for safety
    estimatedDocuments: 20
  }
}
```

### Rate Limiting Implementation

```typescript
class RiksdagenRateLimiter {
  private readonly MAX_REQUESTS_PER_SECOND = 5
  private readonly MAX_REQUESTS_PER_MINUTE = 100
  private requestQueue: Array<() => Promise<any>> = []
  private processing = false

  async execute<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    this.processing = true

    while (this.requestQueue.length > 0) {
      const batch = this.requestQueue.splice(0, this.MAX_REQUESTS_PER_SECOND)

      await Promise.all(batch.map((request) => request()))

      if (this.requestQueue.length > 0) {
        await this.delay(1000) // Wait 1 second between batches
      }
    }

    this.processing = false
  }
}
```

### Error Handling & Retry Strategy

```typescript
interface RetryConfig {
  maxAttempts: 3
  backoffMultiplier: 2
  initialDelay: 1000
  maxDelay: 30000
  retryableErrors: [429, 500, 502, 503, 504]
}

async function fetchWithRetry(
  url: string,
  config: RetryConfig
): Promise<Response> {
  let lastError: Error

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const response = await fetch(url)

      if (!config.retryableErrors.includes(response.status)) {
        return response
      }

      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error as Error
    }

    if (attempt < config.maxAttempts) {
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}
```

### Data Processing Pipeline

```typescript
interface SFSProcessingPipeline {
  stages: [
    'fetch_metadata', // Get document list
    'fetch_full_text', // Get HTML content
    'parse_structure', // Extract sections, paragraphs
    'detect_status', // Active, Repealed, Amended
    'extract_dates', // Effective date, publication date
    'generate_embeddings', // Create vector embeddings
    'store_database', // Save to PostgreSQL
    'invalidate_cache', // Clear relevant caches
  ]
}

async function processSFSDocument(dokId: string): Promise<void> {
  // Stage 1: Fetch metadata
  const metadata = await riksdagenClient.fetchMetadata(dokId)

  // Stage 2: Fetch full text
  const fullText = await riksdagenClient.fetchFullText(dokId)

  // Stage 3: Parse structure
  const parsed = parseSFSStructure(fullText)

  // Stage 4: Detect status (REPEALED detection from our analysis)
  const status = detectLawStatus(parsed, metadata)

  // Stage 5: Extract dates
  const dates = extractEffectiveDates(parsed)

  // Stage 6: Generate embeddings (chunked for long documents)
  const chunks = chunkDocument(parsed, { maxTokens: 500 })
  const embeddings = await generateEmbeddings(chunks)

  // Stage 7: Store in database
  await prisma.legalDocument.upsert({
    where: { document_number: `SFS ${metadata.beteckning}` },
    create: {
      document_number: `SFS ${metadata.beteckning}`,
      title: metadata.titel,
      content_type: 'SFS_LAW',
      full_text: fullText,
      metadata: metadata,
      status: status,
      effective_date: dates.effective,
      published_date: dates.published,
    },
    update: {
      full_text: fullText,
      metadata: metadata,
      status: status,
      updated_at: new Date(),
    },
  })

  // Stage 8: Invalidate caches
  await redis.del(`law:${dokId}`)
  await redis.del(`law-list:*`) // Invalidate list caches
}
```

### Monitoring & Alerting

```typescript
interface RiksdagenMonitoring {
  metrics: {
    apiCallsPerDay: number
    averageResponseTime: number
    errorRate: number
    documentsIngested: number
  }
  alerts: {
    highErrorRate: 'Alert if error rate > 5%'
    slowResponse: 'Alert if avg response > 2000ms'
    noNewDocuments: 'Alert if no new docs for 7 days'
  }
}
```

---

## 7.3 Domstolsverket PUH API Integration

**Purpose:** Court cases from Swedish courts (AD, HD, HFD, HovR)

**Production Endpoint:**

- Search: `https://puh.domstol.se/api/search`
- Details: `https://puh.domstol.se/api/case/{id}`

**Key Implementation Details:**

### Court Priority Strategy (Competitive Advantage)

```typescript
interface CourtPriority {
  1: 'AD' // Arbetsdomstolen - Notisum's BROKEN, our advantage
  2: 'HFD' // Högsta förvaltningsdomstolen
  3: 'HD' // Högsta domstolen
  4: 'HovR' // Hovrätterna
}

// AD-specific handling (Story 2.3)
async function ingestADCases(): Promise<void> {
  const adCases = await domstolsverketClient.searchCases({
    court: 'Arbetsdomstolen',
    fromDate: '2020-01-01',
  })

  // Special processing for AD cases
  for (const adCase of adCases) {
    // Extract employment law insights
    const insights = await extractEmploymentLawInsights(adCase)

    // Link to relevant SFS laws (LAS, Diskrimineringslagen, etc.)
    const relatedLaws = await findRelatedEmploymentLaws(adCase)

    await storeCourtCase(adCase, insights, relatedLaws)
  }
}
```

### Search Strategy & Pagination

```typescript
interface DomstolsverketSearchStrategy {
  batchSize: 100
  maxResultsPerQuery: 10000
  searchFilters: {
    courts: [
      'Arbetsdomstolen',
      'Högsta domstolen',
      'Högsta förvaltningsdomstolen',
    ]
    dateRange: 'last_5_years'
    documentTypes: ['Dom', 'Beslut']
  }
}

async function* searchCourtCases(
  filter: SearchFilter
): AsyncGenerator<CourtCase[]> {
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const response = await domstolsverketClient.search({
      ...filter,
      limit: 100,
      offset: offset,
    })

    yield response.results

    offset += response.results.length
    hasMore = response.hasMore && offset < 10000
  }
}
```

---

## 7.4 Bolagsverket API Integration

**Purpose:** Company information for onboarding personalization

**Endpoint:** Internal API (requires agreement)

**Implementation:**

```typescript
interface BolagsverketClient {
  async fetchCompanyInfo(orgNumber: string): Promise<CompanyInfo> {
    // Validate org number format
    if (!isValidOrgNumber(orgNumber)) {
      throw new Error('Invalid organization number format')
    }

    // Check cache first
    const cached = await redis.get(`company:${orgNumber}`)
    if (cached) return JSON.parse(cached)

    // Fetch from Bolagsverket
    const response = await fetch(`${BOLAGSVERKET_API}/company/${orgNumber}`, {
      headers: {
        'Authorization': `Bearer ${process.env.BOLAGSVERKET_API_KEY}`,
      },
    })

    if (response.status === 404) {
      throw new Error('Company not found')
    }

    const data = await response.json()

    // Extract relevant fields
    const companyInfo: CompanyInfo = {
      name: data.namn,
      orgNumber: data.organisationsnummer,
      sniCode: data.sniKod,
      sniDescription: data.sniBeskrivning,
      employeeCountRange: data.antalAnstallda,
      municipality: data.kommun,
      county: data.lan,
      registrationDate: data.registreringsdatum,
      companyForm: data.bolagsform,
    }

    // Cache for 24 hours
    await redis.set(`company:${orgNumber}`, JSON.stringify(companyInfo), { ex: 86400 })

    return companyInfo
  }
}
```

**Fallback Strategy:**

```typescript
// If Bolagsverket API is unavailable, use manual input
interface ManualCompanyInput {
  name: string
  industry: string // Dropdown selection
  employeeCount: '1-9' | '10-49' | '50-249' | '250+'
  location: string
}
```

---

## 7.5 Fortnox API Integration (Post-MVP)

**Purpose:** Employee data synchronization for HR module (Post-MVP enhancement)

**OAuth 2.0 Flow:**

```typescript
class FortnoxOAuth {
  private readonly CLIENT_ID = process.env.FORTNOX_CLIENT_ID
  private readonly CLIENT_SECRET = process.env.FORTNOX_CLIENT_SECRET
  private readonly REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/fortnox/callback`

  getAuthorizationUrl(workspaceId: string): string {
    const state = generateSecureState(workspaceId)

    return (
      `https://apps.fortnox.se/oauth-v1/auth?` +
      `client_id=${this.CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}` +
      `&scope=employee:read` +
      `&state=${state}` +
      `&response_type=code`
    )
  }

  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const response = await fetch('https://apps.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.REDIRECT_URI,
      }),
    })

    return response.json()
  }
}
```

**Employee Sync Implementation:**

```typescript
interface FortnoxEmployeeSync {
  async syncEmployees(workspaceId: string): Promise<SyncResult> {
    const token = await getFortnoxToken(workspaceId)

    const response = await fetch('https://api.fortnox.se/3/employees', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    const { Employees } = await response.json()

    const syncResult = {
      created: 0,
      updated: 0,
      errors: [],
    }

    for (const employee of Employees) {
      try {
        await prisma.employee.upsert({
          where: {
            workspace_id_fortnox_id: {
              workspace_id: workspaceId,
              fortnox_id: employee.EmployeeId,
            },
          },
          create: {
            workspace_id: workspaceId,
            fortnox_id: employee.EmployeeId,
            first_name: employee.FirstName,
            last_name: employee.LastName,
            email: employee.Email,
            employment_date: employee.EmploymentDate,
            employment_type: mapEmploymentType(employee.EmploymentForm),
          },
          update: {
            first_name: employee.FirstName,
            last_name: employee.LastName,
            email: employee.Email,
          },
        })

        syncResult.created++
      } catch (error) {
        syncResult.errors.push({ employee: employee.EmployeeId, error })
      }
    }

    return syncResult
  }
}
```

---

## 7.6 Stripe API Integration

**Purpose:** Subscription billing and payment processing

**Webhook Configuration:**

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return new Response('Webhook signature verification failed', {
      status: 400,
    })
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionCancellation(event.data.object)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return new Response('Webhook processed', { status: 200 })
}
```

**Subscription Tiers Implementation:**

```typescript
interface SubscriptionTiers {
  SOLO: {
    priceId: process.env.STRIPE_PRICE_SOLO
    limits: {
      users: 1
      employees: 10
      aiQueries: 100
      storageGB: 1
    }
  }
  TEAM: {
    priceId: process.env.STRIPE_PRICE_TEAM
    limits: {
      users: 5
      employees: 50
      aiQueries: 500
      storageGB: 10
    }
  }
  ENTERPRISE: {
    priceId: process.env.STRIPE_PRICE_ENTERPRISE
    limits: {
      users: -1 // Unlimited
      employees: -1
      aiQueries: -1
      storageGB: 100
    }
  }
}

async function enforceUsageLimits(workspaceId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      subscription: true,
      _count: {
        select: {
          users: true,
          employees: true,
        },
      },
    },
  })

  const tier = workspace.subscription.tier
  const limits = SubscriptionTiers[tier].limits

  if (limits.users > 0 && workspace._count.users > limits.users) {
    throw new Error('User limit exceeded. Please upgrade your subscription.')
  }

  if (limits.employees > 0 && workspace._count.employees > limits.employees) {
    throw new Error(
      'Employee limit exceeded. Please upgrade your subscription.'
    )
  }
}
```

---

## 7.7 EUR-Lex CELLAR API Integration

**Purpose:** EU regulations and directives (future enhancement)

**SPARQL Query Implementation:**

```typescript
interface EurLexClient {
  async searchRegulations(query: string): Promise<EUDocument[]> {
    const sparqlQuery = `
      PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

      SELECT ?cellarId ?title ?docNumber ?adoptionDate
      WHERE {
        ?work cdm:resource_legal_id_celex ?cellarId .
        ?work cdm:resource_legal_type <http://publications.europa.eu/resource/authority/resource-type/REG> .
        ?work cdm:resource_legal_date_adoption ?adoptionDate .
        ?work cdm:resource_legal_id_natural ?docNumber .
        ?work cdm:work_has_expression ?expr .
        ?expr cdm:expression_language <http://publications.europa.eu/resource/authority/language/SWE> .
        ?expr cdm:expression_title ?title .

        FILTER(CONTAINS(LCASE(?title), "${query.toLowerCase()}"))
        FILTER(?adoptionDate >= "2020-01-01"^^xsd:date)
      }
      ORDER BY DESC(?adoptionDate)
      LIMIT 100
    `

    const response = await fetch('https://publications.europa.eu/webapi/rdf/sparql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/json',
      },
      body: sparqlQuery,
    })

    const data = await response.json()
    return parseEurLexResults(data)
  }
}
```

---

## 7.8 API Cost Management

**Cost Tracking Implementation:**

```typescript
interface APICostTracking {
  costs: {
    openai: {
      embedding: 0.00002, // per 1k tokens
      gpt4: 0.03, // per 1k tokens
      totalBudget: 1000, // USD per month
    },
    stripe: {
      transaction: 0.029, // 2.9% + $0.30
    },
  },

  async trackAPICall(service: string, tokens?: number): Promise<void> {
    await prisma.apiUsage.create({
      data: {
        service,
        tokens,
        cost: calculateCost(service, tokens),
        timestamp: new Date(),
      },
    })
  },

  async getMonthlyUsage(service: string): Promise<number> {
    const usage = await prisma.apiUsage.aggregate({
      where: {
        service,
        timestamp: {
          gte: startOfMonth(new Date()),
        },
      },
      _sum: {
        cost: true,
      },
    })

    return usage._sum.cost || 0
  },
}
```

---

## 7.9 API Health Monitoring

**Health Check System:**

```typescript
interface APIHealthCheck {
  services: {
    riksdagen: 'https://data.riksdagen.se/dokumentlista/?utformat=json&limit=1',
    domstolsverket: 'https://puh.domstol.se/api/health',
    bolagsverket: 'internal',
    fortnox: 'https://api.fortnox.se/3/health',
    stripe: 'webhook_ping',
    eurlex: 'https://publications.europa.eu/webapi/rdf/sparql',
  },

  async checkHealth(): Promise<HealthStatus[]> {
    const results: HealthStatus[] = []

    for (const [service, endpoint] of Object.entries(this.services)) {
      const start = Date.now()

      try {
        if (endpoint === 'internal') {
          // Skip internal services
          continue
        }

        const response = await fetch(endpoint, {
          signal: AbortSignal.timeout(5000),
        })

        results.push({
          service,
          status: response.ok ? 'healthy' : 'degraded',
          responseTime: Date.now() - start,
          lastChecked: new Date(),
        })
      } catch (error) {
        results.push({
          service,
          status: 'unhealthy',
          error: error.message,
          lastChecked: new Date(),
        })
      }
    }

    return results
  },
}

// Run health checks every 5 minutes
setInterval(async () => {
  const healthStatus = await APIHealthCheck.checkHealth()
  await redis.set('api-health', JSON.stringify(healthStatus), { ex: 600 })

  // Alert if any service is unhealthy
  const unhealthy = healthStatus.filter(s => s.status === 'unhealthy')
  if (unhealthy.length > 0) {
    await sendAlert('API services unhealthy', unhealthy)
  }
}, 300000)
```

---

## 7.10 Data Synchronization Strategy

**Sync Scheduling:**

```typescript
interface SyncSchedule {
  riksdagen: {
    full: 'monthly' // Full re-sync monthly
    incremental: 'daily' // Check for new/updated daily
    time: '02:00'
  }
  domstolsverket: {
    full: 'weekly'
    incremental: 'daily'
    time: '03:00'
  }
  fortnox: {
    onDemand: true // User-triggered
    webhook: true // Real-time via webhooks
  }
}
```

**Conflict Resolution:**

```typescript
interface ConflictResolution {
  strategy: 'last-write-wins', // Default strategy

  async resolveConflict(local: any, remote: any): Promise<any> {
    // Compare timestamps
    if (remote.updated_at > local.updated_at) {
      return remote
    }

    // If equal, prefer remote (source of truth)
    return remote
  },
}
```

---
