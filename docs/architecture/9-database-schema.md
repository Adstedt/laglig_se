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
│  3. Legal Content      │  ├─Employeeote               │
│  ├─ LegalDocument      │  ├─ Kollektivavtal             │
│  ├─ LegalCategory      │  └─ EmployeeKollektivavtal     │
│  ├─ CourtCase          │                                 │
│  ├─ CrossReference     │  8. Change Tracking             │
│  └─ Amendment          │  ├─ LawVersionHistory          │
│                        │  ├─ ChangeNotification         │
│  4. Law Management     │  └─ NotificationPreference     │
│  ├─ LawInWorkspace     │                                 │
│  ├─ LawList            │  9. Background Jobs             │
│  ├─ LawListItem        │  └─ BackgroundJob              │
│  └─ LawTask            │                                 │
│                        │  10. Billing/Usage             │
│  5. Analytics          │  ├─ Subscription               │
│  ├─ OnboardingSession  │  ├─ WorkspaceUsage             │
│  ├─ WorkspaceAuditLog  │  └─ UnitEconomics              │
│  └─ KanbanConfig       │                                 │
│                                                           │
│  * Redis-based, not in PostgreSQL                        │
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
  assigned_tasks    LawTask[]         @relation("TaskAssignee")
  audit_logs        WorkspaceAuditLog[]
  notifications     NotificationPreference[]
  employee_notes    EmployeeNote[]    @relation("NoteAuthor")

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
  laws_in_workspace LawInWorkspace[]
  employees        Employee[]
  departments      Department[]
  kollektivavtal   Kollektivavtal[]
  chat_sessions    AIChatSession[]
  change_notifications ChangeNotification[]
  notification_preferences NotificationPreference[]
  audit_logs       WorkspaceAuditLog[]
  usage_records    WorkspaceUsage[]
  unit_economics   UnitEconomics[]
  kanban_config    KanbanConfig?
  subscription     Subscription?
  background_jobs  BackgroundJob[]

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

model LawListItem {
  id                String   @id @default(uuid())
  law_list_id       String
  legal_document_id String
  position          Int      // For ordering
  added_at          DateTime @default(now())

  // Relations
  law_list          LawList       @relation(fields: [law_list_id], references: [id])
  legal_document    LegalDocument @relation(fields: [legal_document_id], references: [id])

  @@unique([law_list_id, legal_document_id])
  @@index([law_list_id])
  @@map("law_list_items")
}
```

### 9.6.2 Kanban Board

```prisma
model LawInWorkspace {
  id                String           @id @default(uuid())
  workspace_id      String
  legal_document_id String
  status            KanbanStatus     @default(NOT_STARTED)
  priority          Priority         @default(MEDIUM)
  assigned_to       String[]         // Array of user IDs
  notes             String?          @db.Text
  due_date          DateTime?
  position          Int              // Position in column

  created_at        DateTime         @default(now())
  updated_at        DateTime         @updatedAt

  // Relations
  workspace         Workspace        @relation(fields: [workspace_id], references: [id])
  legal_document    LegalDocument    @relation(fields: [legal_document_id], references: [id])
  tasks             LawTask[]

  @@unique([workspace_id, legal_document_id])
  @@index([workspace_id, status])
  @@index([assigned_to])
  @@map("laws_in_workspace")
}

enum KanbanStatus {
  NOT_STARTED
  IN_PROGRESS
  BLOCKED
  REVIEW
  COMPLIANT
  CUSTOM_1    // User-defined column
  CUSTOM_2    // User-defined column
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 9.6.3 Task Management

```prisma
model LawTask {
  id                 String   @id @default(uuid())
  law_in_workspace_id String
  title              String
  description        String?  @db.Text
  assigned_to        String?
  due_date           DateTime?
  completed_at       DateTime?
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  // Relations
  law_in_workspace   LawInWorkspace @relation(fields: [law_in_workspace_id], references: [id])
  assignee           User?          @relation("TaskAssignee", fields: [assigned_to], references: [id])

  @@index([law_in_workspace_id])
  @@index([assigned_to])
  @@map("law_tasks")
}
```

### 9.6.4 Kanban Customization

```prisma
model KanbanConfig {
  id           String   @id @default(uuid())
  workspace_id String   @unique
  columns      Json     // Array of column definitions

  // Example columns JSON:
  // [{
  //   "id": "not_started",
  //   "name": "Ej Påbörjad",
  //   "position": 0,
  //   "color": "#gray",
  //   "isDefault": true
  // }]

  // Relations
  workspace    Workspace @relation(fields: [workspace_id], references: [id])

  @@map("kanban_configs")
}
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
CREATE POLICY "workspace_isolation" ON laws_in_workspace
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  ));
```

---
