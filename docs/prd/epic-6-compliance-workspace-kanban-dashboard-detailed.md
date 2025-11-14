# Epic 6: Compliance Workspace (Kanban + Dashboard) (DETAILED)

**Goal:** Provide Jira-inspired Kanban board for visual compliance tracking and summary dashboard.

**Value Delivered:** Visual compliance progress tracking + dashboard provides actionable insights + task management enables workflow automation.

---

## Story 6.1: Build Dashboard Summary View

**As a** user,
**I want** to see a dashboard when I log in,
**so that** I get an overview of my compliance status and priorities.

**Acceptance Criteria:**

1. Dashboard page created at `/dashboard` (default landing after login)
2. **Compliance Progress Ring:** Circular progress chart showing % of laws "Compliant" vs total
3. **AI Insights Section:**
   - Recent law changes (last 7 days) affecting workspace
   - New laws recommended for industry
   - AI-generated priority suggestions: "3 laws need urgent attention"
4. **Quick Actions:** Buttons for "Ask AI", "Add Law", "Invite Team", "Add Employee"
5. **Recent Activity Feed:**
   - Last 10 actions: "Anna reviewed Law X", "Law Y changed yesterday"
   - Timestamp + user avatar
6. **Law List Preview:** Top 5 prioritized laws with status badges
7. Mobile-responsive layout (stacked sections on mobile)
8. Dashboard loads in <2 seconds

---

## Story 6.2: Create Kanban Compliance Workspace

**As a** user,
**I want** to organize laws in a Kanban board,
**so that** I track progress from "Not Started" to "Compliant".

**Acceptance Criteria:**

1. Kanban page created at `/workspace`
2. Five columns: Not Started, In Progress, Blocked, Review, Compliant
3. Each law in user's law list displayed as card in appropriate column
4. Law cards show: title, category badge, priority (High/Medium/Low), assigned employee (if any)
5. Drag-and-drop to move cards between columns
6. Column headers show count: "In Progress (5)"
7. Cards persist position after refresh
8. "Add Law" button in each column
9. Empty state: "No laws in this column yet"
10. Mobile: Horizontal scroll for columns, or vertical stack with section headers

---

## Story 6.3: Implement Law Card Modal (Detailed View)

**As a** user,
**I want** to click a law card to see full details and add notes,
**so that** I can manage that law's compliance.

**Acceptance Criteria:**

1. Clicking law card opens modal
2. Modal displays:
   - Law title, SFS number
   - Category badge
   - AI summary (200 words)
   - Current status (column)
   - Priority dropdown (High/Medium/Low)
   - Assigned employees (multi-select dropdown)
   - Due date picker (optional)
   - Notes textarea (markdown supported)
   - Tags input (custom tags)
3. "View Full Law" link → Opens individual law page
4. "Ask AI About This" button → Opens chat with law pre-loaded in context
5. "Save" button persists changes
6. "Close" or ESC key closes modal
7. Modal mobile-responsive (full-screen on mobile)

---

## Story 6.4: Add Task Management to Law Cards

**As a** user,
**I want** to create tasks within each law card,
**so that** I break down compliance into actionable steps.

**Acceptance Criteria:**

1. Law card modal includes "Tasks" section
2. Task list shows existing tasks with checkboxes
3. "Add Task" button creates new task
4. Task fields: Title, Description (optional), Assigned to (team member), Due date
5. Checking task marks it complete
6. Task completion % shown on law card: "3/5 tasks complete"
7. Tasks stored in `law_tasks` table: id, law_id, workspace_id, title, assigned_to, due_date, completed
8. Kanban card shows task progress bar
9. Overdue tasks highlighted in red

---

## Story 6.5: Implement Drag-and-Drop for Kanban Board

**As a** user,
**I want** to drag law cards between columns,
**so that** I update compliance status visually.

**Acceptance Criteria:**

1. Law cards draggable using `@dnd-kit` or `react-beautiful-dnd`
2. Columns are drop zones
3. Dragging card shows visual feedback (card follows cursor, drop zone highlights)
4. Dropping card in new column → Backend updates law status
5. Smooth animation on drop
6. Optimistic UI update (card moves immediately, rollback if API fails)
7. Keyboard accessibility: Arrow keys + Enter to move cards
8. Touch support for mobile (drag with finger)
9. Performance: Smooth with 100+ law cards

---

## Story 6.6: Add Filtering and Search to Kanban

**As a** user,
**I want** to filter laws on the Kanban board,
**so that** I focus on specific categories or priorities.

**Acceptance Criteria:**

1. Filter bar above Kanban board
2. Filters available:
   - Category (multi-select dropdown)
   - Priority (High/Medium/Low)
   - Assigned employee (dropdown)
   - Tags (multi-select)
3. Search input filters by law title
4. Filters stack (AND logic): Category=Arbetsrätt AND Priority=High
5. Filtered results shown immediately (client-side filtering)
6. Clear filters button
7. Filter state persisted in URL query params
8. Mobile: Filters in collapsible section

---

## Story 6.7: Implement Kanban Column Customization

**As a** user,
**I want** to customize Kanban columns,
**so that** I match my compliance workflow.

**Acceptance Criteria:**

1. Settings → Workspace → "Customize Kanban" section
2. User can rename columns (default: Not Started, In Progress, Blocked, Review, Compliant)
3. User can add new columns (max 8 columns)
4. User can reorder columns (drag-and-drop)
5. User can delete custom columns (laws move to "Not Started")
6. Column customization saved per workspace
7. Default columns cannot be deleted (only renamed)

---

## Story 6.8: Add Bulk Actions to Kanban

**As a** user,
**I want** to perform bulk actions on multiple laws,
**so that** I update many laws at once.

**Acceptance Criteria:**

1. Checkbox on each law card
2. "Select All" checkbox in column header
3. Bulk actions toolbar appears when ≥1 card selected
4. Actions available:
   - Move to column (dropdown)
   - Set priority (dropdown)
   - Assign to employee (dropdown)
   - Add tag (input)
   - Delete from list (confirmation)
5. Bulk action applied to all selected cards
6. Success toast: "5 laws moved to In Progress"
7. Deselect all after action completes

---

## Story 6.9: Implement Global Search (Cmd+K)

**As a** user,
**I want** to search across laws, tasks, employees, and comments,
**so that** I quickly find anything in my workspace.

**Acceptance Criteria:**

1. Keyboard shortcut `/` or `Cmd+K` (Mac) or `Ctrl+K` (Windows) opens search modal
2. Search input with autofocus
3. As user types, results appear instantly
4. Results grouped by type: Laws (5), Tasks (3), Employees (2), Comments (1)
5. Each result shows: title, snippet, breadcrumb (where it's from)
6. Arrow keys navigate results, Enter opens selected result
7. Search uses full-text search on database or client-side search
8. Recent searches shown when input empty
9. ESC closes modal

---

## Story 6.10: Add Export Kanban Board as PDF/Image

**As a** user,
**I want** to export my Kanban board,
**so that** I share it with stakeholders or print for audits.

**Acceptance Criteria:**

1. Export button in Kanban toolbar
2. Export options: PDF, PNG
3. **PDF export:**
   - Renders Kanban board as multi-page PDF
   - Each column on separate page or single wide page
   - Includes workspace logo, date, "Generated by Laglig.se"
4. **PNG export:**
   - Captures visible Kanban board as image
   - High resolution (2x for retina)
5. Download triggered automatically
6. Filename: `Kanban-Board-[Workspace-Name]-[Date].pdf`
7. Watermark: "Laglig.se Compliance Workspace"

---

**Epic 6 Complete: 10 stories, 2-3 weeks estimated**

---
