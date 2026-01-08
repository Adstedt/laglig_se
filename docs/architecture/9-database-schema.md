# 9. Database Schema

## 9.1 Database Overview

Laglig.se uses **PostgreSQL** via **Supabase** with the **pgvector** extension for semantic search capabilities. The complete Prisma schema includes **45+ entities** organized into logical domains supporting all 38 workflows.

**Technology Stack:**

- **Database:** PostgreSQL 15+ (Supabase hosted)
- **ORM:** Prisma 5.x with type-safe queries
- **Vector Search:** pgvector extension for embeddings
- **Migrations:** Prisma Migrate for schema versioning
- **Session Store:** Redis for temporary onboarding sessions

---

## 9.2 Data Model Categories

The database schema is organized into these logical domains:

> **Epic 6 Revision (2026-01-08):** Law Management updated to task-centric compliance workflow.
> LawInWorkspace and LawTask deprecated in favor of LawListItem as compliance tracking unit
> plus new Task, TaskColumn, TaskListItemLink, Comment, Evidence entities.

```
┌─────────────────────────────────────────────────────────┐
│                   Database Domains                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Core Auth           │  6. AI/RAG System              │
│  ├─ User               │  ├─ AIChatSession              │
│  ├─ Lead               │  ├─ AIChatMessage              │
│  └─ Session*           │  ├─ AIChatContext              │
│                        │  └─ LawEmbedding               │
│  2. Workspace/Teams    │                                 │
│  ├─ Workspace          │  7. HR Module                   │
│  ├─ WorkspaceMember    │  ├─ Employee                   │
│  └─ WorkspaceInvite    │  ├─ Department                 │
│                        │  ├─ EmployeeDocument           │
│  3. Legal Content      │  ├─ EmployeeNote               │
│  ├─ LegalDocument      │  ├─ Kollektivavtal             │
│  ├─ LegalCategory      │  └─ EmployeeKollektivavtal     │
│  ├─ CourtCase          │                                 │
│  ├─ CrossReference     │  8. Change Tracking             │
│  └─ Amendment          │  ├─ LawVersionHistory          │
│                        │  ├─ ChangeNotification         │
│  4. Law Management     │  └─ NotificationPreference     │
│  ├─ LawList            │                                 │
│  ├─ LawListItem ★      │  9. Compliance Workflow ★       │
│  ├─ Task ★             │  ├─ Task                       │
│  ├─ TaskColumn ★       │  ├─ TaskColumn                 │
│  ├─ TaskListItemLink ★ │  ├─ TaskListItemLink           │
│  ├─ Comment ★          │  ├─ Comment                    │
│  ├─ Evidence ★         │  ├─ Evidence                   │
│  └─ ActivityLog ★      │  └─ ActivityLog                │
│                        │                                 │
│  5. Analytics          │  10. Notifications ★            │
│  ├─ OnboardingSession  │  ├─ Notification               │
│  └─ WorkspaceAuditLog  │  └─ NotificationPreference     │
│                        │                                 │
│                        │  11. Background Jobs            │
│                        │  └─ BackgroundJob              │
│                        │                                 │
│                        │  12. Billing/Usage             │
│                        │  ├─ Subscription               │
│                        │  ├─ WorkspaceUsage             │
│                        │  └─ UnitEconomics              │
│                                                           │
│  ★ = New/Updated for Epic 6                              │
│  * = Redis-based, not in PostgreSQL                      │
└─────────────────────────────────────────────────────────┘
```

---

## 9.3 User & Authentication Entities

### 9.3.1 User Model

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  name              String?
  avatar_url        String?
  password_hash     String?  // NULL for SSO users
  email_verified    Boolean  @default(false)
  created_at        DateTime @default(now())
  last_login_at     DateTime?

  // Relations
  workspace_members WorkspaceMember[]
  owned_workspaces  Workspace[]       @relation("WorkspaceOwner")
  chat_messages     AIChatMessage[]
  chat_sessions     AIChatSession[]   @relation("SessionCreator")
  created_law_lists LawList[]
  audit_logs        WorkspaceAuditLog[]
  notification_prefs NotificationPreference[]
  employee_notes    EmployeeNote[]    @relation("NoteAuthor")

  // Epic 6: Compliance workflow relations
  assigned_tasks    Task[]            @relation("TaskAssignee")
  created_tasks     Task[]            @relation("TaskCreator")
  responsible_items LawListItem[]     @relation("ResponsibleUser")
  comments          Comment[]
  evidence          Evidence[]
  notifications     Notification[]
  activity_logs     ActivityLog[]

  @@index([email])
  @@map("users")
}
```

### 9.3.2 Lead Capture Model

```prisma
model Lead {
  id               String   @id @default(uuid())
  email            String   @unique
  session_id       String   // Links to Redis session

  // Company data snapshot
  org_number       String?
  company_name     String?
  sni_code         String?
  website_url      String?
  website_analysis Json?    // AI segmentation results
  session_data     Json     // Full session snapshot

  // Marketing
  source           String   // 'widget_trial', 'demo_request', etc.
  utm_source       String?
  utm_campaign     String?
  marketing_consent Boolean @default(false)

  // Conversion tracking
  created_at       DateTime @default(now())
  converted_at     DateTime?
  converted_user_id String?

  @@index([email])
  @@index([session_id])
  @@index([created_at])
  @@map("leads")
}
```

---

## 9.4 Workspace & Team Management

### 9.4.1 Workspace Model

```prisma
model Workspace {
  id               String   @id @default(uuid())
  name             String
  slug             String   @unique
  owner_id         String

  // Company enrichment
  org_number       String?
  company_name     String?
  sni_code         String?
  website_url      String?

  // Onboarding context (website analysis + answers)
  onboarding_context Json?  // Stores all personalization data

  // Subscription
  subscription_tier SubscriptionTier @default(FREE)
  trial_ends_at    DateTime?
  status           WorkspaceStatus  @default(ACTIVE)

  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  // Relations
  owner            User              @relation("WorkspaceOwner", fields: [owner_id], references: [id])
  members          WorkspaceMember[]
  invitations      WorkspaceInvite[]
  law_lists        LawList[]
  employees        Employee[]
  departments      Department[]
  kollektivavtal   Kollektivavtal[]
  chat_sessions    AIChatSession[]
  change_notifications ChangeNotification[]
  notification_preferences NotificationPreference[]
  audit_logs       WorkspaceAuditLog[]
  usage_records    WorkspaceUsage[]
  unit_economics   UnitEconomics[]
  subscription     Subscription?
  background_jobs  BackgroundJob[]

  // Epic 6: Compliance workflow relations
  tasks            Task[]
  task_columns     TaskColumn[]
  comments         Comment[]
  evidence         Evidence[]
  notifications    Notification[]
  activity_logs    ActivityLog[]

  @@index([slug])
  @@index([owner_id])
  @@index([status])
  @@map("workspaces")
}

enum WorkspaceStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum SubscriptionTier {
  FREE
  SOLO      // 1 user, 100 laws
  TEAM      // 5 users, 500 laws
  ENTERPRISE // Unlimited
}
```

### 9.4.2 Team Membership

```prisma
model WorkspaceMember {
  id           String          @id @default(uuid())
  workspace_id String
  user_id      String
  role         WorkspaceRole
  joined_at    DateTime        @default(now())

  // Relations
  workspace    Workspace       @relation(fields: [workspace_id], references: [id])
  user         User            @relation(fields: [user_id], references: [id])

  @@unique([workspace_id, user_id])
  @@index([workspace_id])
  @@index([user_id])
  @@map("workspace_members")
}

enum WorkspaceRole {
  OWNER
  ADMIN
  HR_MANAGER
  MEMBER
  AUDITOR
}

model WorkspaceInvite {
  id           String   @id @default(uuid())
  workspace_id String
  email        String
  role         WorkspaceRole
  token        String   @unique
  expires_at   DateTime
  created_at   DateTime @default(now())
  accepted_at  DateTime?

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id])

  @@index([token])
  @@index([email])
  @@map("workspace_invites")
}
```

---

## 9.5 Legal Content Management

### 9.5.1 Legal Document Model

```prisma
model LegalDocument {
  id                String   @id @default(uuid())
  document_number   String   @unique // "SFS 1977:1160"
  title             String
  content_type      ContentType

  // Content
  full_text         String?  @db.Text
  summary           String?  @db.Text // AI-generated
  summary_updated_at DateTime?

  // Metadata
  metadata          Json?    // Flexible API response storage
  effective_date    DateTime?
  published_date    DateTime?
  last_updated      DateTime?
  status            LawStatus @default(ACTIVE)

  // Search optimization
  search_vector     Unsupported("tsvector")?

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relations
  laws_in_workspaces LawInWorkspace[]
  law_list_items    LawListItem[]
  embeddings        LawEmbedding[]
  versions          LawVersionHistory[]
  amendments        Amendment[]      @relation("AmendedLaw")
  amending_laws     Amendment[]      @relation("AmendingLaw")
  cross_references_from CrossReference[] @relation("FromDocument")
  cross_references_to   CrossReference[] @relation("ToDocument")
  change_notifications ChangeNotification[]

  @@index([document_number])
  @@index([content_type])
  @@index([status])
  @@index([search_vector])
  @@map("legal_documents")
}

enum ContentType {
  SFS_LAW
  COURT_CASE_AD  // Arbetsdomstolen (Priority #1)
  COURT_CASE_HD
  COURT_CASE_HFD
  COURT_CASE_HOVR
  EU_REGULATION
  EU_DIRECTIVE
}

enum LawStatus {
  ACTIVE
  REPEALED
  DRAFT
  ARCHIVED
}
```

### 9.5.2 Cross-References

```prisma
model CrossReference {
  id              String   @id @default(uuid())
  from_document_id String
  to_document_id   String
  reference_type  ReferenceType
  context         String?  @db.Text // Snippet showing reference

  // Relations
  from_document   LegalDocument @relation("FromDocument", fields: [from_document_id], references: [id])
  to_document     LegalDocument @relation("ToDocument", fields: [to_document_id], references: [id])

  @@index([from_document_id])
  @@index([to_document_id])
  @@map("cross_references")
}

enum ReferenceType {
  CITES           // Court case cites law
  IMPLEMENTS      // Law implements EU directive
  AMENDS          // Law amends another law
  REFERENCES      // General reference
  RELATED         // Semantically related
}
```

### 9.5.3 Amendment Tracking

```prisma
model Amendment {
  id              String   @id @default(uuid())
  amended_law_id  String   // The law being amended
  amending_law_id String   // The law doing the amending
  effective_date  DateTime
  description     String?  @db.Text
  sections_affected Json?  // Array of section numbers

  // Relations
  amended_law     LegalDocument @relation("AmendedLaw", fields: [amended_law_id], references: [id])
  amending_law    LegalDocument @relation("AmendingLaw", fields: [amending_law_id], references: [id])

  @@index([amended_law_id])
  @@index([amending_law_id])
  @@index([effective_date])
  @@map("amendments")
}
```

---

## 9.6 Law Management in Workspaces

### 9.6.1 Law Lists

```prisma
model LawList {
  id           String   @id @default(uuid())
  workspace_id String
  name         String
  description  String?
  created_by   String
  is_default   Boolean  @default(false)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  // Relations
  workspace    Workspace      @relation(fields: [workspace_id], references: [id])
  creator      User           @relation(fields: [created_by], references: [id])
  items        LawListItem[]

  @@index([workspace_id])
  @@index([created_by])
  @@map("law_lists")
}

// Epic 6 Revision: LawListItem is now the compliance tracking unit
// Each list item represents independent compliance tracking for a law on a specific list
model LawListItem {
  id                  String           @id @default(uuid())
  law_list_id         String
  legal_document_id   String
  position            Int              // For ordering in list

  // Compliance tracking (Epic 6)
  compliance_status   ComplianceStatus @default(EJ_PABORJAD)
  responsible_user_id String?          // Assigned responsible person
  business_context    String?          @db.Text  // Why this law matters
  due_date            DateTime?        // Compliance deadline
  ai_commentary       String?          @db.Text  // AI-generated analysis
  category            String?          // Custom categorization

  added_at            DateTime         @default(now())
  updated_at          DateTime         @updatedAt

  // Relations
  law_list            LawList          @relation(fields: [law_list_id], references: [id], onDelete: Cascade)
  legal_document      LegalDocument    @relation(fields: [legal_document_id], references: [id])
  responsible_user    User?            @relation("ResponsibleUser", fields: [responsible_user_id], references: [id])
  task_links          TaskListItemLink[]  // Tasks linked to this list item
  evidence            Evidence[]          // Evidence attached directly
  comments            Comment[]           // Comments on this list item

  @@unique([law_list_id, legal_document_id])
  @@index([law_list_id])
  @@index([legal_document_id])
  @@index([compliance_status])
  @@index([responsible_user_id])
  @@map("law_list_items")
}

// Swedish compliance statuses
enum ComplianceStatus {
  EJ_PABORJAD    // Not started (gray)
  PAGAENDE       // In progress (blue)
  UPPFYLLD       // Compliant (green)
  EJ_UPPFYLLD    // Non-compliant (red)
  EJ_TILLAMPLIG  // Not applicable (gray, strikethrough)
}
```

### 9.6.2 ~~Kanban Board~~ (DEPRECATED)

> **⚠️ DEPRECATED (Epic 6):** LawInWorkspace replaced by LawListItem as compliance tracking unit.
> Compliance status now tracked per list item, not per law-in-workspace.
> **Migration:** Move status/notes to LawListItem, delete LawInWorkspace records.

```prisma
// DEPRECATED - Do not use in new code
// model LawInWorkspace { ... }
// enum KanbanStatus { ... }
```

### 9.6.2.1 Priority Enum (Retained)

```prisma
enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 9.6.3 ~~Task Management~~ (DEPRECATED)

> **⚠️ DEPRECATED (Epic 6):** LawTask replaced by Task entity with Kanban workflow.
> Tasks are now first-class entities linked to LawListItems via TaskListItemLink.
> **Migration:** Convert LawTask to Task, create TaskListItemLink for each relation.

```prisma
// DEPRECATED - Do not use in new code
// model LawTask { ... }
```

### 9.6.4 Task Columns (Epic 6)

> **Epic 6 Revision:** Replaced JSON-based KanbanConfig with proper TaskColumn entity
> for user-customizable Kanban columns. Maximum 8 columns per workspace.

```prisma
model TaskColumn {
  id           String   @id @default(uuid())
  workspace_id String
  name         String   // "Att göra", "Pågående", "Klar", etc.
  color        String   // Hex color code
  position     Int      // Column order (0-7)
  is_default   Boolean  @default(false)  // System-provided column
  is_done      Boolean  @default(false)  // Tasks here count as completed

  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  tasks        Task[]

  @@unique([workspace_id, position])
  @@index([workspace_id])
  @@map("task_columns")
}

// Default columns created for new workspaces:
// 1. "Att göra" (To Do) - position: 0, color: #6B7280 (gray)
// 2. "Pågående" (In Progress) - position: 1, color: #3B82F6 (blue)
// 3. "Klar" (Done) - position: 2, color: #22C55E (green), is_done: true
```

---

## 9.7 AI & RAG System

### 9.7.1 Chat Sessions

```prisma
model AIChatSession {
  id           String   @id @default(uuid())
  workspace_id String
  user_id      String
  title        String?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  // Relations
  workspace    Workspace       @relation(fields: [workspace_id], references: [id])
  creator      User           @relation("SessionCreator", fields: [user_id], references: [id])
  messages     AIChatMessage[]
  context      AIChatContext[]

  @@index([workspace_id])
  @@index([user_id])
  @@map("ai_chat_sessions")
}
```

### 9.7.2 Chat Messages

```prisma
model AIChatMessage {
  id           String   @id @default(uuid())
  session_id   String
  user_id      String?  // NULL for AI messages
  role         MessageRole
  content      String   @db.Text
  metadata     Json?    // Token usage, model, etc.
  created_at   DateTime @default(now())

  // Relations
  session      AIChatSession  @relation(fields: [session_id], references: [id])
  user         User?         @relation(fields: [user_id], references: [id])

  @@index([session_id, created_at])
  @@index([user_id])
  @@map("ai_chat_messages")
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}
```

### 9.7.3 Drag-and-Drop Context

```prisma
model AIChatContext {
  id           String         @id @default(uuid())
  session_id   String
  context_type ContextType
  context_id   String         // ID of law/employee/document
  context_data Json          // Cached data for performance
  position     Int           // Order in context panel
  added_at     DateTime      @default(now())

  // Relations
  session      AIChatSession  @relation(fields: [session_id], references: [id])

  @@index([session_id])
  @@map("ai_chat_context")
}

enum ContextType {
  LAW_CARD
  EMPLOYEE_CARD
  TASK_CARD
  DOCUMENT
  KOLLEKTIVAVTAL
}
```

### 9.7.4 Vector Embeddings

```prisma
model LawEmbedding {
  id                String   @id @default(uuid())
  legal_document_id String
  chunk_index       Int      // Position in document
  chunk_text        String   @db.Text
  embedding         Unsupported("vector(1536)")
  created_at        DateTime @default(now())

  // Relations
  legal_document    LegalDocument @relation(fields: [legal_document_id], references: [id])

  @@index([legal_document_id, chunk_index])
  @@map("law_embeddings")
}
```

---

## 9.8 HR Module

### 9.8.1 Employee Management

```prisma
model Employee {
  id                String   @id @default(uuid())
  workspace_id      String
  personnummer      String?  @db.Text // Encrypted
  first_name        String
  last_name         String
  email             String?
  phone             String?
  photo_url         String?

  // Employment details
  employment_date   DateTime
  contract_type     ContractType
  role              String
  department_id     String?
  manager_id        String?

  // Status
  status            EmployeeStatus @default(ACTIVE)
  offboarded_at     DateTime?
  last_working_day  DateTime?

  // Compliance
  compliance_status ComplianceStatus @default(NEEDS_ATTENTION)
  compliance_score  Int?     // 0-100

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relations
  workspace         Workspace      @relation(fields: [workspace_id], references: [id])
  department        Department?    @relation(fields: [department_id], references: [id])
  manager           Employee?      @relation("EmployeeManager", fields: [manager_id], references: [id])
  subordinates      Employee[]     @relation("EmployeeManager")
  documents         EmployeeDocument[]
  kollektivavtal    EmployeeKollektivavtal[]
  notes             EmployeeNote[]

  @@index([workspace_id])
  @@index([department_id])
  @@index([status])
  @@map("employees")
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
  ON_LEAVE
  OFFBOARDED
}

enum ContractType {
  PERMANENT
  TEMPORARY
  CONSULTANT
  INTERN
}

enum ComplianceStatus {
  COMPLIANT
  NEEDS_ATTENTION
  NON_COMPLIANT
}
```

### 9.8.2 Departments

```prisma
model Department {
  id           String   @id @default(uuid())
  workspace_id String
  name         String
  parent_id    String?  // For hierarchical structure
  manager_id   String?
  created_at   DateTime @default(now())

  // Relations
  workspace    Workspace    @relation(fields: [workspace_id], references: [id])
  parent       Department?  @relation("DepartmentHierarchy", fields: [parent_id], references: [id])
  children     Department[] @relation("DepartmentHierarchy")
  employees    Employee[]

  @@index([workspace_id])
  @@map("departments")
}
```

### 9.8.3 Employee Documents

```prisma
model EmployeeDocument {
  id           String   @id @default(uuid())
  employee_id  String
  name         String
  type         DocumentType
  file_url     String
  uploaded_by  String
  uploaded_at  DateTime @default(now())

  // Relations
  employee     Employee @relation(fields: [employee_id], references: [id])

  @@index([employee_id])
  @@map("employee_documents")
}

enum DocumentType {
  CONTRACT
  ID_DOCUMENT
  CERTIFICATE
  POLICY
  OTHER
}
```

### 9.8.4 Employee Notes

```prisma
model EmployeeNote {
  id           String   @id @default(uuid())
  employee_id  String
  author_id    String
  content      String   @db.Text
  mentions     String[] // User IDs mentioned with @
  is_private   Boolean  @default(false)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  // Relations
  employee     Employee @relation(fields: [employee_id], references: [id])
  author       User     @relation("NoteAuthor", fields: [author_id], references: [id])

  @@index([employee_id])
  @@index([author_id])
  @@map("employee_notes")
}
```

### 9.8.5 Collective Agreements

```prisma
model Kollektivavtal {
  id           String   @id @default(uuid())
  workspace_id String
  name         String
  description  String?  @db.Text
  file_url     String?
  effective_date DateTime
  expiry_date  DateTime?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id])
  employees    EmployeeKollektivavtal[]

  @@index([workspace_id])
  @@map("kollektivavtal")
}

model EmployeeKollektivavtal {
  id                String   @id @default(uuid())
  employee_id       String
  kollektivavtal_id String
  assigned_at       DateTime @default(now())

  // Relations
  employee          Employee       @relation(fields: [employee_id], references: [id])
  kollektivavtal    Kollektivavtal @relation(fields: [kollektivavtal_id], references: [id])

  @@unique([employee_id, kollektivavtal_id])
  @@map("employee_kollektivavtal")
}
```

---

## 9.9 Change Tracking & Notifications

### 9.9.1 Law Version History

```prisma
model LawVersionHistory {
  id                String   @id @default(uuid())
  legal_document_id String
  version_number    String   // "2024-01-15"

  // Content snapshot
  full_text         String   @db.Text
  summary           String?  @db.Text

  // Change details
  changed_sections  Json?    // Array of section changes
  change_summary    String?  @db.Text

  effective_date    DateTime
  detected_at       DateTime @default(now())

  // Relations
  legal_document    LegalDocument @relation(fields: [legal_document_id], references: [id])

  @@index([legal_document_id])
  @@index([effective_date])
  @@map("law_version_history")
}
```

### 9.9.2 Change Notifications

```prisma
model ChangeNotification {
  id                String   @id @default(uuid())
  workspace_id      String
  legal_document_id String
  change_type       ChangeType

  // Change details
  old_version       String?  @db.Text
  new_version       String?  @db.Text
  diff_html         String?  @db.Text  // GitHub-style diff

  // AI analysis
  ai_summary        String?  @db.Text
  business_impact   String?  @db.Text
  priority          Priority

  // Status
  detected_at       DateTime @default(now())
  reviewed_at       DateTime?
  reviewed_by       String?
  dismissed         Boolean  @default(false)

  // Relations
  workspace         Workspace     @relation(fields: [workspace_id], references: [id])
  legal_document    LegalDocument @relation(fields: [legal_document_id], references: [id])

  @@index([workspace_id, reviewed_at])
  @@index([legal_document_id])
  @@map("change_notifications")
}

enum ChangeType {
  NEW_LAW
  AMENDMENT
  REPEAL
  COURT_CASE
  EU_UPDATE
}
```

### 9.9.3 Notification Preferences

```prisma
model NotificationPreference {
  id           String   @id @default(uuid())
  user_id      String
  workspace_id String

  // Global settings
  daily_digest      Boolean @default(true)
  weekly_summary    Boolean @default(false)
  instant_critical  Boolean @default(false)

  // Channels
  email_enabled     Boolean @default(true)
  sms_enabled       Boolean @default(false)
  push_enabled      Boolean @default(false)

  // Per law list settings
  law_list_settings Json?   // {listId: {enabled: true, priority: "HIGH"}}

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relations
  user              User      @relation(fields: [user_id], references: [id])
  workspace         Workspace @relation(fields: [workspace_id], references: [id])

  @@unique([user_id, workspace_id])
  @@map("notification_preferences")
}
```

---

## 9.10 Analytics & Monitoring

### 9.10.1 Onboarding Analytics

```prisma
model OnboardingSession {
  id               String   @id @default(uuid())
  session_id       String   @unique // Redis session ID

  // Company data
  org_number       String?
  company_name     String?
  website_url      String?
  website_analysis Json?    // AI analysis results

  // Progress tracking
  questions_answered Json?
  laws_generated     String[]

  // Conversion
  email_captured     String?
  converted_to_user  String?

  // Analytics
  started_at         DateTime @default(now())
  completed_at       DateTime?
  time_to_email      Int?     // Seconds
  time_to_signup     Int?     // Seconds

  // Attribution
  utm_source         String?
  utm_campaign       String?
  referrer           String?

  @@index([started_at])
  @@index([email_captured])
  @@map("onboarding_sessions")
}
```

### 9.10.2 Audit Logging

```prisma
model WorkspaceAuditLog {
  id           String   @id @default(uuid())
  workspace_id String
  user_id      String
  action       String   // "law.added", "employee.created", etc.
  resource_type String  // "law", "employee", "task", etc.
  resource_id  String?
  changes      Json?    // Before/after values
  ip_address   String?
  user_agent   String?
  created_at   DateTime @default(now())

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id])
  user         User      @relation(fields: [user_id], references: [id])

  @@index([workspace_id, created_at])
  @@index([user_id, created_at])
  @@map("workspace_audit_logs")
}
```

### 9.10.3 Usage Tracking

```prisma
model WorkspaceUsage {
  id           String   @id @default(uuid())
  workspace_id String
  period_start DateTime
  period_end   DateTime

  // Usage metrics
  active_users      Int
  laws_tracked      Int
  ai_queries        Int
  ai_tokens_used    Int
  storage_mb        Float

  created_at        DateTime @default(now())

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id])

  @@unique([workspace_id, period_start])
  @@index([workspace_id])
  @@map("workspace_usage")
}
```

### 9.10.4 Unit Economics

```prisma
model UnitEconomics {
  id           String   @id @default(uuid())
  workspace_id String
  period_start DateTime
  period_end   DateTime

  // Costs
  ai_cost      Decimal  @db.Decimal(10, 2)
  storage_cost Decimal  @db.Decimal(10, 2)
  api_cost     Decimal  @db.Decimal(10, 2)
  infra_cost   Decimal  @db.Decimal(10, 2)
  total_cost   Decimal  @db.Decimal(10, 2)

  // Revenue
  mrr          Decimal  @db.Decimal(10, 2)

  // Metrics
  margin       Decimal  @db.Decimal(5, 2)

  created_at   DateTime @default(now())

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id])

  @@unique([workspace_id, period_start])
  @@map("unit_economics")
}
```

---

## 9.11 Subscription & Billing

```prisma
model Subscription {
  id                String   @id @default(uuid())
  workspace_id      String   @unique
  stripe_customer_id String?
  stripe_subscription_id String?

  // Plan details
  tier              SubscriptionTier
  seats             Int      @default(1)
  price_per_month   Decimal  @db.Decimal(10, 2)

  // Billing
  billing_cycle     BillingCycle @default(MONTHLY)
  next_billing_date DateTime?

  // Status
  status            SubscriptionStatus @default(TRIALING)
  trial_ends_at     DateTime?
  canceled_at       DateTime?

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relations
  workspace         Workspace @relation(fields: [workspace_id], references: [id])

  @@map("subscriptions")
}

enum BillingCycle {
  MONTHLY
  ANNUAL
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  PAUSED
}
```

---

## 9.12 Background Jobs

```prisma
model BackgroundJob {
  id           String   @id @default(uuid())
  workspace_id String?
  type         JobType
  payload      Json

  // Status
  status       JobStatus @default(PENDING)
  attempts     Int       @default(0)
  max_attempts Int       @default(3)

  // Timing
  scheduled_at DateTime  @default(now())
  started_at   DateTime?
  completed_at DateTime?
  failed_at    DateTime?

  // Results
  result       Json?
  error        String?   @db.Text

  created_at   DateTime  @default(now())

  // Relations
  workspace    Workspace? @relation(fields: [workspace_id], references: [id])

  @@index([status, scheduled_at])
  @@index([workspace_id])
  @@map("background_jobs")
}

enum JobType {
  GENERATE_PHASE2_LAWS
  SYNC_RIKSDAGEN
  GENERATE_EMBEDDINGS
  SEND_DIGEST
  CLEANUP_SESSIONS
  CALCULATE_USAGE
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELED
}
```

---

## 9.13 Redis Session Storage

**Not in PostgreSQL - stored in Redis with 24-hour TTL:**

```typescript
interface AnonymousSession {
  sessionId: string // UUID
  orgNumber: string
  companyName: string
  sniCode: string
  websiteUrl?: string
  websiteAnalysis?: {
    // AI segmentation results
    industry: string[]
    businessModel: string
    customerType: string
    riskFactors: string[]
    employeeCount?: string
    keywords: string[]
  }
  contextAnswers: Record<string, boolean>
  phase1Laws: string[] // 15-30 laws shown immediately
  createdAt: Date
  ipAddress: string // For analytics
  userAgent: string
  referrer?: string // Track marketing source
}
```

---

## 9.14 Database Indexes for Performance

Critical indexes for query optimization based on the 38 workflows:

```prisma
// Full-text search
@@index([search_vector]) using gin

// Change detection (Workflow 8.12)
@@index([updated_at])
@@index([workspace_id, reviewed_at])

// Chat history (Workflow 8.23)
@@index([user_id, created_at])
@@index([session_id, created_at])

// Employee management (Workflow 8.11)
@@index([workspace_id, status])
@@index([department_id])

// Audit log (Workflow 8.29)
@@index([workspace_id, created_at])
@@index([user_id, created_at])

// Law filtering (Workflow 8.6)
@@index([content_type, status])

// Kanban board (Workflow 8.10)
@@index([workspace_id, status])
@@index([assigned_to])

// Vector similarity search
@@index([embedding] using ivfflat)
```

---

## 9.15 Data Compliance & Security

### Encryption at Rest

- **Personnummer:** AES-256 encryption for Swedish personal numbers
- **Sensitive fields:** Encrypted using Supabase column-level encryption
- **Backups:** Encrypted daily snapshots with 30-day retention

### GDPR Compliance

- **Right to erasure:** Soft delete with 30-day retention
- **Data portability:** Export endpoints for all user data
- **Audit trails:** Complete activity logging for compliance
- **Consent tracking:** Marketing preferences stored explicitly

### Row Level Security (RLS)

```sql
-- Example RLS policy for workspace isolation
CREATE POLICY "workspace_isolation" ON law_list_items
  FOR ALL USING (
    law_list_id IN (
      SELECT ll.id FROM law_lists ll
      JOIN workspace_members wm ON wm.workspace_id = ll.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "task_isolation" ON tasks
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  ));
```

---

## 9.16 Epic 6: Compliance Workflow Entities

> **Added 2026-01-08:** New entities supporting the task-centric compliance workflow.

### 9.16.1 Task

First-class task entity with Kanban workflow support.

```prisma
model Task {
  id                String    @id @default(uuid())
  workspace_id      String
  column_id         String    // Current Kanban column
  title             String
  description       String?   @db.Text

  // Assignment & scheduling
  assignee_id       String?
  created_by        String
  due_date          DateTime?
  priority          Priority  @default(MEDIUM)

  // Position in column for drag-and-drop
  position          Int

  // Timestamps
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  completed_at      DateTime?

  // Relations
  workspace         Workspace   @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  column            TaskColumn  @relation(fields: [column_id], references: [id])
  assignee          User?       @relation("TaskAssignee", fields: [assignee_id], references: [id])
  creator           User        @relation("TaskCreator", fields: [created_by], references: [id])
  list_item_links   TaskListItemLink[]
  comments          Comment[]
  evidence          Evidence[]

  @@index([workspace_id])
  @@index([column_id])
  @@index([assignee_id])
  @@index([due_date])
  @@map("tasks")
}
```

### 9.16.2 TaskListItemLink

Many-to-many relationship between Tasks and LawListItems.
Enables a task to be linked to multiple laws, and a law to have multiple tasks.

```prisma
model TaskListItemLink {
  id              String   @id @default(uuid())
  task_id         String
  law_list_item_id String
  created_at      DateTime @default(now())

  // Relations
  task            Task        @relation(fields: [task_id], references: [id], onDelete: Cascade)
  law_list_item   LawListItem @relation(fields: [law_list_item_id], references: [id], onDelete: Cascade)

  @@unique([task_id, law_list_item_id])
  @@index([task_id])
  @@index([law_list_item_id])
  @@map("task_list_item_links")
}
```

### 9.16.3 Comment

Threaded comments supporting 3-level nesting and @mentions.

```prisma
model Comment {
  id                String    @id @default(uuid())
  workspace_id      String
  author_id         String
  content           String    @db.Text
  mentions          String[]  // Array of mentioned user IDs

  // Polymorphic parent (one of these must be set)
  task_id           String?
  law_list_item_id  String?

  // Threading (max 3 levels)
  parent_id         String?
  depth             Int       @default(0)  // 0 = root, 1 = reply, 2 = reply-to-reply

  // Timestamps
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  edited_at         DateTime?

  // Relations
  workspace         Workspace    @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  author            User         @relation(fields: [author_id], references: [id])
  task              Task?        @relation(fields: [task_id], references: [id], onDelete: Cascade)
  law_list_item     LawListItem? @relation(fields: [law_list_item_id], references: [id], onDelete: Cascade)
  parent            Comment?     @relation("CommentThread", fields: [parent_id], references: [id])
  replies           Comment[]    @relation("CommentThread")

  @@index([workspace_id])
  @@index([task_id])
  @@index([law_list_item_id])
  @@index([parent_id])
  @@index([author_id])
  @@map("comments")
}
```

### 9.16.4 Evidence

File attachments stored in Supabase Storage.
Evidence attached to tasks flows up to linked list items for compliance visibility.

```prisma
model Evidence {
  id                String   @id @default(uuid())
  workspace_id      String
  uploaded_by       String

  // File metadata
  filename          String
  file_size         Int      // Bytes
  mime_type         String
  storage_path      String   // Supabase Storage path

  // Optional description
  description       String?  @db.Text

  // Polymorphic parent (one of these must be set)
  task_id           String?
  law_list_item_id  String?

  // Timestamps
  created_at        DateTime @default(now())

  // Relations
  workspace         Workspace    @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  uploader          User         @relation(fields: [uploaded_by], references: [id])
  task              Task?        @relation(fields: [task_id], references: [id], onDelete: Cascade)
  law_list_item     LawListItem? @relation(fields: [law_list_item_id], references: [id], onDelete: Cascade)

  @@index([workspace_id])
  @@index([task_id])
  @@index([law_list_item_id])
  @@map("evidence")
}
```

### 9.16.5 Notification

In-app notification system for user alerts.

```prisma
model Notification {
  id           String           @id @default(uuid())
  workspace_id String
  user_id      String           // Recipient
  type         NotificationType

  // Content
  title        String
  body         String?          @db.Text

  // Link to related entity
  entity_type  String?          // 'task', 'comment', 'list_item', etc.
  entity_id    String?

  // Status
  read_at      DateTime?
  created_at   DateTime         @default(now())

  // Relations
  workspace    Workspace        @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  user         User             @relation(fields: [user_id], references: [id])

  @@index([user_id, read_at])
  @@index([workspace_id])
  @@index([created_at])
  @@map("notifications")
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_DUE_SOON      // 3 days before due
  TASK_OVERDUE
  COMMENT_ADDED
  MENTION            // @mention in comment
  STATUS_CHANGED
  WEEKLY_DIGEST
}
```

### 9.16.6 ActivityLog

Audit trail for compliance activities on list items and tasks.

```prisma
model ActivityLog {
  id           String   @id @default(uuid())
  workspace_id String
  user_id      String

  // What changed
  entity_type  String   // 'list_item', 'task', 'comment', 'evidence'
  entity_id    String
  action       String   // 'created', 'updated', 'deleted', 'status_changed', etc.

  // Change details
  old_value    Json?
  new_value    Json?

  created_at   DateTime @default(now())

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [user_id], references: [id])

  @@index([workspace_id, created_at])
  @@index([entity_type, entity_id])
  @@index([user_id])
  @@map("activity_logs")
}
```

---

## 9.17 Epic 6 Performance Indexes

Additional indexes for Epic 6 compliance workflow queries:

```prisma
// Task Kanban board
@@index([workspace_id, column_id, position])  // Load column tasks in order
@@index([assignee_id, due_date])              // "My tasks due soon"

// Evidence gallery
@@index([task_id, created_at])                // Task evidence timeline
@@index([law_list_item_id, created_at])       // List item evidence

// Activity timeline
@@index([entity_type, entity_id, created_at]) // Entity history
@@index([workspace_id, created_at DESC])      // Global activity feed

// Notification badge
@@index([user_id, read_at])                   // Unread count
```

---
