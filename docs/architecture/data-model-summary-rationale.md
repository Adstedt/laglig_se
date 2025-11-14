# Data Model Summary & Rationale

## **Entity Count: 29 Total**

- **Core Auth:** 1 (User)
- **Company & Workspace:** 4 (Workspace, WorkspaceMember, OnboardingSession, WorkspaceInvitation)
- **Legal Content:** 11 (LegalDocument, CourtCase, EUDocument, CrossReference, Amendment, DocumentSubject, LawEmbedding, LawList, LawListItem, LawInWorkspace, LawTask)
- **AI Chat:** 1 (AIChatMessage)
- **Billing:** 3 (Subscription, WorkspaceUsage, WorkspaceAuditLog)
- **HR Module:** 6 (Employee, Department, EmployeeDocument, Kollektivavtal, EmployeeKollektivavtal, KollektivavtalEmbedding)
- **Change Monitoring:** 2 (ChangeNotification, LawChangeHistory)
- **Background Jobs:** 1 (BackgroundJob)

## **Key Architectural Decisions**

**1. Company Data in Workspace (Not Separate Entity)**

- Workspace = Company in Laglig.se's domain model
- Simplifies queries (no JOIN needed for company data)
- Aligns with PRD where workspace name = company name
- Trade-off: If one company needs multiple workspaces later, requires refactoring (acceptable for MVP)

**2. LawInWorkspace is the Kanban Card (Not Generic "ComplianceItem")**

- Each law in workspace has status, priority, notes, tasks
- Enables law-centric compliance tracking (not arbitrary tasks)
- Composite unique constraint: one law appears once per workspace
- Supports Phase 1 onboarding: 15-30 laws with AI commentary pre-populated

**3. Polymorphic LegalDocument with Type-Specific Tables**

- Single table for all 170K documents (SFS, court cases, EU legislation)
- Type-specific tables (CourtCase, EUDocument) for metadata
- Rationale: Shared fields (title, slug, full_text) in main table, unique fields in extensions
- Trade-off: Requires LEFT JOIN for type-specific data, but cleaner than single table with nullable columns

**4. UUID Arrays vs Join Tables**

- `LawInWorkspace.assigned_employee_ids` uses UUID[] (no join table)
- Simple many-to-many when no metadata needed
- When metadata required (e.g., `assigned_at`, `position`), use join table (LawListItem, EmployeeKollektivavtal)

**5. JSONB for Dynamic Schemas**

- `Workspace.onboarding_context`: Question-answer pairs vary by industry
- `LegalDocument.metadata`: SFS chapters ≠ court case parties
- `LawChangeHistory.diff`: Structured diffs
- Indexed with GIN for fast queries

**6. No Soft Deletion**

- GDPR right to erasure requires hard delete
- Simplifies queries (no `WHERE deleted_at IS NULL`)
- Audit logs kept separately for critical actions

**7. Encryption Strategy**

- `Employee.personnummer_encrypted`: AES-256, keys in env vars
- Never in logs, never sent to OpenAI
- Decryption only for display in HR Module (requires HR_MANAGER+ role)

**8. Multi-Tenancy via workspace_id + RLS**

- All workspace data has `workspace_id` foreign key
- PostgreSQL Row-Level Security policies enforce isolation
- Middleware double-checks user access
- Test: User A cannot query `SELECT * FROM employees WHERE workspace_id = 'user-b-workspace'`

## **Storage Estimates**

**Legal Content:**

- 170K laws × 50KB avg = 8.5GB full_text
- 1.7M embeddings × 6KB = 10GB law_embeddings
- HNSW index overhead: +3GB
- **Subtotal: ~22GB**

**User Data (at 1,000 workspaces):**

- Employees: 50 avg × 1K workspaces × 5KB = 250MB
- Employee docs: 5 docs × 500KB × 50 employees × 1K = ~125GB (Supabase Storage)
- Kollektivavtal: 2 PDFs × 2MB × 1K = 4GB
- Kollektivavtal embeddings: 1M chunks × 6KB = 6GB
- Workspaces, chat, subscriptions, etc.: ~2GB
- **Subtotal: ~140GB**

**Total at Scale:** ~165GB database + Supabase Storage

## **Performance Indexes**

Critical indexes for <100ms queries:

1. `law_embeddings.embedding` - HNSW (vector search)
2. `legal_documents.slug` - BTREE (SEO URLs)
3. `legal_documents.search_vector` - GIN (full-text search)
4. `law_in_workspace (workspace_id, status, position)` - BTREE (Kanban queries)
5. `employees.workspace_id` - BTREE (HR Module)
6. `ai_chat_messages (workspace_id, created_at DESC)` - BTREE (chat history)
7. `workspace_members (workspace_id, user_id)` - BTREE (auth checks)

---

**This data model supports all 8 PRD epics and 41 functional requirements.** Ready for Section 5: API Specification.
