# P1 WORKFLOWS (Critical for MVP Launch)

## 8.5 Onboarding with Website Scraping (Epic 4, Stories 4.1-4.4)

**User Story:** Restaurant owner enters org-number and website URL, gets personalized law list

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextJS as Next.js App
    participant Scraper as Web Scraper
    participant Redis
    participant Bolagsverket
    participant OpenAI
    participant Email

    User->>Browser: Enter org-number + website URL
    Browser->>NextJS: POST /api/onboarding/start

    par Parallel fetch
        NextJS->>Bolagsverket: Fetch company data
        Bolagsverket-->>NextJS: Company info (name, SNI)
    and
        NextJS->>Scraper: Scrape website
        Scraper->>Scraper: Extract HTML content
        Scraper->>OpenAI: Analyze for segmentation
        Note over OpenAI: Identify:<br/>- Business activities<br/>- B2B/B2C<br/>- Special regulations<br/>- Data processing
        OpenAI-->>Scraper: Business characteristics
        Scraper-->>NextJS: Enhanced context
    end

    NextJS->>Redis: Create session with context
    Redis-->>NextJS: Session ID

    NextJS-->>Browser: Company verified + Question 1
    Note over Browser: Questions now personalized<br/>based on website analysis

    loop Dynamic Questions (3-5 times)
        Browser->>NextJS: Answer question
        NextJS->>NextJS: Generate Phase 1 laws
        NextJS-->>Browser: Stream laws + Next question
    end

    Browser-->>User: Shows 15-30 laws preview

    User->>Browser: Enter email (MQL)
    Browser->>NextJS: POST /api/onboarding/capture-lead

    NextJS->>Redis: Extend session to 7 days
    NextJS->>Email: Send "Lista sparad" email

    Note over User: Continue to full signup...
```

---

## 8.6 Search Workflow (Epic 2, Story 2.7)

**User Story:** User searches for "semester" across 170,000+ legal documents

```mermaid
sequenceDiagram
    actor User
    participant Search UI
    participant API
    participant Cache as Redis Cache
    participant DB as PostgreSQL
    participant FTS as Full-Text Search

    User->>Search UI: Type "semester"
    Search UI->>API: GET /api/search?q=semester

    API->>Cache: Check cached results

    alt Cache miss
        Cache-->>API: No results

        API->>DB: Build search query
        Note over DB: WITH search AS (<br/>  SELECT *, <br/>  ts_rank(search_vector, query) AS rank<br/>  FROM legal_documents<br/>  WHERE search_vector @@ query<br/>)

        DB->>FTS: Execute FTS query
        FTS-->>DB: Matching documents

        DB->>DB: Join with metadata
        DB->>DB: Sort by relevance
        DB-->>API: Search results

        API->>Cache: Store results (5 min TTL)
    else Cache hit
        Cache-->>API: Cached results
    end

    API-->>Search UI: Results + facets

    Search UI-->>User: Display results
    Note over User: Shows:<br/>- Result count<br/>- Mixed content types<br/>- Highlighted matches<br/>- Filters
```

**Search Optimizations:**

```typescript
// Weighted search ranking
const searchWeights = {
  title: 'A',        // Highest weight
  document_number: 'B',
  summary: 'C',
  full_text: 'D'     // Lowest weight
}

// Query with filters
SELECT * FROM legal_documents
WHERE
  search_vector @@ plainto_tsquery('swedish', $1)
  AND content_type = ANY($2)  -- Filter by type
  AND status = 'ACTIVE'
ORDER BY
  ts_rank(search_vector, query, 1) DESC
LIMIT 20 OFFSET $3
```

---

## 8.7 Law List Management (Epic 4, Story 4.9)

**User Story:** User adds/removes laws from their monitoring list

```mermaid
sequenceDiagram
    actor User
    participant UI as Law List UI
    participant Store as Zustand Store
    participant Action as Server Action
    participant DB
    participant Notification as Notification Service

    User->>UI: Search for law to add
    UI->>UI: Show search results

    User->>UI: Click "Add to list"
    UI->>Store: Optimistic add
    Store-->>UI: Update UI immediately

    UI->>Action: addLawToList()
    Action->>DB: Check if already exists

    alt Law not in list
        DB->>DB: INSERT law_in_list
        DB->>DB: Create change subscription
        DB-->>Action: Success

        Action->>Notification: Setup monitoring
        Notification-->>Action: Confirmed

        Action-->>UI: Success
    else Already in list
        DB-->>Action: Duplicate error
        Action-->>UI: Already exists
        UI->>Store: Revert optimistic update
    end

    User->>UI: Remove law from list
    UI->>Action: removeLawFromList()
    Action->>DB: DELETE law_in_list
    Action->>Notification: Cancel monitoring
    Action-->>UI: Success
```

---

## 8.8 Dashboard View Generation (Epic 6, Story 6.1)

**User Story:** User sees personalized dashboard with compliance overview

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant API
    participant DB
    participant Cache

    User->>Browser: Navigate to dashboard
    Browser->>API: GET /api/dashboard

    par Parallel data fetch
        API->>DB: Get compliance stats
        Note over DB: COUNT by status
    and
        API->>DB: Get recent changes
        Note over DB: Last 7 days
    and
        API->>DB: Get AI insights
        Note over DB: Priority suggestions
    and
        API->>DB: Get recent activity
        Note over DB: Audit log
    end

    DB-->>API: Aggregated data

    API->>Cache: Store computed stats
    API-->>Browser: Dashboard data

    Browser-->>User: Render dashboard
    Note over User: Shows:<br/>- Compliance ring (65%)<br/>- Recent changes (3)<br/>- Priority alerts (2)<br/>- Quick actions
```

---

## 8.9 AI Chat with Multi-Type Context (Epic 3, Stories 3.4-3.7)

**User Story:** User drags law, employee, and PDF into chat for contextual question

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant Chat
    participant RAG as RAG Service
    participant Vector as pgvector
    participant GPT4

    User->>UI: Drag law card
    UI->>Chat: Add law context

    User->>UI: Drag employee card
    UI->>Chat: Add employee context

    User->>UI: Drag kollektivavtal PDF
    UI->>Chat: Add document context

    Chat->>Chat: Display 3 context pills
    Note over Chat: Context:<br/>- Semesterlagen<br/>- Anna (Developer)<br/>- IT Kollektivavtal

    User->>Chat: "How many vacation days for Anna?"

    Chat->>RAG: Query with context

    RAG->>Vector: Search relevant chunks
    Note over Vector: Search in:<br/>- Law embeddings<br/>- Kollektivavtal chunks

    Vector-->>RAG: Relevant passages

    RAG->>GPT4: Generate with context
    Note over GPT4: System: Swedish law expert<br/>Context: [law, employee, agreement]<br/>User: vacation days question

    GPT4-->>RAG: "Anna has 25 days..."
    RAG-->>Chat: Stream response
    Chat-->>User: Response with citations
```

---

## 8.10 Kanban Board with Task Management (Epic 6, Stories 6.2-6.5)

**User Story:** User manages compliance using Kanban board with tasks

```mermaid
sequenceDiagram
    actor User
    participant Board
    participant Modal
    participant Store as Zustand
    participant DB
    participant WS as WebSocket

    User->>Board: Click law card
    Board->>Modal: Open detail modal

    Modal->>DB: Fetch full law details
    DB-->>Modal: Law data + tasks

    User->>Modal: Add task "Review by Dec 1"
    Modal->>Store: Optimistic add task
    Modal->>DB: INSERT task

    User->>Modal: Assign to employee
    Modal->>DB: UPDATE task assignee
    DB->>WS: Broadcast update
    WS-->>Board: Real-time update

    User->>Board: Drag card to "In Progress"
    Board->>Store: Optimistic move
    Board->>DB: UPDATE status
    DB->>DB: Log status change
    DB-->>Board: Confirmed
```

---

## 8.11 Employee CRUD & Compliance (Epic 7, Stories 7.1, 7.4)

**User Story:** HR manager adds employee and system calculates compliance

```mermaid
sequenceDiagram
    actor HR as HR Manager
    participant Form
    participant API
    participant DB
    participant AI as OpenAI
    participant Compliance as Compliance Engine

    HR->>Form: Enter employee details
    Form->>API: POST /api/employees

    API->>DB: INSERT employee
    DB-->>API: Employee created

    API->>AI: Suggest relevant laws
    Note over AI: Based on:<br/>- Role: Developer<br/>- Department: IT<br/>- Location: Stockholm

    AI-->>API: [10 suggested laws]

    API->>DB: Store law suggestions

    API->>Compliance: Calculate status
    Note over Compliance: Check:<br/>- Required fields ✅<br/>- Kollektivavtal ❌<br/>- Documents ❌

    Compliance-->>API: Status = "Needs Attention"

    API->>DB: UPDATE compliance_status
    API-->>Form: Employee created

    Form-->>HR: Show profile with status
```

---

## 8.12 Change Detection & Review (Epic 8, Stories 8.1-8.3)

**User Story:** System detects law change, user reviews and marks as reviewed

```mermaid
sequenceDiagram
    participant Cron
    participant Worker
    participant Riksdagen
    participant DB
    participant Diff
    participant AI
    participant User
    participant UI

    Cron->>Worker: 02:00 daily trigger

    Worker->>DB: Get monitored laws
    Worker->>Riksdagen: Fetch current versions

    Worker->>Diff: Compare versions
    Diff-->>Worker: Changes detected

    Worker->>AI: Generate summary
    AI-->>Worker: Plain language summary

    Worker->>DB: INSERT change_notification
    Worker->>DB: Queue email notifications

    Note over User: Next morning...

    User->>UI: Open changes tab
    UI->>DB: Fetch unreviewed changes
    DB-->>UI: 3 changes

    User->>UI: Click change
    UI-->>User: Show diff + AI summary

    User->>UI: Click "Mark as reviewed"
    UI->>DB: UPDATE reviewed_at
    UI->>DB: INSERT audit_log
    DB-->>UI: Success

    UI-->>User: Change marked ✓
```

---
