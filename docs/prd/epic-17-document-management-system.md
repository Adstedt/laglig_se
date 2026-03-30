# Epic 17: Document Management System (DMS) — Tiptap Editor, Versioning & Agent Integration

**Goal:** Provide a complete in-app document management system where users create, edit, version, and export compliance documents (policies, risk assessments, action plans) using a rich text editor — and where the AI compliance agent can read, search, create, and update those documents as a first-class participant.

**Value Delivered:** Closes the documentation gap in the compliance workflow. Users currently track obligations (law lists), execute tasks, and attach evidence files — but cannot create or manage the actual compliance documents (policies, procedures, risk assessments) that auditors ask for. This epic makes Laglig.se the single source of truth for both compliance tracking AND compliance documentation.

**Delivers:** Tiptap-based rich text editor with Word-like UX, Document & DocumentVersion data models with full version control, document lifecycle management (DRAFT → APPROVED → ARCHIVED), .docx import/export and PDF export, compliance document templates, text extraction from uploaded files, workspace document embedding into RAG pipeline, 5 new agent tools for document interaction

**Requirements covered:** FR7 (compliance workspace), FR25 (audit trail), FR27 (evidence/documentation)

**Estimated stories:** 13

**Dependencies:** Epic 6 (WorkspaceFile, FileTaskLink, FileListItemLink — Done), Epic 14 (Agent tools infrastructure — Done), Story 14.14 (Chunk/embed pipeline — Done)

**Note:** This epic introduces a new `Document` model alongside the existing `WorkspaceFile` model. `WorkspaceFile` remains for simple file attachments (evidence photos, certificates, uploaded PDFs). `Document` is for structured, editable, versioned content authored in-app. Future Phase: Office 365 integration (Microsoft Graph API + WOPI) designed for but NOT included in this epic — the `source` field on `DocumentVersion` enables this as an additive change later.

---

## Conceptual Model

### Hierarchy

```
Workspace
├── Documents (NEW — structured, editable, versioned)
│   ├── Document (policy, risk assessment, action plan, etc.)
│   │   ├── DocumentVersion[] (immutable snapshots)
│   │   │   ├── content_json (Tiptap JSON — source of truth)
│   │   │   ├── content_html (rendered)
│   │   │   └── extracted_text (plaintext for RAG)
│   │   ├── Status lifecycle: DRAFT → IN_REVIEW → APPROVED → SUPERSEDED → ARCHIVED
│   │   ├── Task links (DocumentTaskLink)
│   │   └── List item links (DocumentListItemLink)
│   └── Templates (pre-built compliance structures)
│
├── Files (EXISTING — simple attachments, unchanged)
│   └── WorkspaceFile (evidence photos, certificates, uploaded PDFs)
│       ├── FileTaskLink
│       └── FileListItemLink
│
└── AI Agent (ENHANCED)
    ├── search_workspace_documents (semantic search over documents)
    ├── get_workspace_document (read document content)
    ├── list_workspace_documents (browse by type/status/links)
    ├── create_document (agent drafts new document)
    └── update_document (agent edits existing document section)
```

### Key Principles

1. **Tiptap JSON is the source of truth** — not .docx, not HTML. Export formats (.docx, .pdf) are rendered on demand from the JSON.
2. **Every save = immutable version** — `DocumentVersion` rows are never updated. Version history is the complete audit trail.
3. **Documents are structured data** — Unlike opaque file blobs, documents are searchable, diffable, and agent-readable JSON trees.
4. **Agent is a first-class author** — The agent creates and edits documents using the same versioning system as human users. Every agent change is tracked with `source: 'AGENT'`.
5. **Existing file system untouched** — `WorkspaceFile` continues to serve simple file attachments. No migration of existing files.
6. **Designed for Office 365 extension** — The `source` field and document service abstraction layer allow adding Office 365 as an alternative editor in a future phase without rewriting the versioning/linking/agent layers.

### Document vs. File

| Aspect | Document (NEW) | WorkspaceFile (EXISTING) |
|--------|---------------|-------------------------|
| Created in | Tiptap editor or by agent | File upload |
| Source of truth | Tiptap JSON | Binary blob in Supabase Storage |
| Editable in-app | Yes (rich text editor) | No (download → edit → re-upload) |
| Versioned | Yes (immutable version chain) | No |
| Lifecycle status | DRAFT → APPROVED → ARCHIVED | None |
| Agent can read/write | Yes (JSON content) | Read-only (extracted text) |
| Export | .docx, .pdf on demand | Download original |
| Use case | Policies, procedures, risk assessments, action plans | Evidence photos, certificates, scanned PDFs |

---

## Data Model

> **⚠️ NAMING COLLISION NOTE:** The Prisma model/enum names below (`Document`, `DocumentVersion`, `DocumentType`, `DocumentStatus`, etc.) are used for **readability** in this epic. The actual implementation **MUST** use the `WorkspaceDocument*` prefix (e.g., `WorkspaceDocument`, `WorkspaceDocumentVersion`, `WorkspaceDocumentType`, `WorkspaceDocumentStatus`) because the existing schema already defines `model DocumentVersion` and `enum DocumentStatus` for the SFS legal document system. See Story 17.1 for the full collision avoidance mapping. All subsequent stories should reference the prefixed names.

### New Models

```prisma
enum DocumentType {
  POLICY           // Policies (Arbetsmiljöpolicy, GDPR-policy, etc.)
  RISK_ASSESSMENT  // Riskbedömningar
  ACTION_PLAN      // Handlingsplaner
  PROCEDURE        // Rutiner
  INSTRUCTION      // Instruktioner
  CHECKLIST        // Checklistor
  REPORT           // Rapporter
  OTHER            // Övrigt
}

enum DocumentStatus {
  DRAFT            // Under arbete
  IN_REVIEW        // Under granskning
  APPROVED         // Godkänd
  SUPERSEDED       // Ersatt (by newer document)
  ARCHIVED         // Arkiverad
}

enum DocumentVersionSource {
  TIPTAP           // Created/edited in Tiptap editor
  IMPORT           // Imported from .docx upload
  AGENT            // Created/edited by AI agent
  // Future: OFFICE (Office 365 integration)
}

model Document {
  id                   String           @id @default(uuid())
  workspace_id         String
  title                String
  document_type        DocumentType     @default(OTHER)
  status               DocumentStatus   @default(DRAFT)
  document_number      String?          // Optional user-defined document ID (e.g., "POL-2026-001")

  // Version tracking
  current_version_id   String?          @unique
  current_version_number Int            @default(0)

  // Template reference
  template_id          String?

  // Lifecycle / compliance
  approved_by          String?          // User ID
  approved_at          DateTime?
  review_date          DateTime?        // Next scheduled review
  retention_until      DateTime?        // ISO retention requirement

  // Ownership
  created_by           String
  updated_at           DateTime         @updatedAt
  created_at           DateTime         @default(now())

  // Relations
  workspace            Workspace        @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  creator              User             @relation("DocumentCreator", fields: [created_by], references: [id])
  approver             User?            @relation("DocumentApprover", fields: [approved_by], references: [id])
  current_version      DocumentVersion? @relation("CurrentVersion", fields: [current_version_id], references: [id])
  versions             DocumentVersion[] @relation("DocumentVersions")
  template             DocumentTemplate? @relation(fields: [template_id], references: [id])
  task_links           DocumentTaskLink[]
  list_item_links      DocumentListItemLink[]

  @@index([workspace_id, status])
  @@index([workspace_id, document_type])
  @@index([workspace_id, created_at])
  @@map("documents")
}

model DocumentVersion {
  id                String                @id @default(uuid())
  document_id       String
  version_number    Int                   // 1, 2, 3...
  source            DocumentVersionSource @default(TIPTAP)

  // Content (Tiptap JSON is source of truth)
  content_json      Json                  // Tiptap ProseMirror JSON
  content_html      String    @db.Text    // Rendered HTML (for export/preview)
  extracted_text    String?   @db.Text    // Plaintext (for RAG/search/embedding)

  // Import source file (if imported from .docx)
  storage_path      String?               // Supabase Storage path to original file

  // Change tracking
  change_summary    String?               // What changed in this version
  created_by        String                // User ID or "agent"
  created_at        DateTime  @default(now())

  // Relations
  document          Document  @relation("DocumentVersions", fields: [document_id], references: [id], onDelete: Cascade)
  creator           User      @relation(fields: [created_by], references: [id])
  current_for       Document? @relation("CurrentVersion")

  @@unique([document_id, version_number])
  @@index([document_id, created_at])
  @@map("document_versions")
}

model DocumentTemplate {
  id                String        @id @default(uuid())
  name              String        // "Riskbedömning", "Arbetsmiljöpolicy", etc.
  description       String?
  document_type     DocumentType
  content_json      Json          // Tiptap JSON template with placeholder structure
  is_active         Boolean       @default(true)
  sort_order        Int           @default(0)
  created_at        DateTime      @default(now())
  updated_at        DateTime      @updatedAt

  documents         Document[]

  @@map("document_templates")
}

model DocumentTaskLink {
  id            String   @id @default(uuid())
  document_id   String
  task_id       String
  linked_at     DateTime @default(now())
  linked_by     String

  document      Document @relation(fields: [document_id], references: [id], onDelete: Cascade)
  task          Task     @relation(fields: [task_id], references: [id], onDelete: Cascade)
  linker        User     @relation(fields: [linked_by], references: [id])

  @@unique([document_id, task_id])
  @@map("document_task_links")
}

model DocumentListItemLink {
  id            String      @id @default(uuid())
  document_id   String
  list_item_id  String
  linked_at     DateTime    @default(now())
  linked_by     String

  document      Document    @relation(fields: [document_id], references: [id], onDelete: Cascade)
  list_item     LawListItem @relation(fields: [list_item_id], references: [id], onDelete: Cascade)
  linker        User        @relation(fields: [linked_by], references: [id])

  @@unique([document_id, list_item_id])
  @@map("document_list_item_links")
}
```

### Existing Models (Unchanged)

- `WorkspaceFile` — remains for simple file attachments
- `FileTaskLink`, `FileListItemLink` — remain for file linking
- `ContentChunk` — extended with `source_type: 'WORKSPACE_DOCUMENT'` (additive enum value)
- `ActivityLog` — used as-is for document activity logging

---

## Stories

### Story 17.1: Document & DocumentVersion Data Models

**As a** developer,
**I want** the Document, DocumentVersion, DocumentTemplate, and linking models in the database,
**so that** all subsequent stories have a stable data foundation.

**Acceptance Criteria:**

1. Prisma schema includes `Document`, `DocumentVersion`, `DocumentTemplate`, `DocumentTaskLink`, `DocumentListItemLink` models as specified above
2. All enums created: `DocumentType`, `DocumentStatus`, `DocumentVersionSource`
3. Migration runs cleanly against existing database (additive only — no changes to existing models)
4. `ContentChunk.source_type` enum extended with `WORKSPACE_DOCUMENT` value
5. Indexes on `[workspace_id, status]`, `[workspace_id, document_type]`, `[workspace_id, created_at]` for Document
6. Unique constraint on `[document_id, version_number]` for DocumentVersion
7. Server actions created: `createDocument()`, `getDocument()`, `getDocumentVersions()`, `getWorkspaceDocuments()` (basic CRUD)
8. All new relations properly cascade on delete (workspace deletion cleans up documents)

---

### Story 17.2: Tiptap Editor Component & Document Creation UI

**As a** workspace member,
**I want** to create new documents using a rich text editor,
**so that** I can author compliance documents directly in Laglig.

**Acceptance Criteria:**

1. Document editor page at `/workspace/documents/[documentId]/edit` using Tiptap
2. "Nytt dokument" button in workspace navigation opens a creation dialog (title, document type, optional template)
3. Editor toolbar with Word-like controls:
   - Text formatting: bold, italic, underline, strikethrough
   - Headings (H1–H3)
   - Bullet lists, numbered lists
   - Tables (insert, add/remove rows/columns, merge cells)
   - Text alignment (left, center, right)
   - Text/highlight colors
   - Links
   - Images (upload inline)
   - Horizontal rule
   - Undo/redo
4. Slash command menu (`/`) for quick insertion of headings, tables, lists, etc.
5. Editor saves content as Tiptap JSON to `DocumentVersion.content_json`
6. Auto-save with debounce (2 seconds after last keystroke) — creates new version only if content changed
7. Manual save button ("Spara") also available
8. Document title editable inline at top of editor
9. Editor responsive — usable on tablet screens (≥768px)
10. Page-like container styling (A4 width, white background, subtle shadow) for a document feel

---

### Story 17.3: Document Versioning — History, Diff & Restore

**As a** workspace member,
**I want** to view version history and compare changes between versions,
**so that** I have full traceability of document changes for audit purposes.

**Acceptance Criteria:**

1. Version history panel (sidebar or drawer) accessible from document editor
2. Version list shows: version number, author (name + avatar), timestamp, change summary, source badge (Tiptap/Import/Agent)
3. Every save creates a new immutable `DocumentVersion` row with incremented `version_number`
4. Auto-save batching: rapid edits within a 30-second window are batched into a single version (not one version per keystroke)
5. Diff view between any two versions — highlights added text (green), removed text (red), changed text (yellow)
6. "Återställ version" (restore) button creates a NEW version from the selected old version's content (does not delete later versions)
7. Current version indicator clearly shown in the version list
8. Version count badge shown on the document in listings
9. ActivityLog entries created for: document_created, document_version_saved, document_version_restored

---

### Story 17.4: Document Lifecycle — Status Workflow & Approval

**As a** compliance manager,
**I want** documents to follow a lifecycle from draft to approved with review dates,
**so that** I can maintain ISO-compliant document control.

**Acceptance Criteria:**

1. Document status displayed as color-coded badge: Utkast (gray), Under granskning (blue), Godkänd (green), Ersatt (orange), Arkiverad (muted)
2. Status transitions enforced:
   - DRAFT → IN_REVIEW or ARCHIVED
   - IN_REVIEW → APPROVED or DRAFT (send back)
   - APPROVED → SUPERSEDED or ARCHIVED
   - SUPERSEDED → ARCHIVED
   - ARCHIVED → (terminal, no transitions out)
3. "Godkänn" action records `approved_by` and `approved_at` on the Document
4. Review date field (`review_date`) — optional, shown as reminder in document list when approaching/overdue
5. When a document is approved, editing is locked — user must create a new version (which sets status back to DRAFT) to make changes
6. Retention date field (`retention_until`) — informational, shown in document metadata
7. Document number field (`document_number`) — optional user-defined identifier (e.g., "POL-2026-001") for organizations that use document numbering schemes
8. Status change logged to ActivityLog

---

### Story 17.5: .docx Import — Upload & Convert to Tiptap

**As a** workspace member,
**I want** to import existing Word documents into the system,
**so that** I can bring my current compliance documentation into Laglig without rewriting everything.

**Acceptance Criteria:**

1. "Importera dokument" button accepts .docx files (not .doc — legacy format not supported)
2. Upload converts .docx → HTML (via `mammoth`) → Tiptap JSON (via custom transformer)
3. Conversion preserves: headings, paragraphs, bold/italic/underline, bullet/numbered lists, tables, images, links
4. Original .docx stored in Supabase Storage (referenced by `DocumentVersion.storage_path`) as archival copy
5. Converted content becomes `DocumentVersion` v1 with `source: 'IMPORT'`
6. Import dialog shows preview of converted content before confirming creation
7. User can set title, document type, and document number during import
8. Batch import: accept multiple .docx files at once (each becomes a separate Document)
9. Clear messaging about what formatting may be lost (complex layouts, custom styles, headers/footers, macros)
10. Maximum file size: 25MB per .docx file

---

### Story 17.6: .docx & PDF Export

**As a** workspace member,
**I want** to export documents as Word or PDF files,
**so that** I can share compliance documents with auditors, authorities, or colleagues outside Laglig.

**Acceptance Criteria:**

1. "Exportera" dropdown on document page with options: "Word (.docx)" and "PDF (.pdf)"
2. Word export uses `docx` npm package — maps Tiptap JSON nodes to Word elements (headings, paragraphs, tables, lists, images)
3. PDF export renders document to PDF — either via HTML → Puppeteer or via `@react-pdf/renderer`
4. Exported files include document metadata header: title, document number, version, status, approved date, workspace name
5. Exported files use consistent Laglig branding (optional logo, consistent fonts)
6. Export filename format: `{title}-v{version}-{YYYY-MM-DD}.docx` / `.pdf`
7. Export generates from current version by default — option to export a specific historical version
8. Tables render correctly in both export formats (column widths, merged cells)
9. Images embedded in exports (not external links)
10. Export works for documents of up to 50 pages within 10 seconds

---

### Story 17.7: Document Templates

**As a** workspace member,
**I want** to create documents from pre-built compliance templates,
**so that** I get a professional starting structure without building documents from scratch.

**Acceptance Criteria:**

1. Template selection shown when creating a new document (alongside "Tomt dokument" option)
2. Initial templates seeded (at minimum):
   - **Arbetsmiljöpolicy** (POLICY) — sections: Syfte, Ansvar, Mål, Rutiner, Uppföljning
   - **Riskbedömning** (RISK_ASSESSMENT) — sections: Bakgrund, Identifierade risker (table: Risk / Sannolikhet / Konsekvens / Riskvärde / Åtgärd), Handlingsplan, Uppföljning
   - **Handlingsplan** (ACTION_PLAN) — sections: Mål, Åtgärder (table: Åtgärd / Ansvarig / Deadline / Status), Uppföljning
   - **Rutin** (PROCEDURE) — sections: Syfte, Omfattning, Ansvar, Genomförande, Dokumentation
   - **Checklista** (CHECKLIST) — sections: Checklista (table with checkbox column), Anteckningar, Signatur
3. Templates stored as `DocumentTemplate` rows with Tiptap JSON content
4. Template content includes placeholder text (italic, clearly marked as placeholder) guiding the user on what to write in each section
5. Creating from template pre-fills the document with template content and sets `document_type` and `template_id`
6. Templates manageable by admin (future — for MVP, seeded templates only)
7. Template list shows name, description, and document type
8. Templates are workspace-independent (global, shared across all workspaces)

---

### Story 17.8: Text Extraction Pipeline for Uploaded Files

**As a** system component,
**I want** uploaded workspace files (PDFs, .docx) to have their text content extracted,
**so that** the agent can read and search across all workspace documentation, not just Tiptap documents.

**Implementation Note:** This enhances the existing `WorkspaceFile` system — no changes to file upload UX. Extraction runs as a background process after upload.

**Acceptance Criteria:**

1. After a file is uploaded via existing `uploadFile()` action, text extraction runs asynchronously
2. Extraction supports: PDF (via `pdf-parse`), .docx (via `mammoth`), .xlsx (via `exceljs` — extract cell values as text)
3. Extracted text stored in a new `extracted_text` field on `WorkspaceFile` (additive schema change)
4. Extraction is best-effort — if extraction fails (encrypted PDF, scanned image), file is still stored, `extracted_text` remains null
5. Extraction runs within the upload server action (acceptable latency for background processing)
6. Images (PNG, JPG, GIF) and PowerPoint files skip extraction (no OCR in this story)
7. Extracted text truncated at 100,000 characters (safety cap for very large files)
8. Re-extraction can be triggered if needed (e.g., after a file is replaced)

---

### Story 17.9: Chunk & Embed Workspace Documents into RAG Pipeline

**As a** system component,
**I want** workspace documents (both Tiptap documents and extracted file text) embedded into the vector search pipeline,
**so that** the agent can semantically search across all workspace documentation.

**Implementation Note:** Extends the existing `ContentChunk` + pgvector + Cohere rerank pipeline. Adds `WORKSPACE_DOCUMENT` as a new `source_type`.

**Acceptance Criteria:**

1. When a `DocumentVersion` is saved, its `extracted_text` is chunked and embedded using the existing `chunk-document.ts` pipeline
2. When a `WorkspaceFile` has `extracted_text` populated, it is chunked and embedded similarly
3. Chunks use `source_type: 'WORKSPACE_DOCUMENT'` and `workspace_id` is always set (workspace-scoped, never public)
4. Chunk `source_id` references either `Document.id` or `WorkspaceFile.id`
5. When a new `DocumentVersion` is created, old chunks for that document are replaced (re-indexed)
6. Chunking strategy: paragraph-level for Tiptap documents (each top-level node), markdown-fallback chunking for extracted file text (same as existing legal document chunking)
7. `contextual_header` includes document title and document type for better retrieval context
8. Existing `retrieveContext()` function in `lib/agent/retrieval.ts` extended to include `WORKSPACE_DOCUMENT` source type (opt-in filter — agent tools specify when to search workspace docs vs. legal docs)
9. Embedding uses same `text-embedding-3-small` model and Cohere rerank pipeline as legal documents
10. Re-indexing does not block the user — runs after save completes

---

### Story 17.10: Agent Tools — Search, Read & List Workspace Documents

**As an** AI compliance agent,
**I want** to search and read workspace documents,
**so that** I can provide advice informed by the organization's actual policies, procedures, and risk assessments.

**Acceptance Criteria:**

1. New tool: `search_workspace_documents` — semantic search across all workspace documents and files
   - Input: `query` (string), optional `document_type` filter, optional `status` filter
   - Uses `retrieveContext()` with `source_type: 'WORKSPACE_DOCUMENT'` filter
   - Returns: matched snippets with document title, type, status, version, relevance score
   - Maximum 10 results
2. New tool: `get_workspace_document` — read full document content
   - Input: `document_id` (string)
   - Returns: title, type, status, version number, `extracted_text` (full content), linked tasks, linked list items, approved_by, review_date
   - For large documents, content truncated to first 20,000 characters with note
3. New tool: `list_workspace_documents` — browse documents
   - Input: optional `document_type`, optional `status`, optional `linked_list_item_id`, optional `linked_task_id`
   - Returns: list of documents with title, type, status, version count, last updated, created by
   - Maximum 25 results, ordered by last updated
4. All three tools scoped to current workspace (enforce `workspace_id`)
5. Tool results include citation keys for document references (format: `doc:{document_id}`)
6. Tools registered in `createAgentTools()` alongside existing tools
7. System prompt updated to inform agent about workspace document capabilities

---

### Story 17.11: Agent Tools — Create & Update Documents

**As an** AI compliance agent,
**I want** to create new documents and edit existing ones,
**so that** I can help users draft policies, risk assessments, and action plans based on their compliance context.

**Acceptance Criteria:**

1. New tool: `create_document` — agent creates a new document
   - Input: `title`, `document_type`, `content` (markdown), optional `template_id`, optional `linked_list_item_id`, optional `linked_task_id`
   - Agent provides content as **markdown** — service layer converts markdown → Tiptap JSON via a `markdownToTiptap()` transformer
   - Creates `Document` + `DocumentVersion` v1 with `source: 'AGENT'`
   - Follows two-phase confirmation pattern: `execute=false` returns preview, `execute=true` persists
   - Returns: document ID, title, version number
2. New tool: `update_document` — agent edits a specific section of an existing document
   - Input: `document_id`, `section_heading` (heading text to locate), `updated_content` (markdown for that section), `change_summary`
   - Service layer: reads current `content_json`, locates section by heading, replaces section content, saves as new `DocumentVersion` with `source: 'AGENT'`
   - Follows two-phase confirmation pattern
   - Returns: document ID, new version number, change summary
3. Both tools enforce: document must be in DRAFT or IN_REVIEW status (cannot edit APPROVED documents — agent must inform user)
4. `markdownToTiptap()` utility converts markdown → Tiptap JSON: headings, paragraphs, bold/italic, lists, tables, links
5. `tiptapToMarkdown()` utility converts Tiptap JSON → markdown (for agent to read existing content in a format it handles well)
6. ActivityLog entries created with `source: 'agent'` for all document changes
7. Agent system prompt updated with guidance on when and how to use document creation/editing

---

### Story 17.12: Document Linking to Tasks & Law List Items

**As a** workspace member,
**I want** to link documents to specific tasks and law list items,
**so that** I can trace which compliance documents satisfy which legal obligations.

**Acceptance Criteria:**

1. "Länka dokument" action available in:
   - Task modal (right panel, alongside existing evidence)
   - Legal document modal (new "Dokument" tab or section alongside existing "Bevis" tab)
2. Link picker shows workspace documents — searchable by title, filterable by type
3. Linked documents shown with: title, type badge, status badge, version number, link to open
4. Unlink action available (removes link, does not delete document)
5. A document can be linked to multiple tasks and multiple list items
6. A task/list item can have multiple linked documents
7. Document detail page shows "Länkade till" section listing all linked tasks and list items
8. When creating a document from within a task or list item context, auto-link is offered
9. `DocumentTaskLink` and `DocumentListItemLink` models used (not reusing `FileTaskLink`)
10. Links logged to ActivityLog

---

### Story 17.13: Document Browser & Manager UI

**As a** workspace member,
**I want** a dedicated document management page to browse, filter, and manage all workspace documents,
**so that** I can find and organize compliance documentation efficiently.

**Acceptance Criteria:**

1. Document browser page at `/workspace/documents`
2. Table/list view showing: title, document number, type badge, status badge, version count, author, last updated, review date
3. Filterable by: document type (multi-select), status (multi-select), created by (user dropdown)
4. Sortable by: title, last updated, created date, review date, status
5. Search by title (text search, not semantic)
6. "Nytt dokument" primary action button (opens creation dialog from Story 17.2)
7. "Importera" button for .docx import (Story 17.5)
8. Click document row → navigates to document editor/viewer (Story 17.2)
9. Bulk actions: archive selected, change status (with valid transitions only)
10. Review date indicator: overdue reviews highlighted in red, upcoming (within 30 days) in amber
11. Empty state: clear message with "Skapa ditt första dokument" CTA
12. Sidebar navigation entry: "Dokument" with document icon, placed between existing nav items
13. Page loads within 2 seconds for workspaces with up to 500 documents

---

## Story Dependencies

```
17.1 (data models) ─────────┬──→ 17.2 (Tiptap editor + creation UI)
                            │        │
                            │        ├──→ 17.3 (versioning, diff, restore)
                            │        │        │
                            │        │        └──→ 17.4 (lifecycle, approval)
                            │        │
                            │        ├──→ 17.5 (.docx import)
                            │        │
                            │        ├──→ 17.6 (.docx + PDF export)
                            │        │
                            │        └──→ 17.12 (linking to tasks/items)
                            │
                            ├──→ 17.7 (templates) — depends on 17.1 only
                            │
                            ├──→ 17.8 (text extraction) — depends on 17.1 only
                            │        │
                            │        └──→ 17.9 (chunk + embed into RAG)
                            │                 │
                            │                 └──→ 17.10 (agent read tools)
                            │                          │
                            │                          └──→ 17.11 (agent write tools)
                            │
                            └──→ 17.13 (document browser) — depends on 17.1, benefits from all others

Parallel tracks:
  Track A: 17.1 → 17.2 → 17.3 → 17.4 (editor + versioning + lifecycle)
  Track B: 17.1 → 17.8 → 17.9 → 17.10 → 17.11 (extraction + RAG + agent)
  Track C: 17.1 → 17.7 (templates — can run in parallel)
  Track D: 17.2 → 17.5, 17.6 (import/export — after editor exists)
  Track E: 17.2 → 17.12 (linking — after editor exists)
  Track F: 17.13 (browser — start after 17.1, complete after most others)
```

---

## Compatibility Requirements

- [x] Existing `WorkspaceFile` model and all file upload/management functionality unchanged
- [x] Existing `FileTaskLink` and `FileListItemLink` remain — new `DocumentTaskLink` and `DocumentListItemLink` are separate
- [x] All database changes are additive (new models, new enum values) — no modification of existing tables
- [x] Existing agent tools (`search_laws`, `get_document_details`, etc.) unchanged — new tools added alongside
- [x] Existing RAG pipeline unchanged — new `WORKSPACE_DOCUMENT` source type added alongside `LEGAL_DOCUMENT`
- [x] Existing evidence upload UI in task modal and legal document modal unchanged
- [x] Navigation structure preserved — "Dokument" added as new entry

## Risk Mitigation

- **Primary Risk:** Tiptap JSON ↔ .docx conversion fidelity — complex Word documents may lose formatting on import
- **Mitigation:** Clear messaging on import about potential format loss. Original .docx preserved as archival copy. Focus import quality on compliance document patterns (headings, tables, lists) not complex layouts.
- **Rollback Plan:** All changes are additive. Document models can be dropped without affecting existing functionality. Feature flag can gate document UI.

- **Secondary Risk:** Auto-save creating excessive versions (storage/performance)
- **Mitigation:** 30-second batching window for auto-save. Content diff check — no new version if content unchanged.

- **Tertiary Risk:** Agent writing incorrect document content
- **Mitigation:** Two-phase confirmation on all agent write operations. `source: 'AGENT'` clearly marked in version history. Users review before approving.

## Definition of Done

- [ ] All 13 stories completed with acceptance criteria met
- [ ] Existing file management, task, and law list functionality verified — no regression
- [ ] Agent can search, read, create, and update workspace documents
- [ ] Documents versioned with full history and diff capability
- [ ] .docx import and .docx/.pdf export functional
- [ ] At least 5 compliance templates seeded
- [ ] Document lifecycle (DRAFT → APPROVED) enforced
- [ ] All document actions logged to ActivityLog
- [ ] Tests cover: data model, versioning logic, import/export, agent tools, linking
- [ ] Performance: document browser loads <2s with 500 documents, editor responsive with 50-page documents

---

## MVP vs. Future Scope

**In this epic (MVP):**
- Tiptap editor with rich text editing
- Full version control with diff
- Document lifecycle with approval
- .docx import and .docx/.pdf export
- 5+ compliance document templates
- Text extraction from uploaded files
- RAG integration for workspace documents
- 5 new agent tools (search, read, list, create, update)
- Document linking to tasks and law list items
- Document browser UI

**Future (NOT in this epic):**
- Office 365 integration (Microsoft Graph API, WOPI, in-browser Word/Excel editing)
- Real-time collaborative editing (Tiptap Collaboration with Y.js)
- Document approval workflows with multi-step review chains and notifications
- OCR for scanned PDFs and images
- Document comparison (side-by-side diff of two different documents)
- Custom templates created by workspace admins
- Document access permissions (per-document reader/editor roles)
- Automated review reminders (cron job that notifies when review_date approaches)
- Document signing integration (BankID/electronic signatures)

---

## New Dependencies (npm packages)

| Package | Purpose | License |
|---------|---------|---------|
| `@tiptap/react` + extensions | Rich text editor | MIT |
| `@tiptap/starter-kit` | Core editor extensions bundle | MIT |
| `@tiptap/extension-table` | Table editing | MIT |
| `@tiptap/extension-image` | Inline images | MIT |
| `@tiptap/extension-text-align` | Text alignment | MIT |
| `@tiptap/extension-placeholder` | Placeholder text | MIT |
| `@tiptap/extension-color` | Text color | MIT |
| `@tiptap/extension-highlight` | Highlight color | MIT |
| `@tiptap/extension-underline` | Underline formatting | MIT |
| `mammoth` | .docx → HTML conversion | BSD-2-Clause |
| `docx` | Generate .docx files from code | MIT |
| `exceljs` | Read .xlsx files (text extraction) | MIT |
| `diff` or `diff-match-patch` | Text diffing for version comparison | Apache-2.0 / BSD |

All packages use permissive licenses (MIT, BSD, Apache 2.0) — compliant with Section 3.6 License Compliance Policy.
