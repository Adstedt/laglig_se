# Epic 6: Compliance Workspace - Tasks, Evidence & Audit Trail (DETAILED)

**Goal:** Provide a complete compliance management system where users track obligations, execute tasks, attach evidence, and maintain audit-ready documentation.

**Value Delivered:** End-to-end compliance workflow from "this law applies to us" to "we can prove how we comply with it."

**Supersedes:** Original Epic 6 (Kanban + Dashboard) - conceptual model revised based on product refinement.

---

## Conceptual Model

### Hierarchy

```
Organization
└── Workspace
    └── Document Lists (created in Epic 4)
        └── List Items (instances of legal documents on a list)
            ├── Business Context (how this law affects this specific list/context)
            ├── Compliance Status (manual for MVP)
            ├── Responsible Person (main owner)
            └── Tasks[] (compliance work items)
                ├── Assignee, Status, Priority, Due Date
                ├── Comments[] (threaded)
                ├── Evidence[] (file uploads)
                └── Linked List Items[] (cross-references)
```

### Key Principles

1. **Legal Documents = Obligations** - Stable reference documents (laws, regulations)
2. **List Items = Contextual Instances** - Same law can appear on multiple lists with independent tracking
3. **Tasks = Execution** - Action-oriented work items that change over time
4. **Evidence = Proof** - Attached to tasks, flows up to list items for traceability
5. **Compliance Status = Derived (future) / Manual (MVP)** - Credible, not checkbox compliance

### Multi-List Scenario

The same legal document (e.g., GDPR) can appear on multiple lists:

- "Lager Stockholm" - with its own business context, tasks, evidence, status
- "Lager Malmö" - with different context, different tasks, different status

This supports organizations with multiple facilities, departments, or compliance contexts.

---

## Story 6.1: Build Dashboard Summary View

**As a** user,
**I want** to see a dashboard when I log in,
**so that** I get an overview of my compliance status and priorities.

**Acceptance Criteria:**

1. Dashboard page created at `/dashboard` (default landing after login)
2. **Compliance Progress Ring:** Circular progress chart showing % of list items marked "Uppfylld" vs total
3. **Task Summary Cards:**
   - Förfallna uppgifter (overdue count, red)
   - Uppgifter denna vecka (due this week)
   - Mina tilldelade uppgifter (assigned to current user)
4. **Recent Activity Feed:**
   - Last 10 actions: "Anna slutförde uppgift X", "Lag Y ändrades igår"
   - Timestamp + user avatar
5. **Quick Actions:** Buttons for "Fråga AI", "Lägg till lag", "Bjud in teammedlem"
6. **List Overview:** Top 5 lists with compliance summary per list
7. Mobile-responsive layout (stacked sections on mobile)
8. Dashboard loads in <2 seconds

---

## Story 6.2: Build Law List Compliance View

**As a** user,
**I want** to see my law list with compliance status per item,
**so that** I know which laws need attention.

**Acceptance Criteria:**

1. Law List page displays all list items for selected list
2. Each row shows:
   - Legal document title
   - SFS/document number
   - Category badge
   - Compliance status badge (color-coded)
   - Task progress: "3/5 uppgifter klara"
   - Responsible person (avatar + name)
   - Last activity date
3. **Compliance Status Options (Swedish):**
   - Ej påbörjad (gray)
   - Pågående (blue)
   - Uppfylld (green)
   - Ej uppfylld (red)
   - Ej tillämplig (gray, strikethrough)
4. Sortable columns: title, status, tasks, last activity
5. Filter by: status, category, responsible person
6. Search by title/document number
7. Click row → Opens Legal Document Modal (Story 6.3)
8. Bulk select + bulk status change
9. Lists typically contain 60-100 items, must perform smoothly

---

## Story 6.3: Implement Legal Document Modal (Jira-Style Deep Workspace)

**As a** user,
**I want** to click a law in my list to open a detailed modal,
**so that** I can manage compliance for that specific law in context.

**Acceptance Criteria:**

1. Clicking list item opens large modal (80% viewport, Jira-style)
2. Modal is scoped to that specific list item (not the global legal document)

**Modal Header:** 3. Legal document title + SFS number 4. Category badge 5. Compliance status dropdown (editable) 6. Responsible person selector 7. "Visa fullständig lag" link → Opens law detail page in new tab 8. Close button (X) + ESC key closes modal

**Modal Tabs:** 9. **Översikt (Overview):**

- Business context textarea: "Hur påverkar denna lag oss?"
- Markdown supported, auto-saves
- AI summary of the law (read-only, from Epic 3)
- Quick stats: X tasks, Y evidence files, last updated date

10. **Uppgifter (Tasks):**
    - List of tasks linked to this list item
    - Task cards show: title, status badge, assignee avatar, due date
    - "Skapa uppgift" button → Task creation form
    - Click task → Opens Task Modal (Story 6.6)

11. **Bevis (Evidence):**
    - Grid/list of evidence files attached to tasks for this list item
    - Evidence "flows up" from tasks
    - Each file shows: filename, upload date, uploader, linked task
    - Preview capability for images/PDFs
    - Download button

12. **Historik (History):**
    - Audit log of all changes to this list item
    - Entries: status changes, responsible changes, context edits
    - Format: "Anna ändrade status från Pågående till Uppfylld - 2025-01-07 14:32"
    - Filterable by action type

**Mobile Behavior:** 13. Modal becomes full-screen on mobile 14. Tabs become horizontal scrollable pills

---

## Story 6.4: Implement Task Workspace (Kanban + List View)

**As a** user,
**I want** a dedicated workspace to manage all my tasks,
**so that** I can track compliance work across all laws.

**Acceptance Criteria:**

1. Task Workspace page at `/workspace/tasks`
2. Toggle between Kanban view and List view

**Kanban View:** 3. Default columns (Swedish): Att göra, Pågående, Klar 4. Drag-and-drop tasks between columns 5. Task cards show: title, linked law badge, assignee avatar, due date, priority indicator 6. Overdue tasks highlighted (red border) 7. Column headers show count: "Pågående (5)"

**List View:** 8. Table with columns: Task title, Status, Linked law, Assignee, Due date, Priority 9. Sortable columns 10. Bulk select + bulk actions

**Filtering (both views):** 11. Filter by: status, assignee, linked law/list, due date range, priority 12. Search by task title 13. Filter state persisted in URL

**Performance:** 14. Smooth with 200+ tasks 15. Virtual scrolling for list view if needed

---

## Story 6.5: Implement Custom Task Columns

**As a** user,
**I want** to customize my Kanban columns,
**so that** I match my organization's workflow.

**Acceptance Criteria:**

1. Settings → Arbetsflöde → "Anpassa kolumner"
2. Default columns: Att göra, Pågående, Klar (cannot be deleted, can be renamed)
3. User can add custom columns (max 8 total)
4. User can name columns freely (Swedish text)
5. User can reorder columns via drag-and-drop
6. User can delete custom columns (tasks move to "Att göra")
7. Column configuration saved per workspace
8. All workspace members see same columns
9. Color picker for column headers (optional)

---

## Story 6.6: Implement Task Modal (Jira-Style)

**As a** user,
**I want** to click a task to see full details,
**so that** I can manage task execution and collaboration.

**Acceptance Criteria:**

1. Clicking task opens large modal (Jira-style, 70% viewport)

**Modal Header:** 2. Task title (editable inline) 3. Status dropdown (moves task between columns) 4. Priority dropdown: Hög, Medium, Låg 5. Close button (X) + ESC key

**Modal Left Panel (Main Content):** 6. **Beskrivning:** Rich text editor (markdown), auto-saves 7. **Aktivitet:** Tabs for Alla, Kommentarer, Historik 8. **Comments:**

- Threaded replies (Jira-style)
- User avatar + name + timestamp
- Markdown supported in comments
- Edit/delete own comments
- "Svara" button for threading

9. **History:**
   - All changes: status, assignee, due date, description edits
   - Format: "Anna ändrade status till Klar - 2025-01-07"

**Modal Right Panel (Details Sidebar):** 10. **Ansvarig:** User selector dropdown 11. **Förfallodatum:** Date picker (hard deadline) 12. **Prioritet:** Hög/Medium/Låg selector 13. **Länkade lagar:** List of linked list items with badges - Click → Opens that Legal Document Modal - "Lägg till länk" → Search and add more list items 14. **Bevis (Evidence):** - File upload area (drag-and-drop) - List of attached files with preview/download - Upload to Supabase Storage - Accepted types: PDF, images, Office docs - Max file size: 25MB 15. **Etiketter (Labels):** Tag input for custom labels

**Footer:** 16. Created date + creator 17. Last updated date 18. "Radera uppgift" button (with confirmation)

---

## Story 6.7: Implement Task Creation Flow

**As a** user,
**I want** to create tasks from multiple entry points,
**so that** I can capture compliance work when I identify it.

**Acceptance Criteria:**

**From Legal Document Modal:**

1. "Skapa uppgift" button in Tasks tab
2. Task automatically linked to current list item
3. Quick form: title, description (optional), assignee, due date
4. "Skapa" saves and shows task in list
5. "Skapa och öppna" saves and opens Task Modal

**From Task Workspace:** 6. "Ny uppgift" button in toolbar 7. Full form with all fields including linked laws selector 8. Task appears in "Att göra" column

**From Quick Add (Global):** 9. Keyboard shortcut (Ctrl+Shift+T) opens quick task dialog 10. Minimal form: title + optional link to law 11. Created in default list or last-used list

**Validation:** 12. Title required (min 3 characters) 13. Due date optional but recommended (show warning if empty)

---

## Story 6.8: Implement Evidence Upload System

**As a** user,
**I want** to attach evidence files to tasks,
**so that** I can prove compliance work was completed.

**Acceptance Criteria:**

1. Evidence upload in Task Modal right panel
2. Drag-and-drop zone + "Välj fil" button
3. **Accepted file types:** PDF, PNG, JPG, JPEG, GIF, DOC, DOCX, XLS, XLSX, PPT, PPTX
4. **Max file size:** 25MB per file
5. **Max files per task:** 20
6. Files uploaded to Supabase Storage
7. Progress indicator during upload
8. File metadata stored: filename, size, type, uploader, upload_date, task_id
9. Preview capability:
   - Images: Inline preview
   - PDFs: Thumbnail + open in new tab
   - Office docs: Icon + download
10. Download button for all files
11. Delete button (with confirmation, only uploader or admin)
12. Evidence list shows in Legal Document Modal → Bevis tab (aggregated from all tasks)

**Storage Organization:** 13. Path: `/{workspace_id}/evidence/{task_id}/{filename}` 14. Access control via Supabase RLS (workspace members only)

---

## Story 6.9: Implement Threaded Comments

**As a** user,
**I want** to have threaded discussions on tasks,
**so that** I can collaborate with my team on compliance work.

**Acceptance Criteria:**

1. Comments section in Task Modal
2. Root comments displayed chronologically
3. "Svara" button on each comment creates nested reply
4. Thread depth: Max 3 levels (root → reply → reply-to-reply)
5. Collapsed threads: "Visa 3 svar" expander
6. **Comment format:**
   - User avatar
   - User name
   - Timestamp (relative: "för 2 timmar sedan")
   - Comment text (markdown rendered)
   - "Svara" button
   - "Redigera" (own comments only)
   - "Radera" (own comments only, with confirmation)
7. Rich text: Bold, italic, links, code blocks, bullet lists
8. @mentions: Type @ to search team members, sends notification
9. Edit history: "Redigerad" indicator, click to see original
10. Real-time updates: New comments appear without refresh (WebSocket or polling)

---

## Story 6.10: Implement Audit Trail & Change Log

**As a** user,
**I want** a complete audit trail of all compliance activities,
**so that** I can demonstrate accountability during audits.

**Acceptance Criteria:**

**List Item History (Legal Document Modal → Historik):**

1. Log entries for:
   - Status changes (old → new)
   - Responsible person changes
   - Business context edits
   - Task created/completed/deleted
   - Evidence uploaded/deleted
2. Entry format: User + Action + Details + Timestamp

**Task History (Task Modal → Historik tab):** 3. Log entries for:

- Status changes
- Assignee changes
- Due date changes
- Priority changes
- Description edits (diff optional)
- Evidence added/removed
- Linked laws added/removed

**Global Activity Log:** 4. Admin page: `/workspace/activity` 5. Filterable by: user, action type, date range, list/law 6. Exportable as CSV for audit purposes 7. Retention: 2 years minimum

**Database Schema:** 8. `activity_log` table: id, workspace_id, user_id, entity_type, entity_id, action, old_value, new_value, created_at 9. Indexed for fast querying by workspace + date range

---

## Story 6.11: Implement Notifications System

**As a** user,
**I want** to receive notifications for relevant compliance activities,
**so that** I stay informed and don't miss deadlines.

**Acceptance Criteria:**

**Notification Triggers:**

1. Task assigned to me
2. Task I'm assigned to is due in 3 days (configurable)
3. Task I'm assigned to is overdue
4. Comment on task I created or am assigned to
5. @mention in any comment
6. Status change on task I created
7. Weekly digest: "Du har 5 uppgifter att slutföra denna vecka"

**In-App Notifications:** 8. Bell icon in header with unread count badge 9. Dropdown panel shows recent notifications 10. Click notification → Navigate to relevant modal 11. "Markera alla som lästa" action 12. Notifications persist for 30 days

**Email Notifications:** 13. Same triggers as in-app (user configurable) 14. Email template with action button (deep link) 15. Unsubscribe per notification type 16. Digest option: Immediate / Daily / Weekly / Off

**Settings:** 17. User preferences page for notification configuration 18. Toggle each notification type on/off 19. Choose email frequency per type

---

## Story 6.12: Implement Global Search (Cmd+K)

**As a** user,
**I want** to search across all compliance data,
**so that** I quickly find laws, tasks, or evidence.

**Acceptance Criteria:**

1. Keyboard shortcut `/` or `Cmd+K` (Mac) / `Ctrl+K` (Windows)
2. Search modal with autofocus input
3. **Search scope:**
   - Legal documents (title, SFS number)
   - Tasks (title, description)
   - Comments (text content)
   - Evidence (filename)
4. Results grouped by type with counts
5. Each result shows: title, snippet, breadcrumb
6. Arrow keys navigate, Enter opens result
7. Recent searches shown when input empty
8. ESC closes modal
9. Results appear as user types (<200ms)

---

## Story 6.13: List Item Responsible Assignment

**As a** user,
**I want** to assign a responsible person to each law in my list,
**so that** ownership is clear.

**Acceptance Criteria:**

1. Responsible person field on list item (Legal Document Modal header)
2. Dropdown shows all workspace members
3. Default: Unassigned
4. Responsible person shown in Law List view (avatar)
5. Filter Law List by responsible person
6. Notification sent when assigned as responsible
7. Responsible person receives weekly summary of their assigned laws

---

## Data Model Summary

### New Tables Required

```
list_items (extends existing or new)
  - id
  - document_list_id (FK)
  - legal_document_id (FK)
  - business_context (text)
  - compliance_status (enum)
  - responsible_user_id (FK)
  - created_at, updated_at

tasks
  - id
  - workspace_id (FK)
  - title
  - description
  - status (enum or FK to custom column)
  - priority (enum)
  - assignee_id (FK)
  - due_date
  - created_by_id (FK)
  - created_at, updated_at

task_list_item_links (many-to-many)
  - task_id (FK)
  - list_item_id (FK)
  - legal_document_id (FK, denormalized for stats)

task_columns (custom Kanban columns)
  - id
  - workspace_id (FK)
  - name
  - sort_order
  - color
  - is_default

comments
  - id
  - task_id (FK)
  - parent_comment_id (FK, nullable for threading)
  - user_id (FK)
  - content
  - created_at, updated_at

evidence
  - id
  - task_id (FK)
  - filename
  - storage_path
  - file_size
  - mime_type
  - uploaded_by_id (FK)
  - created_at

activity_log
  - id
  - workspace_id (FK)
  - user_id (FK)
  - entity_type (list_item, task, comment, evidence)
  - entity_id
  - action (created, updated, deleted, status_changed, etc.)
  - old_value (JSON)
  - new_value (JSON)
  - created_at

notifications
  - id
  - user_id (FK)
  - type (enum)
  - title
  - body
  - entity_type
  - entity_id
  - read_at
  - created_at
```

---

## MVP vs. Future Scope

### MVP (This Epic)

- Manual compliance status
- Task Kanban with custom columns
- Legal Document Modal with business context
- Task Modal with comments, evidence
- Basic notifications (assignment, due dates)
- Audit trail

### Future Enhancements (Post-MVP)

- Derived compliance status (based on tasks, evidence, reviews)
- Automated compliance scoring
- Review cycles with scheduled reminders
- Integration with external task systems (Jira, Asana)
- Advanced reporting and analytics
- Compliance templates (pre-built task sets per law)

---

**Epic 6 Revised: 13 stories**

---
