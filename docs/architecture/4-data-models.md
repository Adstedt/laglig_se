# 4. Data Models

**This section defines ALL core business entities that power Laglig.se.** These models support multi-tenancy, RAG-powered AI, employee compliance tracking, Kanban workflows, and legal content management across 170,000+ documents.

**Total Entities:** 29 (including 4 join tables)

**Data Model Architecture:**

- **Multi-tenant:** All workspace data isolated via `workspace_id` foreign keys + PostgreSQL Row-Level Security (RLS)
- **Polymorphic Legal Content:** Single `legal_documents` table for all content types (SFS laws, court cases, EU legislation) with type-specific metadata tables
- **UUID Primary Keys:** Prevents enumeration attacks, enables distributed ID generation
- **JSONB for Flexibility:** Metadata fields use PostgreSQL JSONB for document-specific structures
- **Vector Embeddings:** pgvector extension for RAG (1536-dimensional embeddings via text-embedding-3-small)

---

## 4.1 User

**Purpose:** Individual user accounts. Users can belong to multiple workspaces with different roles in each.

**Key Attributes:**

- `id`: UUID - Primary key
- `email`: string - Unique email for authentication
- `name`: string | null - Full name
- `avatar_url`: string | null - Profile picture (Supabase Storage)
- `created_at`: DateTime
- `last_login_at`: DateTime | null

**TypeScript Interface:**

```typescript
interface User {
  id: string // UUID
  email: string
  name: string | null
  avatar_url: string | null
  created_at: Date
  last_login_at: Date | null
}
```

**Relationships:**

- Has many `WorkspaceMember`
- Has many `AIChatMessage`

**Design Decisions:**

- Managed by Supabase Auth (JWT tokens, magic links, OAuth)
- No password field (handled by Supabase Auth tables)
- Email is unique globally (not per workspace)

---

## 4.2 Workspace

**Purpose:** Multi-tenancy container representing a company/organization. Each workspace has isolated compliance data, law lists, employees, and subscriptions. **Workspace = Company** - stores both workspace metadata and company data from Bolagsverket in a single entity.

**Key Attributes:**

_Workspace Identity:_

- `id`: UUID - Primary key
- `name`: string - Workspace/company name (e.g., "Acme AB")
- `slug`: string - URL-friendly identifier (unique, indexed)
- `owner_id`: UUID - Foreign key to User (workspace creator)
- `company_logo`: string | null - Logo URL (Supabase Storage)

_Company Data (from Bolagsverket):_

- `org_number`: string | null - Swedish organization number (10 digits, e.g., "5569876543")
- `company_legal_name`: string | null - Official registered name from Bolagsverket
- `address`: string | null - Registered company address
- `sni_code`: string | null - Swedish industry classification code (e.g., "56.10" for restaurants)
- `legal_form`: string | null - AB, HB, KB, etc.
- `employee_count_reported`: integer | null - Employee count from Bolagsverket (may be outdated)

_Onboarding Context:_

- `onboarding_context`: JSONB | null - Stores dynamic question answers from onboarding (e.g., `{"serverar_alkohol": true, "uteservering": false}`)
- `onboarding_completed`: boolean - True after Phase 2 law generation complete
- `industry`: string | null - Simplified industry label (e.g., "Restaurang", "Bygg")
- `company_size`: enum | null - "1-10", "11-50", "51-200", "201+"

_Subscription & Status:_

- `subscription_tier`: enum - "FREE", "SOLO", "TEAM", "ENTERPRISE"
- `trial_ends_at`: DateTime | null - 14-day trial expiration
- `status`: enum - "ACTIVE", "PAUSED", "DELETED"

_Timestamps:_

- `created_at`: DateTime
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
type CompanySize = '1-10' | '11-50' | '51-200' | '201+'
type SubscriptionTier = 'FREE' | 'SOLO' | 'TEAM' | 'ENTERPRISE'
type WorkspaceStatus = 'ACTIVE' | 'PAUSED' | 'DELETED'

interface Workspace {
  id: string // UUID
  name: string
  slug: string // Unique, indexed
  owner_id: string // FK to User
  company_logo: string | null

  // Company data (from Bolagsverket)
  org_number: string | null
  company_legal_name: string | null
  address: string | null
  sni_code: string | null // Industry classification
  legal_form: string | null // AB, HB, etc.
  employee_count_reported: number | null

  // Onboarding
  onboarding_context: Record<string, any> | null // JSONB
  onboarding_completed: boolean
  industry: string | null
  company_size: CompanySize | null

  // Subscription
  subscription_tier: SubscriptionTier
  trial_ends_at: Date | null
  status: WorkspaceStatus

  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `User` (owner_id)
- Has many `WorkspaceMember`
- Has one `Subscription`
- Has many `LawInWorkspace` (Kanban board laws)
- Has many `LawList`
- Has many `Employee`
- Has many `AIChatMessage`
- Has many `ChangeNotification`

**Design Decisions:**

- **Company data stored directly on Workspace** (not separate Company table) - workspace = company
- `slug` indexed for URL routing (`/workspaces/{slug}/dashboard`)
- `org_number` indexed for Bolagsverket lookup during onboarding
- `sni_code` critical for industry-specific law selection (e.g., "56.10" triggers restaurant-specific questions)
- `onboarding_context` as JSONB allows storing arbitrary question-answer pairs without schema changes
- `employee_count_reported` from Bolagsverket may be stale (users update actual count in HR Module)
- Soft deletion via `status = DELETED` (GDPR requires eventual hard delete)

---

## 4.3 WorkspaceMember

**Purpose:** Join table connecting users to workspaces with role-based permissions.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `user_id`: UUID - FK to User
- `role`: enum - "OWNER", "ADMIN", "HR_MANAGER", "MEMBER", "AUDITOR"
- `invited_by`: UUID | null - FK to User who sent invitation
- `joined_at`: DateTime

**TypeScript Interface:**

```typescript
type WorkspaceRole = 'OWNER' | 'ADMIN' | 'HR_MANAGER' | 'MEMBER' | 'AUDITOR'

interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  invited_by: string | null
  joined_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Belongs to one `User`

**Role Permissions:**

- **OWNER:** Full access, billing, workspace deletion (1 per workspace)
- **ADMIN:** Full access except billing and deletion
- **HR_MANAGER:** Full HR Module access, read-only law lists
- **MEMBER:** Read-only law lists, AI chat access, no employee data
- **AUDITOR:** Read-only across multiple workspaces (for ISO consultants)

**Design Decisions:**

- Composite unique index on `(workspace_id, user_id)`
- One OWNER per workspace enforced at application level
- AUDITOR role can belong to multiple workspaces (ISO consultant use case)

---

## 4.4 OnboardingSession

**Purpose:** Stores partial onboarding state to allow users to resume if they close browser. Session expires after 24 hours (PRD technical implications).

**Key Attributes:**

- `id`: UUID
- `session_token`: string - Unique token for resuming (stored in localStorage)
- `org_number`: string | null - Company org-number entered
- `bolagsverket_data`: JSONB | null - Fetched company data
- `question_answers`: JSONB | null - Answers to dynamic questions
- `phase1_laws`: JSONB | null - Generated Phase 1 law list (15-30 laws)
- `created_at`: DateTime
- `expires_at`: DateTime - 24 hours from creation

**TypeScript Interface:**

```typescript
interface OnboardingSession {
  id: string
  session_token: string
  org_number: string | null
  bolagsverket_data: Record<string, any> | null
  question_answers: Record<string, any> | null
  phase1_laws: Record<string, any> | null
  created_at: Date
  expires_at: Date
}
```

**Relationships:**

- None (temporary data, not tied to User until signup)

**Design Decisions:**

- Indexed on `session_token` for fast lookup
- Cron job deletes expired sessions daily
- When user signs up, data migrated to `Workspace.onboarding_context` and session deleted
- Prevents users from losing 2-3 minutes of onboarding work if they close tab

---

## 4.5 LegalDocument

**Purpose:** Polymorphic table storing ALL legal content (SFS laws, court cases, EU legislation). Currently 170,000+ documents. Per PRD Story 2.1, this is the central table for the legal content database.

**Key Attributes:**

- `id`: UUID - Primary key
- `content_type`: enum - "SFS_LAW", "HD_SUPREME_COURT", "HOVR_COURT_APPEAL", "HFD_ADMIN_SUPREME", "MOD_ENVIRONMENT_COURT", "MIG_MIGRATION_COURT", "EU_REGULATION", "EU_DIRECTIVE"
- `document_number`: string - Unique identifier per type (e.g., "2023:456" for SFS, "B 1234-23" for court case)
- `title`: string - Document title
- `slug`: string - URL-friendly (e.g., "arbetsmiljolagen-1977-1160")
- `summary`: string | null - AI-generated summary (300-500 chars)
- `full_text`: TEXT - Complete document content (markdown)
- `effective_date`: Date | null - When law takes effect
- `publication_date`: Date | null - When officially published
- `status`: enum - "ACTIVE", "REPEALED", "AMENDED"
- `source_url`: string - Original URL (Riksdagen, EUR-Lex, Domstolsverket)
- `metadata`: JSONB - Type-specific fields (chapters, articles, parties, etc.)
- `search_vector`: tsvector - PostgreSQL full-text search index
- `summary_embedding`: vector(1536) | null - Optional document-level embedding for hybrid search
- `created_at`: DateTime
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
type ContentType =
  | 'SFS_LAW'
  | 'HD_SUPREME_COURT'
  | 'HOVR_COURT_APPEAL'
  | 'HFD_ADMIN_SUPREME'
  | 'MOD_ENVIRONMENT_COURT'
  | 'MIG_MIGRATION_COURT'
  | 'EU_REGULATION'
  | 'EU_DIRECTIVE'

type DocumentStatus = 'ACTIVE' | 'REPEALED' | 'AMENDED'

interface LegalDocument {
  id: string
  content_type: ContentType
  document_number: string // Unique
  title: string
  slug: string // Indexed
  summary: string | null
  full_text: string // Large TEXT field
  effective_date: Date | null
  publication_date: Date | null
  status: DocumentStatus
  source_url: string
  metadata: Record<string, any> // JSONB
  search_vector: any // tsvector (PostgreSQL type)
  summary_embedding: number[] | null // vector(1536) - Optional for hybrid search
  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Has many `LawEmbedding` (vector chunks for RAG)
- Has many `CourtCase` (if content_type is court case)
- Has many `EUDocument` (if content_type is EU legislation)
- Has many `CrossReference` (as source or target)
- Has many `Amendment` (as base or amending document)
- Has many `DocumentSubject` (categorization tags)
- Referenced by many `LawInWorkspace` (Kanban cards)
- Referenced by many `ChangeNotification`

**Design Decisions:**

- **Polymorphic design:** Single table for all content types (vs. separate tables per type)
- `document_number` unique constraint per `content_type` (composite index)
- `slug` indexed for SEO URLs (`/lagar/{slug}`)
- `full_text` stored as large TEXT (avg 50KB per law, 8.5GB total for 170K docs)
- `metadata` JSONB stores type-specific fields (SFS: chapters/paragraphs, court cases: parties/judges, EU: CELEX numbers)
- `search_vector` is GIN indexed tsvector for full-text search (separate from vector embeddings)
- `summary_embedding` optional document-level vector for hybrid search strategy: (1) Query summary_embedding to find relevant documents first, (2) Then query LawEmbedding chunks within those documents for precise retrieval. Populated from AI-generated summary field.
- `status` tracked for change detection (ACTIVE → AMENDED → REPEALED lifecycle)

**Metadata Examples:**

```typescript
// SFS Law metadata
{
  chapters: [
    { number: 1, title: "Lagens tillämpningsområde", sections: [1, 2, 3] },
    { number: 2, title: "Definitioner", sections: [4, 5, 6, 7] }
  ],
  sfs_number: "1977:1160"
}

// Court Case metadata
{
  court_level: "Supreme Court",
  case_type: "Civil",
  judges: ["Anna Skarhed", "Per Virdesten"],
  dissent: false
}

// EU Directive metadata
{
  celex: "32016L0680",
  binding: true,
  implementation_deadline: "2018-05-06"
}
```

---

## 4.6 CourtCase

**Purpose:** Type-specific metadata for court case documents (HD, HovR, HFD, MÖD, MIG). Extends `LegalDocument` with case-specific fields. Per PRD Story 2.1 line 1289.

**Key Attributes:**

- `id`: UUID
- `document_id`: UUID - FK to LegalDocument (one-to-one)
- `court_name`: string - "Högsta domstolen", "Hovrätten för Västra Sverige", etc.
- `case_number`: string - Court's case identifier (e.g., "B 1234-23")
- `lower_court`: string | null - Previous court if appeal
- `decision_date`: Date - When verdict was issued
- `parties`: JSONB - Plaintiff, defendant, representatives

**TypeScript Interface:**

```typescript
interface CourtCase {
  id: string
  document_id: string // FK to LegalDocument
  court_name: string
  case_number: string
  lower_court: string | null
  decision_date: Date
  parties: {
    plaintiff?: string
    defendant?: string
    plaintiff_counsel?: string
    defendant_counsel?: string
  }
}
```

**Relationships:**

- Belongs to one `LegalDocument`

**Design Decisions:**

- One-to-one with `LegalDocument` (not polymorphic columns)
- Only created when `LegalDocument.content_type` is a court case type
- `parties` as JSONB handles varying party structures (criminal vs civil vs administrative)

---

## 4.7 EUDocument

**Purpose:** Type-specific metadata for EU legislation (regulations, directives). Tracks CELEX numbers and Swedish implementation status. Per PRD Story 2.1 line 1290.

**Key Attributes:**

- `id`: UUID
- `document_id`: UUID - FK to LegalDocument
- `celex_number`: string - Official EU identifier (e.g., "32016L0680")
- `eut_reference`: string | null - EUR-Lex reference number
- `national_implementation_measures`: JSONB | null - Which SFS laws implement this directive

**TypeScript Interface:**

```typescript
interface EUDocument {
  id: string
  document_id: string // FK to LegalDocument
  celex_number: string
  eut_reference: string | null
  national_implementation_measures: {
    sfs_numbers?: string[]
    implementation_date?: string
    responsible_ministry?: string
  } | null
}
```

**Relationships:**

- Belongs to one `LegalDocument`

**Design Decisions:**

- `celex_number` indexed for EUR-Lex API lookups
- `national_implementation_measures` tracks which SFS laws implement EU directives (manually curated or scraped from government sources)

---

## 4.8 CrossReference

**Purpose:** Links between documents (law cites court case, EU directive implemented by SFS law, law amends another law). Enables cross-document navigation. Per PRD Story 2.1 line 1291.

**Key Attributes:**

- `id`: UUID
- `source_document_id`: UUID - FK to LegalDocument
- `target_document_id`: UUID - FK to LegalDocument
- `reference_type`: enum - "CITES", "AMENDS", "IMPLEMENTS", "REPEALS", "RELATED"
- `context`: TEXT | null - Surrounding text where reference appears

**TypeScript Interface:**

```typescript
type ReferenceType = 'CITES' | 'AMENDS' | 'IMPLEMENTS' | 'REPEALS' | 'RELATED'

interface CrossReference {
  id: string
  source_document_id: string
  target_document_id: string
  reference_type: ReferenceType
  context: string | null
}
```

**Relationships:**

- Belongs to one `LegalDocument` (source)
- Belongs to one `LegalDocument` (target)

**Design Decisions:**

- Indexed on `(source_document_id, target_document_id)` for fast lookups
- Enables "Referenced by" section on law pages
- Extracted during document ingestion via regex patterns and GPT-4 parsing

**Examples:**

- Source: SFS 2018:218 (GDPR implementation law), Target: EU Regulation 2016/679, Type: IMPLEMENTS
- Source: HD Case B 1234-23, Target: SFS 1977:1160 (Arbetsmiljölagen), Type: CITES
- Source: SFS 2024:123, Target: SFS 1977:1160, Type: AMENDS

---

## 4.9 Amendment (Enhanced for Competitive Parity)

**Purpose:** Tracks SFS law amendment history with rich metadata for competitive parity with Notisum. One SFS law can amend multiple sections of another. Per PRD Story 2.1 line 1292 (updated) and `docs/notisum-amendment-competitive-analysis.md`.

**Competitive Context:** Notisum provides 7 data points per amendment. This model achieves **feature parity + automation advantages**.

**Key Attributes:**

- `id`: UUID
- `base_document_id`: UUID - FK to LegalDocument (law being amended)
- `amending_document_id`: UUID - FK to LegalDocument (law making amendment)
- **Enhanced Metadata (competitive requirements):**
  - `amending_law_title`: TEXT - Full title "Lag (2025:732) om ändring i..."
  - `publication_date`: DATE - When amending law was published
  - `effective_date`: DATE | null - When amendment takes effect (can be future)
  - `affected_sections_raw`: TEXT | null - Notisum format "ändr. 6 kap. 17 §; upph. 8 kap. 4 §"
  - `affected_sections`: JSONB - Structured sections `{amended: ["6:17"], repealed: ["8:4"], new: [], renumbered: []}`
  - `summary`: TEXT | null - 2-3 sentence GPT-4 generated plain language summary
  - `summary_generated_by`: ENUM - GPT_4 | HUMAN | SFSR | RIKSDAGEN
  - `detected_method`: ENUM - RIKSDAGEN_TEXT_PARSING | LAGEN_NU_SCRAPING | SFSR_REGISTER | LAGRUMMET_RINFO
  - `metadata`: JSONB | null - Raw data for debugging
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**TypeScript Interface:**

```typescript
interface Amendment {
  id: string
  base_document_id: string
  amending_document_id: string

  // Enhanced metadata
  amending_law_title: string
  publication_date: Date
  effective_date: Date | null

  // Affected sections (Notisum format)
  affected_sections_raw: string | null // "ändr. 6 kap. 17 §"
  affected_sections: {
    amended: string[] // ["6:17"]
    repealed: string[] // ["8:4"]
    new: string[] // ["6:17a", "6:17b"]
    renumbered: Array<{
      // [{from: "3:2b", to: "3:2c"}]
      from: string
      to: string
    }>
  } | null

  // AI-generated summary
  summary: string | null
  summary_generated_by: 'GPT_4' | 'HUMAN' | 'SFSR' | 'RIKSDAGEN' | null

  // Source tracking
  detected_method:
    | 'RIKSDAGEN_TEXT_PARSING'
    | 'LAGEN_NU_SCRAPING'
    | 'SFSR_REGISTER'
    | 'LAGRUMMET_RINFO'
  metadata: Record<string, any> | null

  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `LegalDocument` (base)
- Belongs to one `LegalDocument` (amending)

**Design Decisions:**

- Indexed on `base_document_id`, `amending_document_id`, and `publication_date`
- Unique constraint on `(base_document_id, amending_document_id)` prevents duplicates
- Powers "Change History" tab on law pages (Epic 8 Story 8.9)
- Populated during initial SFS ingestion (Story 2.2) + nightly cron job (Story 2.11)
- GPT-4 summaries generated during ingestion (~$238 one-time cost for 5,675 amendments)
- Three-tier data source: Riksdagen text parsing (70-80%), Lagen.nu scraping (95-100%), SFSR validation (100%)
- See `docs/historical-amendment-tracking-strategy.md` for complete implementation guide

**Example (Realistic from Notisum competitive analysis):**

```json
{
  "id": "uuid",
  "base_document_id": "uuid-sfs-1977-1160",
  "amending_document_id": "uuid-sfs-2010-856",
  "amending_law_title": "Lag (2010:856) om ändring i arbetsmiljölagen (1977:1160)",
  "publication_date": "2010-06-23",
  "effective_date": "2011-07-01",
  "affected_sections_raw": "ändr. 1 kap. 3 §, 6 kap. 17 §",
  "affected_sections": {
    "amended": ["1:3", "6:17"],
    "repealed": [],
    "new": [],
    "renumbered": []
  },
  "summary": "Tillämpningsområdet för Arbetsmiljölagen förtydligas så att det framgår att barn i förskolan och elever i fritidshemmet inte anses genomgå utbildning i arbetsmiljölagens mening. Barnen i förskolan omfattas inte av Arbetsmiljölagen till skillnad mot elever fr.o.m. förskoleklassen.",
  "summary_generated_by": "GPT_4",
  "detected_method": "RIKSDAGEN_TEXT_PARSING",
  "metadata": {
    "parsing_confidence": "high",
    "source_url": "https://data.riksdagen.se/dokument/sfs-2010-856.text"
  },
  "created_at": "2025-01-06T12:00:00Z",
  "updated_at": "2025-01-06T12:00:00Z"
}
```

**Database Impact:**

- **Volume:** ~90,000 Amendment records for 11,351 SFS laws
- **Storage:** ~45MB (500 bytes/record average)
- **Performance:** Amendment timeline queries <500ms for 90% of laws (<50 amendments each)

---

## 4.10 DocumentSubject

**Purpose:** Categorization and tagging for legal documents. One document can have multiple subjects (e.g., "Arbetsmiljö", "GDPR", "Bygg"). Per PRD Story 2.1 line 1293.

**Key Attributes:**

- `id`: UUID
- `document_id`: UUID - FK to LegalDocument
- `subject_code`: string - Short code (e.g., "ARBM", "GDPR", "BYGG")
- `subject_name`: string - Display name (e.g., "Arbetsmiljö", "Dataskydd")

**TypeScript Interface:**

```typescript
interface DocumentSubject {
  id: string
  document_id: string
  subject_code: string
  subject_name: string
}
```

**Relationships:**

- Belongs to one `LegalDocument`

**Design Decisions:**

- Composite index on `(document_id, subject_code)` prevents duplicate tags
- Subject taxonomy curated manually + GPT-4 classification
- Indexed on `subject_code` for filtering (e.g., "Show all GDPR laws")

**Subject Taxonomy Examples:**

- ARBM: Arbetsmiljö
- GDPR: Dataskydd & GDPR
- BYGG: Byggverksamhet
- REST: Restaurang & Livsmedel
- TRAN: Transport & Logistik
- EKON: Ekonomi & Bokföring

---

## 4.11 LawEmbedding

**Purpose:** Vector embeddings for semantic search (RAG). Each law chunked into 5-20 pieces (500-800 tokens each per NFR24). Content-type-specific chunking strategies preserve document structure. Indexed with pgvector HNSW for <100ms queries.

**Key Attributes:**

- `id`: UUID
- `law_id`: UUID - FK to LegalDocument
- `chunk_index`: integer - Position in document (0, 1, 2, ...)
- `chunk_text`: string - Text content (500-800 tokens per NFR24)
- `embedding`: number[] - 1536-dimensional vector (text-embedding-3-small)
- `metadata`: JSONB - Chunk-specific context (chapter, section, article, court case section type)
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
interface LawEmbedding {
  id: string
  law_id: string
  chunk_index: number
  chunk_text: string
  embedding: number[] // vector(1536) in PostgreSQL
  metadata: {
    // For SFS laws
    chapter_number?: number
    section_number?: string
    law_title?: string

    // For court cases
    court_name?: string
    case_number?: string
    section_type?: 'Facts' | 'Analysis' | 'Conclusion'

    // For EU legislation
    article_number?: string
    celex?: string
    document_type?: 'regulation' | 'directive'
  } | null
  created_at: Date
}
```

**Relationships:**

- Belongs to one `LegalDocument`

**Design Decisions:**

- HNSW index: `CREATE INDEX ON law_embeddings USING hnsw (embedding vector_cosine_ops)`
- Composite index on `(law_id, chunk_index)`
- Average 10 chunks per law = 1.7M embeddings (170K laws × 10)
- Storage: ~10GB for embeddings, ~3GB for HNSW index
- **Content-type-specific chunking (PRD Story 2.10):**
  - **SFS laws:** Chunk by § (section), preserve chapter context, max 500 tokens, 50-token overlap
  - **Court cases:** Chunk by semantic section (Facts, Analysis, Conclusion), max 800 tokens
  - **EU regulations/directives:** Chunk by article, preserve preamble/recitals, max 500 tokens
- **Metadata usage:** Enables precise citation display (e.g., "Arbetsmiljölagen Kapitel 5 § 3") and filtering chunks by document section

---

## 4.12 LawList

**Purpose:** User-created collections of laws (e.g., "GDPR Compliance Checklist", "Q1 2025 Review"). Separate from main workspace law list.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `name`: string
- `description`: string | null
- `created_by`: UUID - FK to User
- `created_at`: DateTime
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
interface LawList {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_by: string
  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Has many `LegalDocument` (via `LawListItem` join table)

---

## 4.13 LawListItem (Join Table)

**Purpose:** Many-to-many relationship between law lists and legal documents.

**Key Attributes:**

- `id`: UUID
- `law_list_id`: UUID - FK to LawList
- `law_id`: UUID - FK to LegalDocument
- `position`: float - Sort order
- `added_at`: DateTime

**TypeScript Interface:**

```typescript
interface LawListItem {
  id: string
  law_list_id: string
  law_id: string
  position: number
  added_at: Date
}
```

**Design Decisions:**

- Composite unique index on `(law_list_id, law_id)`

---

## 4.14 LawInWorkspace ⭐ **CRITICAL - This is the Kanban card!**

**Purpose:** Represents laws in a workspace's compliance tracking system. Each law has status (Kanban column), priority, assigned employees, notes, and tasks. This is what appears on the Kanban board - NOT a generic "ComplianceItem".

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `law_id`: UUID - FK to LegalDocument
- `status`: enum - "NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLIANT" (5 Kanban columns)
- `priority`: enum - "LOW", "MEDIUM", "HIGH"
- `assigned_employee_ids`: UUID[] - Array of Employee IDs
- `due_date`: Date | null
- `notes`: TEXT | null - Markdown notes
- `tags`: string[] - Custom tags
- `position`: float - Sort order within Kanban column
- `ai_commentary`: TEXT | null - Personalized explanation from onboarding AI
- `category`: string | null - "Grundläggande", "Arbetsmiljö", "Branschspecifika", etc.
- `added_at`: DateTime - When added to workspace
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
type LawStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REVIEW'
  | 'COMPLIANT'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

interface LawInWorkspace {
  id: string
  workspace_id: string
  law_id: string // FK to LegalDocument
  status: LawStatus
  priority: Priority
  assigned_employee_ids: string[] // Array of Employee UUIDs
  due_date: Date | null
  notes: string | null
  tags: string[]
  position: number // Float for drag-and-drop
  ai_commentary: string | null
  category: string | null
  added_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Belongs to one `LegalDocument`
- References many `Employee` (via assigned_employee_ids array)
- Has many `LawTask` (sub-tasks)

**Design Decisions:**

- **This is THE Kanban card entity** (PRD lines 2863-2899)
- Composite unique index on `(workspace_id, law_id)` - each law appears once per workspace
- Index on `(workspace_id, status, position)` for fast Kanban board queries
- `position` is float (allows inserting between cards: 1.0, 2.0, 1.5)
- `assigned_employee_ids` as UUID array (no join table needed for simple many-to-many)
- `ai_commentary` populated during onboarding Phase 1/2 (e.g., "Gäller eftersom ni har 12 anställda")
- `category` assigned during onboarding for grouping laws in dashboard

**Example:**

```typescript
{
  workspace_id: "ws-123",
  law_id: "law-456", // Arbetsmiljölagen (SFS 1977:1160)
  status: "IN_PROGRESS",
  priority: "HIGH",
  assigned_employee_ids: ["emp-789", "emp-012"],
  due_date: "2025-03-31",
  notes: "Need to update employee handbook section 5.2",
  tags: ["arbetsmiljö", "q1-2025"],
  position: 2.5,
  ai_commentary: "Gäller eftersom ni har 12 anställda och arbetar med farliga maskiner",
  category: "Arbetsmiljö"
}
```

---

## 4.15 LawTask

**Purpose:** Sub-tasks within law cards. Breaks down compliance into actionable steps. Per PRD Story 6.4 line 2917.

**Key Attributes:**

- `id`: UUID
- `law_in_workspace_id`: UUID - FK to LawInWorkspace
- `workspace_id`: UUID - FK to Workspace
- `title`: string - Task description
- `description`: TEXT | null - Details
- `assigned_to`: UUID | null - FK to User
- `due_date`: Date | null
- `completed`: boolean
- `completed_at`: DateTime | null
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
interface LawTask {
  id: string
  law_in_workspace_id: string
  workspace_id: string
  title: string
  description: string | null
  assigned_to: string | null // FK to User
  due_date: Date | null
  completed: boolean
  completed_at: Date | null
  created_at: Date
}
```

**Relationships:**

- Belongs to one `LawInWorkspace`
- Belongs to one `Workspace`
- Optionally assigned to one `User`

**Design Decisions:**

- Index on `(law_in_workspace_id, completed)` for task progress queries
- Task completion percentage shown on Kanban card: "3/5 tasks complete"
- Overdue tasks (due_date < now() AND completed = false) highlighted red in UI

**Example:**

```typescript
{
  law_in_workspace_id: "liw-123", // Arbetsmiljölagen
  title: "Update employee handbook Section 5.2",
  description: "Add new safety protocols for machinery operation",
  assigned_to: "user-456",
  due_date: "2025-02-28",
  completed: false
}
```

---

## 4.16 AIChatMessage

**Purpose:** Stores chat history for RAG conversations. Each workspace has isolated chat threads.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `user_id`: UUID - FK to User
- `role`: enum - "USER", "ASSISTANT", "SYSTEM"
- `content`: string - Message text
- `retrieved_law_ids`: UUID[] | null - Laws used for RAG context
- `cost_usd`: float | null - OpenAI API cost
- `latency_ms`: integer | null - RAG end-to-end latency
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
type ChatRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

interface AIChatMessage {
  id: string
  workspace_id: string
  user_id: string
  role: ChatRole
  content: string
  retrieved_law_ids: string[] | null
  cost_usd: number | null
  latency_ms: number | null
  created_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Belongs to one `User`
- References many `LegalDocument` (via retrieved_law_ids)

**Design Decisions:**

- Index on `(workspace_id, created_at DESC)` for fetching recent messages
- `retrieved_law_ids` enables "View source laws" feature
- Privacy: Never log query content in Sentry (only length, cost, latency)

---

## 4.17 Subscription

**Purpose:** Stripe billing integration. One subscription per workspace.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace (unique)
- `stripe_customer_id`: string
- `stripe_subscription_id`: string | null
- `status`: enum - "ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "UNPAID"
- `plan`: enum - "FREE", "SOLO", "TEAM", "ENTERPRISE"
- `billing_interval`: enum - "MONTHLY", "YEARLY"
- `current_period_start`: Date
- `current_period_end`: Date
- `cancel_at`: Date | null
- `trial_end`: Date | null
- `created_at`: DateTime
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
type BillingInterval = 'MONTHLY' | 'YEARLY'

interface Subscription {
  id: string
  workspace_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  plan: SubscriptionTier // Reuse from Workspace
  billing_interval: BillingInterval
  current_period_start: Date
  current_period_end: Date
  cancel_at: Date | null
  trial_end: Date | null
  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace` (one-to-one)

**Design Decisions:**

- `stripe_customer_id` always present (created on signup, even FREE tier)
- `stripe_subscription_id` null for FREE tier
- Status synced via Stripe webhooks

---

## 4.18 WorkspaceUsage

**Purpose:** Tracks usage limits per subscription tier (AI queries, employees, storage). Per PRD Story 5.6 line 2633.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace (unique)
- `ai_queries_this_month`: integer - Resets monthly
- `ai_queries_total`: integer - Lifetime counter
- `employee_count`: integer - Current active employees
- `storage_used_mb`: integer - File storage consumed
- `last_reset_at`: DateTime - Last monthly reset
- `created_at`: DateTime
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
interface WorkspaceUsage {
  id: string
  workspace_id: string
  ai_queries_this_month: number
  ai_queries_total: number
  employee_count: number
  storage_used_mb: number
  last_reset_at: Date
  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace` (one-to-one)

**Design Decisions:**

- Unique index on `workspace_id`
- Cron job resets `ai_queries_this_month` on 1st of month
- Middleware checks usage before allowing actions (add employee, send AI query, upload file)
- Tier limits defined in code:
  - SOLO: 50 AI queries/month, 5 employees, 1GB storage
  - TEAM: 500 AI queries/month, 50 employees, 10GB storage
  - ENTERPRISE: Unlimited

---

## 4.19 WorkspaceInvitation

**Purpose:** Team invite tokens with 7-day expiry. Per PRD Story 5.3 lines 2591-2597.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `email`: string - Invitee email
- `role`: enum - WorkspaceRole (what role they'll have when they join)
- `token`: string - Unique token (UUID, sent in invite link)
- `invited_by`: UUID - FK to User
- `status`: enum - "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"
- `created_at`: DateTime
- `expires_at`: DateTime - 7 days from creation

**TypeScript Interface:**

```typescript
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  role: WorkspaceRole
  token: string // UUID
  invited_by: string
  status: InvitationStatus
  created_at: Date
  expires_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Invited by one `User`

**Design Decisions:**

- Unique index on `token` for fast lookup (`/invite/{token}`)
- Cron job marks expired invites as EXPIRED daily
- Auto-deleted after 30 days (keep 30 days for audit trail)

---

## 4.20 WorkspaceAuditLog

**Purpose:** Activity logs for Enterprise tier (FR31). Tracks who did what and when.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `user_id`: UUID - FK to User
- `action_type`: enum - "LAW_REVIEWED", "EMPLOYEE_ADDED", "EMPLOYEE_DELETED", "MEMBER_INVITED", "SETTINGS_CHANGED", etc.
- `resource_type`: string - "Law", "Employee", "User", etc.
- `resource_id`: UUID | null - ID of affected resource
- `details`: JSONB | null - Additional context
- `timestamp`: DateTime

**TypeScript Interface:**

```typescript
type AuditAction =
  | 'LAW_REVIEWED'
  | 'EMPLOYEE_ADDED'
  | 'EMPLOYEE_EDITED'
  | 'EMPLOYEE_DELETED'
  | 'MEMBER_INVITED'
  | 'MEMBER_REMOVED'
  | 'SETTINGS_CHANGED'

interface WorkspaceAuditLog {
  id: string
  workspace_id: string
  user_id: string
  action_type: AuditAction
  resource_type: string
  resource_id: string | null
  details: Record<string, any> | null
  timestamp: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Belongs to one `User`

**Design Decisions:**

- Index on `(workspace_id, timestamp DESC)` for activity feed
- Only created for Enterprise tier workspaces (check tier before logging)
- Powers "Recent Activity" feed on Dashboard

---

## 4.21 Employee

**Purpose:** Individual employees within a workspace. Tracks employment details and compliance status.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `employee_number`: string | null
- `first_name`: string
- `last_name`: string
- `email`: string | null
- `personnummer_encrypted`: string | null - AES-256 encrypted
- `phone`: string | null
- `employment_date`: Date
- `employment_end_date`: Date | null
- `employment_type`: enum - "FULL_TIME", "PART_TIME", "TEMPORARY", "CONSULTANT", "INTERN"
- `contract_type`: enum - "PERMANENT", "FIXED_TERM", "PROJECT_BASED"
- `role`: string - Job title (free text)
- `role_standardized`: string | null - GPT-4 fuzzy matched enum
- `department_id`: UUID | null - FK to Department
- `manager_id`: UUID | null - FK to Employee (self-reference)
- `work_percentage`: integer - 100 for full-time
- `compliance_status`: enum - "COMPLIANT", "NEEDS_ATTENTION", "NON_COMPLIANT"
- `fortnox_employee_id`: string | null - Future integration
- `created_at`: DateTime
- `updated_at`: DateTime

**TypeScript Interface:**

```typescript
type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'TEMPORARY'
  | 'CONSULTANT'
  | 'INTERN'
type ContractType = 'PERMANENT' | 'FIXED_TERM' | 'PROJECT_BASED'
type ComplianceStatus = 'COMPLIANT' | 'NEEDS_ATTENTION' | 'NON_COMPLIANT'

interface Employee {
  id: string
  workspace_id: string
  employee_number: string | null
  first_name: string
  last_name: string
  email: string | null
  personnummer_encrypted: string | null // AES-256
  phone: string | null
  employment_date: Date
  employment_end_date: Date | null
  employment_type: EmploymentType
  contract_type: ContractType
  role: string
  role_standardized: string | null
  department_id: string | null
  manager_id: string | null // Self-reference
  work_percentage: number
  compliance_status: ComplianceStatus
  fortnox_employee_id: string | null
  created_at: Date
  updated_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Optionally belongs to one `Department`
- Optionally reports to one `Employee` (manager_id)
- Has many `Employee` (direct reports)
- Has many `EmployeeDocument`
- Belongs to many `Kollektivavtal` (via `EmployeeKollektivavtal`)
- Referenced by many `LawInWorkspace` (assigned_employee_ids array)

**Design Decisions:**

- **Personnummer encryption:** AES-256 with keys in environment variables (NFR4)
- Never sent to OpenAI API or logged
- `compliance_status` calculated daily by background job
- `role_standardized` enables compliance rule matching (GPT-4 fuzzy matches "Builder" → "CONSTRUCTION_WORKER")

---

## 4.22 Department

**Purpose:** Organizational structure grouping employees.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `name`: string
- `description`: string | null
- `manager_id`: UUID | null - FK to Employee
- `parent_department_id`: UUID | null - Self-reference for hierarchy
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
interface Department {
  id: string
  workspace_id: string
  name: string
  description: string | null
  manager_id: string | null
  parent_department_id: string | null
  created_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Has one `Employee` as manager
- Has many `Employee`
- Optionally belongs to one `Department` (parent)

---

## 4.23 EmployeeDocument

**Purpose:** Metadata for employee-related documents (contracts, certificates, ID copies). Files in Supabase Storage.

**Key Attributes:**

- `id`: UUID
- `employee_id`: UUID - FK to Employee
- `workspace_id`: UUID - FK to Workspace
- `document_type`: enum - "CONTRACT", "ID_COPY", "CERTIFICATE", "INSURANCE", "TRAINING", "OTHER"
- `title`: string
- `file_url`: string - Supabase Storage URL
- `file_size_bytes`: integer
- `mime_type`: string
- `issued_date`: Date | null
- `expiry_date`: Date | null
- `status`: enum - "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED"
- `uploaded_by`: UUID - FK to User
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
type DocumentType =
  | 'CONTRACT'
  | 'ID_COPY'
  | 'CERTIFICATE'
  | 'INSURANCE'
  | 'TRAINING'
  | 'OTHER'
type DocumentStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

interface EmployeeDocument {
  id: string
  employee_id: string
  workspace_id: string
  document_type: DocumentType
  title: string
  file_url: string
  file_size_bytes: number
  mime_type: string
  issued_date: Date | null
  expiry_date: Date | null
  status: DocumentStatus
  uploaded_by: string
  created_at: Date
}
```

**Relationships:**

- Belongs to one `Employee`
- Belongs to one `Workspace`
- Uploaded by one `User`

**Design Decisions:**

- Files at `{workspace_id}/employees/{employee_id}/documents/{uuid}.pdf`
- `expiry_date` triggers daily cron job to mark EXPIRED

---

## 4.24 Kollektivavtal

**Purpose:** Collective bargaining agreements (PDFs) with RAG embeddings.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `name`: string
- `union_name`: string | null
- `agreement_type`: enum - "ARBETARE", "TJANSTEMAN", "MIXED"
- `file_url`: string
- `file_size_bytes`: integer
- `valid_from`: Date
- `valid_until`: Date | null
- `embedding_status`: enum - "PENDING", "PROCESSING", "COMPLETED", "FAILED"
- `uploaded_by`: UUID - FK to User
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
type AgreementType = 'ARBETARE' | 'TJANSTEMAN' | 'MIXED'

interface Kollektivavtal {
  id: string
  workspace_id: string
  name: string
  union_name: string | null
  agreement_type: AgreementType
  file_url: string
  file_size_bytes: number
  valid_from: Date
  valid_until: Date | null
  embedding_status: EmbeddingStatus
  uploaded_by: string
  created_at: Date
}
```

**Relationships:**

- Belongs to one `Workspace`
- Has many `KollektivavtalEmbedding`
- Assigned to many `Employee` (via `EmployeeKollektivavtal`)

---

## 4.25 EmployeeKollektivavtal (Join Table)

**Purpose:** Links employees to applicable collective agreements.

**Key Attributes:**

- `id`: UUID
- `employee_id`: UUID - FK to Employee
- `kollektivavtal_id`: UUID - FK to Kollektivavtal
- `assigned_at`: DateTime
- `assigned_by`: UUID - FK to User

**TypeScript Interface:**

```typescript
interface EmployeeKollektivavtal {
  id: string
  employee_id: string
  kollektivavtal_id: string
  assigned_at: Date
  assigned_by: string
}
```

**Design Decisions:**

- Composite unique index on `(employee_id, kollektivavtal_id)`

---

## 4.26 KollektivavtalEmbedding

**Purpose:** Vector embeddings for kollektivavtal RAG queries.

**Key Attributes:**

- `id`: UUID
- `kollektivavtal_id`: UUID - FK to Kollektivavtal
- `chunk_index`: integer
- `chunk_text`: string
- `embedding`: number[] - 1536 dimensions
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
interface KollektivavtalEmbedding {
  id: string
  kollektivavtal_id: string
  chunk_index: number
  chunk_text: string
  embedding: number[]
  created_at: Date
}
```

**Relationships:**

- Belongs to one `Kollektivavtal`

**Design Decisions:**

- HNSW index on `embedding`
- RAG queries check both `LawEmbedding` (public) and `KollektivavtalEmbedding` (workspace-specific)

---

## 4.27 ChangeNotification

**Purpose:** Tracks law change alerts sent to users. Powers daily/weekly digests.

**Key Attributes:**

- `id`: UUID
- `workspace_id`: UUID - FK to Workspace
- `law_id`: UUID - FK to LegalDocument
- `notification_type`: enum - "EMAIL_DAILY_DIGEST", "EMAIL_WEEKLY_DIGEST", "IN_APP"
- `digest_batch_id`: UUID | null - Groups notifications into daily/weekly batches
- `change_detected_at`: DateTime
- `change_summary`: string - AI-generated description
- `notification_sent`: boolean
- `notification_sent_at`: DateTime | null
- `read_at`: DateTime | null

**TypeScript Interface:**

```typescript
type NotificationType = 'EMAIL_DAILY_DIGEST' | 'EMAIL_WEEKLY_DIGEST' | 'IN_APP'

interface ChangeNotification {
  id: string
  workspace_id: string
  law_id: string
  notification_type: NotificationType
  digest_batch_id: string | null
  change_detected_at: Date
  change_summary: string
  notification_sent: boolean
  notification_sent_at: Date | null
  read_at: Date | null
}
```

**Relationships:**

- Belongs to one `Workspace`
- References one `LegalDocument`

**Design Decisions:**

- `digest_batch_id` groups multiple changes into single email
- Created by daily cron job comparing `LegalDocument.updated_at`
- Retention: Delete >90 days old

---

## 4.28 LawChangeHistory

**Purpose:** Historical snapshots of law content for diff view. Per FR38 ("show what changed").

**Key Attributes:**

- `id`: UUID
- `law_id`: UUID - FK to LegalDocument
- `changed_at`: DateTime
- `change_type`: enum - "AMENDED", "REPEALED", "METADATA_UPDATE"
- `full_text_snapshot`: TEXT - Complete law text before change
- `diff`: JSONB | null - Structured diff (added/removed sections)
- `detected_by_cron_job_id`: string | null - Which cron job run detected this

**TypeScript Interface:**

```typescript
type ChangeType = 'AMENDED' | 'REPEALED' | 'METADATA_UPDATE'

interface LawChangeHistory {
  id: string
  law_id: string
  changed_at: Date
  change_type: ChangeType
  full_text_snapshot: string
  diff: {
    added_sections?: string[]
    removed_sections?: string[]
    modified_sections?: Array<{ section: string; old: string; new: string }>
  } | null
  detected_by_cron_job_id: string | null
}
```

**Relationships:**

- Belongs to one `LegalDocument`

**Design Decisions:**

- Index on `(law_id, changed_at DESC)` for change timeline
- `full_text_snapshot` stored for exact historical reconstruction
- `diff` JSONB enables "What changed?" UI (Story 8.6)
- Large storage (avg 50KB per snapshot, ~500MB per year assuming 10K laws change)

---

## 4.29 BackgroundJob

**Purpose:** Tracks long-running background operations (Phase 2 law generation, daily change detection, embedding generation, compliance recalculation). Enables progress tracking, retry logic, and job monitoring. Critical for user-facing features like "Kompletterar din laglista... 23/68 lagar" (PRD line 38).

**Key Attributes:**

- `id`: UUID - Primary key
- `job_type`: enum - "PHASE2_LAW_GENERATION", "CHANGE_DETECTION", "EMBEDDING_GENERATION", "COMPLIANCE_RECALC", "KOLLEKTIVAVTAL_EMBEDDING"
- `workspace_id`: UUID | null - FK to Workspace (null for system-wide jobs like change detection)
- `status`: enum - "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"
- `progress_current`: integer - Current progress (e.g., 23 laws generated)
- `progress_total`: integer - Total items (e.g., 68 laws to generate)
- `result_data`: JSONB | null - Job output (e.g., generated law IDs)
- `error_message`: TEXT | null - Failure details
- `started_at`: DateTime | null
- `completed_at`: DateTime | null
- `created_at`: DateTime

**TypeScript Interface:**

```typescript
type JobType =
  | 'PHASE2_LAW_GENERATION'
  | 'CHANGE_DETECTION'
  | 'EMBEDDING_GENERATION'
  | 'COMPLIANCE_RECALC'
  | 'KOLLEKTIVAVTAL_EMBEDDING'

type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface BackgroundJob {
  id: string
  job_type: JobType
  workspace_id: string | null
  status: JobStatus
  progress_current: number
  progress_total: number
  result_data: Record<string, any> | null
  error_message: string | null
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
}
```

**Relationships:**

- Optionally belongs to one `Workspace` (workspace-specific jobs)

**Design Decisions:**

- Indexed on `(workspace_id, status, created_at DESC)` for "my active jobs" queries
- Indexed on `(status, created_at)` for global job queue processing
- **Phase 2 Law Generation:** Created immediately after user signs up, processed by Vercel Cron job every 1 minute
- **Progress tracking:** Updated every 5-10 laws generated, enables real-time UI progress bar
- **Retry logic:** FAILED jobs can be manually retried or auto-retry with exponential backoff
- **Change Detection:** One job per day (scheduled cron), processes all 170K documents
- **Embedding Generation:** Long-running (3-4 hours for initial 170K docs), checkpoint/resume via progress_current
- Retention: Keep COMPLETED jobs for 7 days (audit trail), delete old jobs via cron

**Usage Examples:**

**Phase 2 Law Generation Progress:**

```typescript
// Frontend polls this endpoint every 2 seconds
const job = await prisma.backgroundJob.findFirst({
  where: {
    workspace_id: 'ws-123',
    job_type: 'PHASE2_LAW_GENERATION',
    status: 'RUNNING',
  },
})

if (job) {
  const percentage = Math.round(
    (job.progress_current / job.progress_total) * 100
  )
  // Display: "Kompletterar din laglista... 23/68 lagar (34%)"
}
```

**Creating Phase 2 Job on Signup:**

```typescript
await prisma.backgroundJob.create({
  data: {
    job_type: 'PHASE2_LAW_GENERATION',
    workspace_id: newWorkspace.id,
    status: 'PENDING',
    progress_current: 0,
    progress_total: 68, // Estimated from Phase 1 analysis
    result_data: { phase1_law_ids: [...], target_categories: [...] }
  }
})
```

**Vercel Cron Job Processing Queue:**

```typescript
// api/cron/process-background-jobs/route.ts
const jobs = await prisma.backgroundJob.findMany({
  where: { status: 'PENDING' },
  orderBy: { created_at: 'asc' },
  take: 5, // Process 5 jobs per cron run
})

for (const job of jobs) {
  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', started_at: new Date() },
  })

  try {
    if (job.job_type === 'PHASE2_LAW_GENERATION') {
      await generatePhase2Laws(job)
    }
    // ... other job types

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completed_at: new Date() },
    })
  } catch (error) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        error_message: error.message,
        completed_at: new Date(),
      },
    })
  }
}
```

---
