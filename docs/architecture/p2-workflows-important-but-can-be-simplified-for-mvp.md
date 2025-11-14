# P2 WORKFLOWS (Important but can be simplified for MVP)

## 8.13 Trial Expiration & Conversion (Epic 4, Story 4.8)

```mermaid
sequenceDiagram
    participant Cron
    participant Worker
    participant DB
    participant Email
    participant Stripe

    Cron->>Worker: Daily at 00:00

    Worker->>DB: Find expiring trials
    Note over DB: WHERE trial_ends_at<br/>BETWEEN now AND +24h

    loop For each expiring
        Worker->>Email: Send "Trial ending" email
        Worker->>DB: Set reminder_sent flag
    end

    Worker->>DB: Find expired trials
    Note over DB: WHERE trial_ends_at < now<br/>AND status = 'ACTIVE'

    loop For each expired
        Worker->>DB: UPDATE status = 'EXPIRED'
        Worker->>DB: Restrict features
        Worker->>Email: Send "Trial expired" email

        alt Has payment method
            Worker->>Stripe: Create subscription
            Stripe-->>Worker: Subscription created
            Worker->>DB: UPDATE to paid
        end
    end
```

---

## 8.14 Kollektivavtal Upload & Assignment (Epic 7, Story 7.5)

```mermaid
sequenceDiagram
    actor HR
    participant UI
    participant Storage as Supabase Storage
    participant Parser as PDF Parser
    participant Embeddings as OpenAI
    participant DB

    HR->>UI: Upload kollektivavtal PDF
    UI->>Storage: Upload file
    Storage-->>UI: File URL

    UI->>Parser: Extract text from PDF
    Parser-->>UI: Text content

    UI->>Embeddings: Generate chunks + embeddings
    Embeddings-->>UI: Vector embeddings

    UI->>DB: Store kollektivavtal
    DB->>DB: Store embeddings for RAG

    HR->>UI: Assign to employees
    UI->>DB: Bulk update employees
    DB-->>UI: 25 employees updated

    Note over UI: Kollektivavtal now available<br/>in AI chat context
```

---

## 8.15 Global Search (Cmd+K) (Epic 6, Story 6.9)

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant Search as Search Service
    participant DB

    User->>UI: Press Cmd+K
    UI->>UI: Open search modal

    User->>UI: Type "semester"
    UI->>Search: Search all entities

    par Parallel search
        Search->>DB: Search laws
    and
        Search->>DB: Search employees
    and
        Search->>DB: Search tasks
    and
        Search->>DB: Search comments
    end

    DB-->>Search: Aggregated results
    Search-->>UI: Grouped results

    UI-->>User: Show results by type
    Note over User: Laws (5)<br/>Employees (2)<br/>Tasks (1)<br/>Comments (3)

    User->>UI: Click result
    UI->>UI: Navigate to entity
```

---

## 8.16 Usage Limit Enforcement (Epic 5, Story 5.5)

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Cache as Redis

    Client->>API: Request AI chat

    API->>Cache: Get usage count
    Cache-->>API: ai_queries: 98

    API->>DB: Get subscription limits
    DB-->>API: Limit: 100/month

    alt Under limit
        API->>API: Process request
        API->>Cache: INCREMENT usage
        API-->>Client: 200 OK + response
    else At 80% limit
        API->>API: Process request
        API->>Cache: INCREMENT usage
        API-->>Client: 200 OK + warning
        Note over Client: "You've used 80 of 100 queries"
    else Over limit
        API-->>Client: 429 Too Many Requests
        Note over Client: "Upgrade to continue"
    end

    Note over Cache: Reset monthly
```

---

## 8.17 SNI Discovery Flow (Epic 2, Story 2.9)

```mermaid
sequenceDiagram
    actor User
    participant UI as Discovery Page
    participant API
    participant DB
    participant AI

    User->>UI: Enter SNI code "56.101"
    UI->>API: GET /api/discover/sni/56101

    API->>DB: Fetch pre-curated list
    Note over DB: Laws mapped to SNI codes

    alt Has curated list
        DB-->>API: 25 laws, 8 cases, 5 EU
    else No curated list
        API->>AI: Generate for SNI 56.101
        AI-->>API: Generated list
        API->>DB: Cache for future
    end

    API-->>UI: Categorized results
    UI-->>User: Three tabs
    Note over User: Lagar (25)<br/>Rättsfall (8)<br/>EU-lagstiftning (5)

    User->>UI: Click "Add all to list"
    UI->>API: Bulk add to law list
    API-->>UI: Success
```

---

## 8.18 Weekly Digest Generation (Epic 8, Story 8.7)

```mermaid
sequenceDiagram
    participant Cron
    participant Worker
    participant DB
    participant AI
    participant Email

    Cron->>Worker: Every Sunday 08:00

    Worker->>DB: Get users by industry

    loop For each industry
        Worker->>DB: Get week's changes
        Note over DB: Laws relevant to industry

        alt Has changes
            Worker->>AI: Generate digest summary
            AI-->>Worker: Industry insights

            Worker->>DB: Get subscribed users

            loop For each user
                Worker->>Email: Send digest
                Note over Email: Personalized with:<br/>- User's law list changes<br/>- Industry trends<br/>- Upcoming deadlines
            end
        end
    end

    Worker->>DB: Log digest stats
```

---
