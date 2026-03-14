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

## Story 6.1: Refactor Dashboard Summary View

**As a** user,
**I want** to see a dashboard when I log in,
**so that** I get an overview of my compliance status and priorities.

**Implementation Note:** Dashboard already exists at `/dashboard` (basic version). This story refactors it with compliance-focused widgets.

**Acceptance Criteria:**

1. Refactor existing dashboard page at `/dashboard` (default landing after login)
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

## Story 6.2: Enhance Law List with Compliance View

**As a** user,
**I want** to see my law list with compliance status per item,
**so that** I know which laws need attention.

**Implementation Note:** Law list table already exists with good UX. This story enhances it with compliance-specific columns and functionality rather than replacing the existing table.

**Acceptance Criteria:**

1. Enhance existing law list table to display compliance data per list item
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

**Design Reference:** Mimic Jira's issue modal layout as closely as possible while maintaining Laglig's design language.

**Acceptance Criteria:**

1. Clicking list item opens large modal (80% viewport width, 90% height, Jira-style)
2. Modal is scoped to that specific list item (not the global legal document)

**Modal Layout (Two-Panel Jira-Style):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Breadcrumb: List Name / Law Title]                    [X] Close        │
├─────────────────────────────────────────────┬───────────────────────────┤
│                                             │                           │
│  LEFT PANEL (60% width, SCROLLABLE)         │  RIGHT PANEL (40% width)  │
│  ─────────────────────────────────────────  │  STATIC (fixed position)  │
│                                             │                           │
│  ┌─ Law Title + SFS Number ─────────────┐   │  ┌─ Detaljer ───────────┐ │
│  │ Arbetsmiljölagen (1977:1160)         │   │  │                      │ │
│  │ [Category Badge] [Status Dropdown ▼] │   │  │ Status: [Dropdown ▼] │ │
│  └──────────────────────────────────────┘   │  │ Ansvarig: [User ▼]   │ │
│                                             │  │ Skapad: 2025-01-01   │ │
│  ┌─ Lagtext (collapsible) ──────────────┐   │  │ Uppdaterad: 2025-01-08│ │
│  │ Actual law content from legal_doc    │   │  │                      │ │
│  │ in scrollable container (max 300px)  │   │  └──────────────────────┘ │
│  │ "Visa mer" expands, "Visa mindre"    │   │                           │
│  └──────────────────────────────────────┘   │  ┌─ Snabblänkar ────────┐ │
│                                             │  │ [Visa fullständig lag]│ │
│  ┌─ Affärskontext ──────────────────────┐   │  │ [Fråga AI om lagen]  │ │
│  │ "Hur påverkar denna lag oss?"        │   │  └──────────────────────┘ │
│  │ [Markdown textarea, auto-saves]      │   │                           │
│  └──────────────────────────────────────┘   │  ┌─ Uppgifter ──────────┐ │
│                                             │  │ 3/5 klara            │ │
│  ┌─ Aktivitet ──────────────────────────┐   │  │ [Progress bar]       │ │
│  │ [Alla] [Kommentarer] [Uppgifter]     │   │  │ • Uppgift 1 ✓        │ │
│  │ [Bevis] [Historik]                   │   │  │ • Uppgift 2 ⏳       │ │
│  │                                      │   │  │ • Uppgift 3 ○        │ │
│  │ Tab content scrolls here...          │   │  │ [+ Skapa uppgift]    │ │
│  │ - Comments (threaded)                │   │  └──────────────────────┘ │
│  │ - Task list                          │   │                           │
│  │ - Evidence grid                      │   │  ┌─ Bevis ──────────────┐ │
│  │ - History log                        │   │  │ 4 filer              │ │
│  │                                      │   │  │ [📄] [📄] [📄] [📄] │ │
│  └──────────────────────────────────────┘   │  └──────────────────────┘ │
│                                             │                           │
└─────────────────────────────────────────────┴───────────────────────────┘
```

**Modal Header:** 3. Breadcrumb showing: List name → Law title 4. Close button (X) top-right + ESC key closes modal

**Left Panel (Scrollable - 60% width):** 5. **Law Header:** Title + SFS number + Category badge + Status dropdown 6. **Lagtext Section (Collapsible):**

- Shows actual legal document content from the linked legal_document
- Initial view: First 300px with gradient fade
- "Visa mer" button expands to show full content (scrollable within section)
- "Visa mindre" collapses back
- Helps users reference the actual law without leaving modal

7. **Affärskontext (Business Context):**
   - Textarea: "Hur påverkar denna lag oss?"
   - Markdown supported, auto-saves on blur
   - Placeholder text guiding user
8. **Aktivitet Section with Tabs:**
   - **Alla:** Combined feed of comments, task updates, evidence uploads, changes
   - **Kommentarer:** Threaded comments (Jira-style)
   - **Uppgifter:** Task list with status, click opens Task Modal
   - **Bevis:** Evidence grid/list with previews
   - **Historik:** Audit log of all changes

**Right Panel (Static/Fixed - 40% width):** 9. **Detaljer Box:**

- Status dropdown (Ej påbörjad, Pågående, Uppfylld, Ej uppfylld, Ej tillämplig)
- Ansvarig (Responsible person selector)
- Created date
- Last updated date

10. **Snabblänkar Box:**
    - "Visa fullständig lag" → Opens law detail page in new tab
    - "Fråga AI om lagen" → Opens AI chat with law context
11. **Uppgifter Summary Box:**
    - Task progress: "3/5 klara" with progress bar
    - List of tasks (max 5 shown) with status indicators
    - Click task → Opens Task Modal (Story 6.6)
    - "+ Skapa uppgift" button
12. **Bevis Summary Box:**
    - File count: "4 filer"
    - Thumbnail grid of recent evidence
    - Click → Scrolls to Evidence tab in left panel

**Mobile Behavior:** 13. Modal becomes full-screen on mobile 14. Two-panel layout collapses to single column (left panel content, then right panel details below) 15. Tabs become horizontal scrollable pills

---

## Story 6.4: Implement Task Workspace (Jira-Style with Tabs)

**As a** user,
**I want** a dedicated workspace to manage all my tasks,
**so that** I can track compliance work across all laws.

**Design Reference:** Mimic Jira's project workspace with tab-based navigation (Summary, Active sprints, List, Calendar, All work).

**Acceptance Criteria:**

1. Task Workspace page at `/workspace/tasks`
2. **Tab Navigation Bar** (Jira-style, horizontal tabs below header):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Uppgifter                                            [+ Ny uppgift]    │
├─────────────────────────────────────────────────────────────────────────┤
│  [Sammanfattning] [Aktiva] [Lista] [Kalender] [Alla uppgifter]          │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Search...] [Filter ▼] [Assignee ▼] [Type ▼] [More filters ▼]         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tab 1: Sammanfattning (Summary):** 3. Status overview donut chart: Open, In Progress, Done counts 4. Priority breakdown bar chart: Blocker, Critical, Major, Minor counts 5. Recent activity feed (last 10 task updates) 6. Team workload distribution (tasks per assignee) 7. Overdue tasks alert section 8. "View all work items" link → Alla uppgifter tab

**Tab 2: Aktiva (Active - Kanban Board):** 9. Default columns (Swedish): Att göra, Pågående, Klar 10. Drag-and-drop tasks between columns 11. Task cards show: title, linked law badge, assignee avatar, due date, priority indicator 12. Overdue tasks highlighted (red border) 13. Column headers show count: "Pågående (5)" 14. Swimlanes option: Group by assignee (like Jira screenshot)

**Tab 3: Lista (List View):** 15. Table with columns: Type icon, Key, Summary, Status, Comments, Assignee, Due date, Priority, Labels 16. Sortable columns (click header) 17. Inline quick-edit for status 18. Bulk select + bulk actions (change status, assign, delete) 19. Customizable columns (show/hide via settings)

**Tab 4: Kalender (Calendar View):** 20. Monthly calendar grid 21. Tasks displayed on their due dates 22. Sprint/period bars shown across date ranges (if applicable) 23. Click date → Create task with that due date 24. Click task → Opens Task Modal 25. Filter by assignee, status, type

**Tab 5: Alla uppgifter (All Work):** 26. Complete history of all tasks ever created 27. Includes completed/archived tasks 28. Table view with full filtering capability 29. Status filter includes: All, Open, In Progress, Done, Archived 30. Export to CSV option

**Filtering (all tabs except Summary):** 31. Filter by: status, assignee, linked law/list, due date range, priority, labels 32. Search by task title/description 33. Filter state persisted in URL 34. Quick filters: "My tasks", "Overdue", "Due this week"

**Performance:** 35. Smooth with 200+ tasks 36. Virtual scrolling for list views 37. Lazy-load calendar events by visible month

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

**Design Reference:** Use SAME proportions as Legal Document Modal (Story 6.3) for UX consistency - users should "feel at home" switching between modals.

**Acceptance Criteria:**

1. Clicking task opens large modal (80% viewport width, 90% height - SAME as Legal Document Modal)

**Modal Layout (Two-Panel - Matching Legal Document Modal):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Breadcrumb: Uppgifter / Task Title]                   [X] Close        │
├─────────────────────────────────────────────┬───────────────────────────┤
│                                             │                           │
│  LEFT PANEL (60% width, SCROLLABLE)         │  RIGHT PANEL (40% width)  │
│  ─────────────────────────────────────────  │  STATIC (fixed position)  │
│                                             │                           │
│  ┌─ Task Title (editable) ──────────────┐   │  ┌─ Detaljer ───────────┐ │
│  │ [Inline edit on click]               │   │  │ Status: [Dropdown ▼] │ │
│  │ [Status Badge] [Priority Badge]      │   │  │ Ansvarig: [User ▼]   │ │
│  └──────────────────────────────────────┘   │  │ Förfallodatum: [📅]  │ │
│                                             │  │ Prioritet: [▼]       │ │
│  ┌─ Beskrivning ────────────────────────┐   │  │ Skapad: 2025-01-01   │ │
│  │ [Rich text editor, markdown]         │   │  │ Av: Anna Andersson   │ │
│  │ [Auto-saves on blur]                 │   │  └──────────────────────┘ │
│  └──────────────────────────────────────┘   │                           │
│                                             │  ┌─ Länkade lagar ──────┐ │
│  ┌─ Aktivitet ──────────────────────────┐   │  │ • Arbetsmiljölagen   │ │
│  │ [Alla] [Kommentarer] [Historik]      │   │  │ • GDPR               │ │
│  │                                      │   │  │ [+ Lägg till länk]   │ │
│  │ Comment input box at top:            │   │  └──────────────────────┘ │
│  │ ┌──────────────────────────────────┐ │   │                           │
│  │ │ "Lägg till en kommentar..."      │ │   │  ┌─ Bevis ──────────────┐ │
│  │ │ [Suggest reply] [Status update]  │ │   │  │ [Drag files here]    │ │
│  │ └──────────────────────────────────┘ │   │  │ 📄 policy.pdf        │ │
│  │                                      │   │  │ 📄 checklist.xlsx    │ │
│  │ Threaded comments below...           │   │  │ [+ Välj fil]         │ │
│  │ History entries...                   │   │  └──────────────────────┘ │
│  │                                      │   │                           │
│  └──────────────────────────────────────┘   │  ┌─ Etiketter ──────────┐ │
│                                             │  │ [GDPR] [Urgent] [+]  │ │
│                                             │  └──────────────────────┘ │
└─────────────────────────────────────────────┴───────────────────────────┘
```

**Modal Header:** 2. Breadcrumb: "Uppgifter / [Task Title]" 3. Close button (X) + ESC key closes modal

**Left Panel (Scrollable - 60% width):** 4. **Task Title:** Large, editable inline on click 5. **Status + Priority Badges:** Visual indicators below title 6. **Beskrivning:** Rich text editor (markdown), auto-saves on blur 7. **Aktivitet Section with Tabs:**

- **Alla:** Combined feed of comments and history
- **Kommentarer:** Threaded comments only
- **Historik:** Change log only

8. **Comment Input Box (always visible at top of Aktivitet):**
   - Avatar + "Lägg till en kommentar..." placeholder
   - Quick action buttons: "Suggest a reply...", "Status update...", "Thanks..."
   - Like Jira's comment input with suggestions

**Comments (Jira-style threaded):** 9. Threaded replies with nesting 10. User avatar + name + timestamp 11. Markdown supported in comments 12. Edit/delete own comments (with "Redigerad" indicator) 13. "Svara" button for threading 14. @mentions with autocomplete

**History:** 15. All changes: status, assignee, due date, description edits 16. Format: "Anna ändrade status till Klar - 2025-01-07 14:32"

**Right Panel (Static/Fixed - 40% width):** 17. **Detaljer Box:** - Status dropdown (moves task between columns) - Ansvarig: User selector dropdown - Förfallodatum: Date picker (hard deadline) - Prioritet: Hög/Medium/Låg selector - Skapad: Date + creator name 18. **Länkade lagar Box:** - List of linked list items with category badges - Click → Opens that Legal Document Modal - "+ Lägg till länk" → Search and add more list items - Shows "relates to" / "blocked by" relationship types (future) 19. **Bevis Box:** - Drag-and-drop zone - List of attached files with icons - Preview on hover for images - Upload to Supabase Storage - Accepted types: PDF, images, Office docs - Max file size: 25MB 20. **Etiketter Box:** - Tag input for custom labels - Click to add, X to remove

**Footer:** 21. Created date + creator (subtle text) 22. Last updated timestamp 23. "Radera uppgift" button (with confirmation modal)

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

## Story 6.9: Enable Threaded Comments on Law List Item Modal

> **Note:** The original 6.9 scope (task modal threaded comments — AC 1-10 below) was implemented as part of **Story 6.6**. Story 6.9 has been rescoped to enable the same commenting capability on **law list item modals**, replacing the placeholder "Kommentarer" tab from Story 6.3. See `docs/stories/6.9.threaded-comments.md` (v2.2) for the current scope.

**As a** compliance team member,
**I want** to add threaded comments on law list items,
**so that** I can discuss compliance status, interpretations, and action items directly in context with my colleagues.

**Acceptance Criteria (rescoped):**

1. Comments tab in law list item modal displays threaded comments (same UX as task modal)
2. Users can create root comments on a law list item (content: 1–5000 characters)
3. Users can reply to comments (max 3 levels: root → reply → reply-to-reply)
4. Users can edit their own comments ("Redigerad" indicator shown)
5. Users can delete their own comments (with confirmation, cascades to replies)
6. Comments appear in the "Alla" activity feed alongside existing activity types
7. Comments are scoped to workspace — users only see comments from their workspace
8. Empty state shows "Inga kommentarer ännu" with prompt to add one
9. @mentions: typing @ searches workspace members, mentioned users stored in `mentions` array

<details>
<summary>Original AC 1-10 (satisfied by Story 6.6 — task modal comments)</summary>

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

</details>

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

## Story 6.14: Grouped Accordion Table View

**As a** user with many laws in my list,
**I want** to view documents grouped into collapsible accordion sections in table view,
**so that** I can organize and navigate large lists more efficiently.

**Implementation Note:** Extends Story 4.13 (card view grouping) to table view with GroupTableSection component.

**Acceptance Criteria:**

1. Table view supports grouped accordion display matching card view behavior
2. Each group header shows group name and document count
3. Groups are collapsible/expandable with chevron toggle
4. Cross-group drag-and-drop for moving items between groups
5. Expand all / Collapse all actions available
6. Group name clickable to filter to that group
7. Mobile responsive with 44px touch targets

---

## Story 6.15: Bidirectional Task Linking

**As a** user managing compliance tasks,
**I want** tasks linked to list items to be visible from both the task and the list item,
**so that** I can navigate between related compliance work items easily.

**Acceptance Criteria:**

1. Tasks accordion in Legal Document Modal shows linked tasks
2. Task progress indicator in modal header
3. Redis caching for task progress queries
4. Bidirectional navigation between tasks and list items

---

## Story 6.16: Law List UX Tooltips

**As a** compliance user,
**I want** clear explanations for Efterlevnad and Prioritet columns,
**so that** I can correctly assess compliance status and risk priority.

**Acceptance Criteria:**

1. Column-level tooltips for Efterlevnad and Prioritet headers
2. Dropdown option tooltips explaining each status/priority level
3. "Pågående" label updated to "Delvis uppfylld"
4. Warning indicator for high-priority non-compliant items
5. Consistent tooltips in both table and modal views

---

## Story 6.17: Group Compliance Overview Indicators

**As a** compliance user viewing grouped law lists,
**I want** to see aggregated compliance status and priority risk indicators in each group header,
**so that** I can quickly assess overall compliance health and risk level per group without expanding individual sections.

**Extends:** Stories 6.14 (grouped view) and 6.16 (compliance/priority UX)

**Acceptance Criteria:**

1. Compliance progress indicator in group header (fraction + progress bar)
2. Progress bar color coded: green (100%), blue (50-99%), amber (1-49%), red (0%)
3. Calculations exclude `EJ_TILLAMPLIG` items
4. Priority risk badges showing count per level (Hög/Medel/Låg)
5. Only show badges for non-zero priority counts
6. Tooltips showing full breakdown for both indicators
7. Responsive: hide priority badges on mobile, show only compliance fraction
8. Indicators positioned between group name and document count
9. Performance: client-side calculations with useMemo, no additional API calls
10. Consistent display in both table and card grouped views

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

**Epic 6 Revised: 17 stories**

---
