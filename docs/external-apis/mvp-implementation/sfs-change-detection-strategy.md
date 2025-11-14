# SFS Change Detection Strategy

**Date:** 2025-01-06
**Purpose:** Complete strategy for detecting law changes nightly for Epic 8 (Change Monitoring & Notification System)

---

## Executive Summary

✅ **PRIMARY METHOD: Riksdagen API `systemdatum` filtering**
✅ **SECONDARY METHOD: Lagrummet Atom feeds** (if needed)
✅ **TERTIARY METHOD: SFSR scraping** (Epic 8 enhancement - complete amendment chains)

**Nightly Cron Job:** Runs at 00:30 CET, checks previous 24 hours
**Epic 2.11:** Silent data collection starts NOW (no UI, just database)
**Epic 8:** User-facing change notifications + UI

---

## 1. Change Detection API Analysis

### Method 1: Riksdagen API - `systemdatum` Filter ✅ RECOMMENDED

**Endpoint:**

```
GET https://data.riksdagen.se/dokumentlista/?doktyp=SFS&ts={date}&utformat=json
```

**Parameters:**

- `ts={date}` - System timestamp (format: `YYYY-MM-DD`)
- Filters by `systemdatum` field (when document was published/updated in Riksdagen system)

**Test Results:**

```bash
# Query for documents published on 2025-11-04
curl "https://data.riksdagen.se/dokumentlista/?doktyp=SFS&ts=2025-11-04&utformat=json&sz=100"

# Result: 43 documents returned
# Includes BOTH:
# 1. NEW laws published on this date
# 2. AMENDED laws (consolidated versions updated on this date)
```

**Example Response:**

```json
{
  "dokumentlista": {
    "@traffar": "43",
    "dokument": [
      {
        "dok_id": "sfs-1979-377",
        "titel": "Lag (1979:377) om registrering av båtar",
        "undertitel": "t.o.m. SFS 2025:983", // ← AMENDMENT DETECTED
        "datum": "1979-05-31", // Original law date
        "publicerad": "2025-11-04 04:41:04", // Published to system
        "systemdatum": "2025-11-04 04:41:04" // System update timestamp
      },
      {
        "dok_id": "sfs-2025-970",
        "titel": "Förordning (2025:970) om återvandringsbidrag...",
        "undertitel": "", // ← NEW LAW (no amendments yet)
        "datum": "2025-10-30",
        "publicerad": "2025-11-04 04:41:46",
        "systemdatum": "2025-11-04 04:41:46"
      }
    ]
  }
}
```

**What We Can Detect:**

| Change Type      | Detection Method                          | Confidence                   |
| ---------------- | ----------------------------------------- | ---------------------------- |
| **New laws**     | `undertitel` is empty                     | ✅ 100%                      |
| **Amendments**   | `undertitel` shows "t.o.m. SFS YYYY:XXX"  | ✅ 100%                      |
| **Repeals**      | Parse HTML for "Författningen är upphävd" | ⚠️ 80% (requires HTML fetch) |
| **Text changes** | Compare `full_text` hash                  | ✅ 100%                      |

---

### Method 2: Alternative Date Range (`from` / `tom`)

**Endpoint:**

```
GET https://data.riksdagen.se/dokumentlista/?doktyp=SFS&from={start}&tom={end}&utformat=json
```

**Parameters:**

- `from={date}` - Start date (Swedish "från")
- `tom={date}` - End date (Swedish "till och med" = "up to and including")
- Filters by `datum` field (law issuance date, NOT system update date)

**Test Results:**

```bash
# Query for laws issued between Oct 1 - Nov 6, 2025
curl "https://data.riksdagen.se/dokumentlista/?doktyp=SFS&from=2025-10-01&tom=2025-11-06&utformat=json"

# Result: 14 documents (NEW laws issued in this period)
```

**Limitation:** ❌ This only finds NEW laws, NOT amendments to old laws
**Use Case:** Good for finding newly issued laws, but NOT for change detection

---

### Method 3: Lagrummet Atom Feeds 🔄 SECONDARY

**Documentation:** http://dev.lagrummet.se/dokumentation/system/atom-insamling.html

**Key Findings:**

- Lagrummet uses Atom feeds for publishing legal document changes
- Each entry has `<updated>` timestamp indicating when changed
- Provides `changedBy` field showing complete amendment chain
- Feed endpoint (estimated): `http://service.lagrummet.se/feed/current` or similar

**Status:** ⚠️ Documentation site has intermittent timeouts (94.247.169.67:443)

**Advantages:**

- ✅ Structured `changedBy` field with ALL amendments (not just latest)
- ✅ Standard Atom format (RSS-like, easy to parse)
- ✅ Designed specifically for change detection

**Disadvantages:**

- ❌ Service reliability issues
- ❌ Less documentation than Riksdagen
- ❌ Feed URL not confirmed (needs testing)

**Decision:** Use as FALLBACK if Riksdagen `systemdatum` filtering fails

---

### Method 4: SFSR Amendment Register 📜 TERTIARY

**URL:** http://rkrattsbaser.gov.se/sfsr?bet={beteckning}

**Example:**

```
http://rkrattsbaser.gov.se/sfsr?bet=2011:1029
```

**What It Provides:**

- Complete amendment history (ALL amendments, not just latest)
- Links to amending SFS laws
- Dates when each amendment took effect

**Status:** ⚠️ No API - HTML scraping required

**Use Case:** Epic 8 enhancement for showing complete amendment chains in UI

---

## 2. Recommended Change Detection Strategy

### Primary Method: Riksdagen `systemdatum` Polling

**Why Riksdagen?**

1. ✅ **Reliable:** Government-backed service, excellent uptime
2. ✅ **Simple:** Single API call with date filter
3. ✅ **Comprehensive:** Detects both new laws AND amendments
4. ✅ **Fast:** Returns only changed documents (not full 11K dataset)
5. ✅ **No authentication:** Public API

**Implementation:**

#### Nightly Cron Job (Vercel Cron)

```typescript
// api/cron/detect-sfs-changes/route.ts

export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute timeout

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    await detectSFSChanges()
    return Response.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Change detection failed:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

async function detectSFSChanges() {
  // Calculate yesterday's date (Swedish time)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0] // YYYY-MM-DD

  console.log(`[Change Detection] Checking for changes on ${dateStr}`)

  // Fetch all SFS documents updated yesterday
  const response = await fetch(
    `https://data.riksdagen.se/dokumentlista/?doktyp=SFS&ts=${dateStr}&utformat=json&sz=100`
  )

  if (!response.ok) {
    throw new Error(`Riksdagen API error: ${response.status}`)
  }

  const data = await response.json()
  const documents = Array.isArray(data.dokumentlista.dokument)
    ? data.dokumentlista.dokument
    : [data.dokumentlista.dokument]

  console.log(`[Change Detection] Found ${documents.length} changed documents`)

  // Process each changed document
  for (const doc of documents) {
    await processChangedDocument(doc, dateStr)
  }

  console.log(`[Change Detection] Completed successfully`)
}
```

#### Process Changed Document

```typescript
async function processChangedDocument(
  doc: RiksdagenSFS,
  detectionDate: string
) {
  const sfsNumber = `SFS ${doc.beteckning}` // "SFS 2011:1029"

  // Find existing law in our database
  const existingLaw = await prisma.legalDocument.findFirst({
    where: { document_number: sfsNumber },
  })

  if (!existingLaw) {
    // NEW LAW - not in our database yet
    console.log(`[Change Detection] NEW LAW: ${sfsNumber}`)

    await prisma.lawChangeHistory.create({
      data: {
        change_type: 'NEW_LAW',
        law_document_number: sfsNumber,
        detected_at: new Date(),
        metadata: {
          riksdagen_id: doc.id,
          titel: doc.titel,
          datum: doc.datum,
          publicerad: doc.publicerad,
        },
      },
    })

    // Queue for ingestion
    await ingestionQueue.add('ingest-new-sfs', { riksdagen_id: doc.id })
    return
  }

  // EXISTING LAW - check what changed
  await detectChanges(existingLaw, doc)
}
```

#### Detect Specific Changes

```typescript
async function detectChanges(existingLaw: LegalDocument, newDoc: RiksdagenSFS) {
  const changes: ChangeType[] = []

  // 1. Check for amendment (compare undertitel)
  const oldAmendment = existingLaw.metadata?.latest_amendment
  const newAmendment = extractLatestAmendment(newDoc.undertitel)

  if (oldAmendment !== newAmendment) {
    changes.push({
      type: 'AMENDMENT',
      old_value: oldAmendment,
      new_value: newAmendment,
      amending_law: newAmendment, // "SFS 2025:983"
    })
  }

  // 2. Check for text changes (compare full text)
  const newFullText = await fetchFullText(newDoc.id)
  const oldHash = hashText(existingLaw.full_text)
  const newHash = hashText(newFullText)

  if (oldHash !== newHash) {
    changes.push({
      type: 'TEXT_CHANGE',
      old_hash: oldHash,
      new_hash: newHash,
      text_diff: generateDiff(existingLaw.full_text, newFullText),
    })
  }

  // 3. Check for repeal (parse HTML)
  if (newDoc.undertitel?.includes('upphävd') || (await isRepealed(newDoc.id))) {
    changes.push({
      type: 'REPEAL',
      repealed_at: new Date(newDoc.datum),
    })
  }

  // Store all changes
  if (changes.length > 0) {
    for (const change of changes) {
      await prisma.lawChangeHistory.create({
        data: {
          document_id: existingLaw.id,
          change_type: change.type,
          detected_at: new Date(),
          metadata: change,
        },
      })
    }

    // Create change notifications for affected workspaces
    await createChangeNotifications(existingLaw, changes)

    // Update the law in our database
    await prisma.legalDocument.update({
      where: { id: existingLaw.id },
      data: {
        full_text: newFullText,
        status: changes.some((c) => c.type === 'REPEAL')
          ? 'REPEALED'
          : existingLaw.status,
        metadata: {
          ...existingLaw.metadata,
          latest_amendment: newAmendment,
        },
        updated_at: new Date(),
      },
    })
  }
}
```

#### Create Change Notifications

```typescript
async function createChangeNotifications(
  law: LegalDocument,
  changes: ChangeType[]
) {
  // Find all workspaces that have this law in their list
  const workspacesWithLaw = await prisma.lawInWorkspace.findMany({
    where: { law_id: law.id },
    include: { workspace: true },
  })

  console.log(
    `[Change Detection] Notifying ${workspacesWithLaw.length} workspaces about changes to ${law.document_number}`
  )

  for (const { workspace } of workspacesWithLaw) {
    // Determine priority based on change type
    const priority = determinePriority(changes)

    // Generate AI summary of the change
    const summary = await generateChangeSummary(law, changes)

    // Create notification record
    await prisma.changeNotification.create({
      data: {
        workspace_id: workspace.id,
        document_id: law.id,
        change_type: changes[0].type, // Primary change type
        priority,
        summary,
        acknowledged: false,
        detected_at: new Date(),
        metadata: {
          all_changes: changes,
          amending_law: changes.find((c) => c.type === 'AMENDMENT')
            ?.amending_law,
        },
      },
    })
  }
}
```

#### Helper Functions

```typescript
function extractLatestAmendment(undertitel: string | null): string | null {
  if (!undertitel) return null
  // "t.o.m. SFS 2023:253" → "SFS 2023:253"
  const match = undertitel.match(/SFS (\d{4}:\d+)/)
  return match ? `SFS ${match[1]}` : null
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function isRepealed(riksdagenId: string): Promise<boolean> {
  const html = await fetch(
    `https://data.riksdagen.se/dokument/${riksdagenId}.html`
  )
  const text = await html.text()
  return text.includes('Författningen är upphävd')
}

function determinePriority(changes: ChangeType[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (changes.some((c) => c.type === 'REPEAL')) return 'HIGH'
  if (changes.some((c) => c.type === 'AMENDMENT')) return 'MEDIUM'
  return 'LOW'
}

async function generateChangeSummary(
  law: LegalDocument,
  changes: ChangeType[]
): Promise<string> {
  const prompt = `
    Law: ${law.title} (${law.document_number})
    Changes detected: ${JSON.stringify(changes, null, 2)}

    Generate a plain Swedish summary (2-3 sentences) explaining:
    1. What changed
    2. Why it matters for businesses
    3. If action is required

    Example: "Denna ändring utökar föräldraledigheten till 18 månader.
    Företag måste uppdatera sina HR-policys senast 1 december."
  `

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}
```

---

## 3. Vercel Cron Configuration

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/detect-sfs-changes",
      "schedule": "30 0 * * *"
    }
  ]
}
```

**Schedule:** `30 0 * * *` = Every day at 00:30 CET
**Why 00:30?** Riksdagen publishes updates overnight (04:41 in our test results), so we check at 00:30 for yesterday's changes

---

## 4. Data Model

### LawChangeHistory Table

```prisma
model LawChangeHistory {
  id              String   @id @default(uuid()) @db.Uuid
  document_id     String?  @db.Uuid  // null if NEW_LAW not yet ingested
  change_type     ChangeType
  detected_at     DateTime @default(now())
  metadata        Json

  document LegalDocument? @relation(fields: [document_id], references: [id], onDelete: Cascade)

  @@index([document_id, detected_at])
  @@index([change_type, detected_at])
  @@map("law_change_history")
}

enum ChangeType {
  NEW_LAW
  AMENDMENT
  TEXT_CHANGE
  REPEAL
  METADATA_UPDATE

  @@map("change_type")
}
```

### ChangeNotification Table

```prisma
model ChangeNotification {
  id            String   @id @default(uuid()) @db.Uuid
  workspace_id  String   @db.Uuid
  document_id   String   @db.Uuid
  change_type   ChangeType
  priority      Priority
  summary       String   @db.Text
  acknowledged  Boolean  @default(false)
  acknowledged_by String? @db.Uuid
  acknowledged_at DateTime?
  detected_at   DateTime @default(now())
  metadata      Json

  workspace Workspace      @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  document  LegalDocument  @relation(fields: [document_id], references: [id], onDelete: Cascade)
  acknowledged_by_user User? @relation(fields: [acknowledged_by], references: [id])

  @@index([workspace_id, acknowledged, detected_at])
  @@index([document_id, detected_at])
  @@map("change_notifications")
}
```

---

## 5. Epic Timeline

### Epic 2.11: Silent Data Collection (MVP) ✅

**Starts NOW** (with initial ingestion)

**What Happens:**

- ✅ Nightly cron job runs
- ✅ Detects changes via Riksdagen `systemdatum`
- ✅ Stores in `LawChangeHistory` table
- ✅ Creates `ChangeNotification` records
- ❌ **NO user-facing UI** (no Changes tab, no emails, no notification bell)
- ❌ **No user acknowledgment** (just silent collection)

**Why?**

- Start collecting change history NOW
- When Epic 8 launches, we'll have historical data
- Validate change detection accuracy during MVP

**Code:**

```typescript
// Epic 2.11: Silent mode
await prisma.changeNotification.create({
  data: {
    workspace_id: workspace.id,
    document_id: law.id,
    // ... other fields
    acknowledged: false, // Not shown to users yet
  },
})
```

---

### Epic 8: User-Facing Change Notifications 🔔

**Launches:** Post-MVP (3-4 weeks after MVP)

**What Gets Added:**

#### 1. Changes Tab UI (Story 8.1)

```typescript
// app/dashboard/laws/page.tsx

<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">All Laws</TabsTrigger>
    <TabsTrigger value="changes">
      Changes
      {unacknowledgedCount > 0 && (
        <Badge variant="destructive">{unacknowledgedCount}</Badge>
      )}
    </TabsTrigger>
  </TabsList>

  <TabsContent value="changes">
    {changes.map(change => (
      <ChangeCard
        key={change.id}
        priority={change.priority}
        lawTitle={change.document.title}
        summary={change.summary}
        detectedAt={change.detected_at}
        onMarkReviewed={() => markAsReviewed(change.id)}
      />
    ))}
  </TabsContent>
</Tabs>
```

#### 2. Email Notifications (Story 8.4)

```typescript
// api/cron/send-change-digest/route.ts

export async function GET() {
  // Run daily at 08:00 CET
  const workspaces = await prisma.workspace.findMany({
    where: {
      changeNotifications: {
        some: {
          acknowledged: false,
          detected_at: { gte: yesterday },
        },
      },
    },
    include: {
      owner: true,
      changeNotifications: {
        where: { acknowledged: false },
        include: { document: true },
      },
    },
  })

  for (const workspace of workspaces) {
    await sendChangeDigestEmail({
      to: workspace.owner.email,
      workspace: workspace.name,
      changes: workspace.changeNotifications,
    })
  }
}
```

#### 3. Notification Bell (Story 8.5)

```typescript
// components/NotificationBell.tsx

export function NotificationBell() {
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then(r => r.json()),
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
  })

  const unreadCount = notifications?.filter(n => !n.acknowledged).length ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <h4 className="font-semibold mb-2">Recent Changes</h4>
        {notifications?.slice(0, 5).map(n => (
          <div key={n.id} className="text-sm py-2 border-b last:border-0">
            <p className="font-medium">{n.document.title}</p>
            <p className="text-muted-foreground">{n.summary}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(n.detected_at))} ago
            </p>
          </div>
        ))}
        <Link href="/dashboard/laws?tab=changes" className="text-sm text-primary">
          View all changes →
        </Link>
      </PopoverContent>
    </Popover>
  )
}
```

---

## 6. Testing Strategy

### Manual Testing

**Week 1: Monitor Actual Changes**

```bash
# Run cron job manually
curl -X GET http://localhost:3000/api/cron/detect-sfs-changes \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Check database
psql -d laglig_se -c "SELECT * FROM law_change_history ORDER BY detected_at DESC LIMIT 10;"

# Verify changes are real
# Go to https://data.riksdagen.se/dokumentlista/?doktyp=SFS&ts=2025-11-05
# Compare with detected changes
```

**Test Cases:**

1. ✅ New law published → Detected as NEW_LAW
2. ✅ Existing law amended → Detected as AMENDMENT with correct `amending_law`
3. ✅ Text change → Hash mismatch detected
4. ✅ Law repealed → Detected as REPEAL
5. ✅ No changes → Cron completes with 0 changes

### Automated Testing

```typescript
// tests/change-detection.test.ts

describe('Change Detection', () => {
  it('should detect new law', async () => {
    // Mock Riksdagen API response with new SFS
    const mockResponse = {
      dokumentlista: {
        dokument: [
          {
            id: 'sfs-2025-999',
            beteckning: '2025:999',
            undertitel: '',
            // ... other fields
          },
        ],
      },
    }

    // Run change detection
    await detectSFSChanges()

    // Verify LawChangeHistory record created
    const history = await prisma.lawChangeHistory.findFirst({
      where: {
        change_type: 'NEW_LAW',
        metadata: { path: ['riksdagen_id'], equals: 'sfs-2025-999' },
      },
    })
    expect(history).toBeDefined()
  })

  it('should detect amendment', async () => {
    // Create existing law
    const law = await prisma.legalDocument.create({
      data: {
        document_number: 'SFS 2011:1029',
        metadata: { latest_amendment: 'SFS 2023:253' },
        // ... other fields
      },
    })

    // Mock Riksdagen API response with updated amendment
    const mockResponse = {
      dokumentlista: {
        dokument: [
          {
            id: 'sfs-2011-1029',
            beteckning: '2011:1029',
            undertitel: 't.o.m. SFS 2025:500', // NEW AMENDMENT
          },
        ],
      },
    }

    await detectSFSChanges()

    // Verify AMENDMENT change detected
    const history = await prisma.lawChangeHistory.findFirst({
      where: { document_id: law.id, change_type: 'AMENDMENT' },
    })
    expect(history).toBeDefined()
    expect(history.metadata.new_value).toBe('SFS 2025:500')
  })
})
```

---

## 7. Monitoring & Alerting

### Logs

```typescript
// Structured logging
console.log(
  JSON.stringify({
    event: 'change_detection_started',
    timestamp: new Date().toISOString(),
    date_checked: dateStr,
  })
)

console.log(
  JSON.stringify({
    event: 'changes_detected',
    count: documents.length,
    new_laws: newLawCount,
    amendments: amendmentCount,
    repeals: repealCount,
  })
)

console.log(
  JSON.stringify({
    event: 'change_detection_completed',
    duration_ms: Date.now() - startTime,
    notifications_created: notificationCount,
  })
)
```

### Alerts (Sentry)

```typescript
// Alert if no changes for 7+ days (unusual)
const lastChange = await prisma.lawChangeHistory.findFirst({
  orderBy: { detected_at: 'desc' },
})

const daysSinceLastChange = Math.floor(
  (Date.now() - lastChange.detected_at.getTime()) / (1000 * 60 * 60 * 24)
)

if (daysSinceLastChange > 7) {
  Sentry.captureMessage(
    `No SFS changes detected in ${daysSinceLastChange} days`,
    'warning'
  )
}

// Alert if API fails
try {
  await detectSFSChanges()
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'change_detection' },
    extra: { date: dateStr },
  })
}
```

---

## 8. Cost Analysis

### API Costs

**Riksdagen API:** ✅ Free (no costs)

**OpenAI GPT-4 (Change Summaries):**

- Assume 10 changes/day average
- 500 tokens input (law context) + 100 tokens output (summary) per change
- Input: 10 × 500 × $0.01/1K = $0.05/day
- Output: 10 × 100 × $0.03/1K = $0.03/day
- **Total:** ~$2.40/month

**Email Sending (Resend):**

- Assume 1,000 users, 10 changes/day, 50% email opt-in
- 500 emails/day × 30 days = 15,000 emails/month
- Resend: Free tier (3,000 emails/month) + Paid ($20/month for 50K)
- **Total:** $20/month

**Grand Total:** ~$22/month for change detection + notifications

---

## 9. Fallback Strategy

### If Riksdagen API Fails

**Scenario:** Riksdagen API is down or `systemdatum` filtering stops working

**Fallback Plan:**

1. **Immediate:** Log error to Sentry, notify team
2. **Within 1 hour:** Switch to Lagrummet Atom feeds
3. **Within 24 hours:** Implement full-list comparison (compare all 11K SFS, detect changes by hash)

**Fallback Implementation:**

```typescript
async function detectSFSChanges() {
  try {
    // Try Riksdagen first
    return await detectViaRiksdagen()
  } catch (error) {
    console.error('[Change Detection] Riksdagen failed:', error)
    Sentry.captureException(error)

    try {
      // Fallback to Lagrummet
      return await detectViaLagrummet()
    } catch (error2) {
      console.error('[Change Detection] Lagrummet failed:', error2)
      Sentry.captureException(error2)

      // Last resort: Full list comparison
      return await detectViaFullComparison()
    }
  }
}
```

---

## 10. Conclusion

### Summary

✅ **PRIMARY METHOD: Riksdagen API `systemdatum` filtering**

- Simple, reliable, comprehensive
- Single API call per day
- Detects new laws, amendments, repeals

✅ **Epic 2.11 Implementation: Silent data collection**

- Start NOW with initial SFS ingestion
- Nightly cron at 00:30 CET
- Store in `LawChangeHistory` + `ChangeNotification`
- No user-facing UI yet

✅ **Epic 8 Implementation: User notifications**

- Changes tab with priority badges
- Daily email digest (08:00 CET)
- Notification bell with real-time count
- "Mark as Reviewed" workflow

### Next Steps

1. **Implement Epic 2.11 change detection** (silent mode)
2. **Run for 2-3 weeks during MVP** to validate accuracy
3. **Build Epic 8 UI** after MVP launch
4. **Launch change notifications** with historical data already collected

---

**Status:** Change detection strategy complete ✅
**Ready for:** Implementation in Epic 2.11 (Silent Collection)
