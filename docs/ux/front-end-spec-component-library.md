# Component Library - Detailed Specifications

**Parent Document:** [`front-end-spec.md`](./front-end-spec.md) Section 5

**Version:** 1.0
**Last Updated:** 2025-11-03

---

## Purpose

This document provides **complete implementation specifications** for all 55+ UI components required for Laglig.se MVP, extracted directly from PRD v1.3 (Epics 1-8).

**For high-level overview and context**, see Section 5 of the main [Front-End Specification](./front-end-spec.md).

**For product requirements**, see [PRD v1.3](./prd.md).

---

## What's Inside

- **15 Component Groups** covering all 8 PRD epics
- **55+ Individual Components** with complete specifications
- **PRD Story References** for every component (e.g., "Story 6.3", "FR26")
- **Variants, States, and Interactions** for each component
- **Accessibility Requirements** and implementation notes
- **Priority Rankings** for MVP development

---

## 1. Law Card Component (FR26, Story 6.2, 6.3)

**Purpose:** Primary draggable content unit displaying law metadata throughout the app

**PRD Requirements:**

- FR26: "Display law cards throughout the UI as draggable components with metadata (category, status badge, priority, assigned employees)"
- Story 6.2: Law cards in Kanban show "title, category badge, priority (High/Medium/Low), assigned employee"
- Story 6.3: Modal displays "law title, SFS number, category badge, AI summary (200 words), current status, priority dropdown, assigned employees, due date picker, notes textarea, tags input"

**Variants:**

### 1a. Compact Law Card (List View)

- Law title (truncated at 60 chars)
- SFS number (small, gray)
- Category badge (color-coded)
- Priority indicator (High/Medium/Low)
- Status badge (from Kanban column)

### 1b. Standard Kanban Card

- Law title
- Category badge
- Priority (High/Medium/Low)
- Assigned employee avatar(s)
- Task progress: "3/5 tasks complete" (Story 6.4)
- Task progress bar
- Drag handle indicator

### 1c. Expanded Law Card Modal (Story 6.3)

- Full law title + SFS number
- Category badge
- AI summary (200 words)
- Current status dropdown (Kanban column)
- Priority dropdown (High/Medium/Low)
- Assigned employees (multi-select dropdown)
- Due date picker (optional)
- Notes textarea (markdown supported)
- Tags input (custom tags)
- Tasks section (Story 6.4):
  - Task list with checkboxes
  - "Add Task" button
  - Task fields: Title, Description, Assigned to, Due date
- "View Full Law" link → Opens individual law page
- "Ask AI About This" button → Opens chat with law pre-loaded

### 1d. Draggable Law Card (Stories 3.4, 6.5)

- Made draggable using `@dnd-kit` or `react-beautiful-dnd`
- Visual feedback: Card follows cursor during drag
- Drop zones: Kanban columns, AI chat input area
- Touch support for mobile (drag with finger)
- Keyboard accessibility: Arrow keys + Enter to move

**States:**

- Default
- Hover (elevated shadow)
- Dragging (opacity 0.5, cursor grabbing)
- Selected (for bulk actions - Story 6.8)
- Disabled

**Interactions:**

- Click → Opens Law Card Modal
- Drag → Can be dropped in Kanban columns or AI Chat
- Checkbox (for bulk select) → Shows bulk actions toolbar

---

## 2. Priority Badge Component (Story 8.1, 8.2)

**Purpose:** Visual indicator for law change priority and compliance urgency

**PRD Requirements:**

- Story 8.1: "🔴/🟡/🟢 Priority badge (High/Medium/Low) - DIFFERENTIATION from Notisum"
- Story 8.2: Priority shown in diff view
- Story 8.4: Priority badges in email notifications

**Variants:**

- High Priority: 🔴 Red badge
- Medium Priority: 🟡 Yellow badge
- Low Priority: 🟢 Green badge

**Usage Locations:**

- Change notification cards (Story 8.1)
- Law cards in Kanban (Story 6.2)
- Email notifications (Story 8.4)
- Diff view (Story 8.2)

**Accessibility:**

- Use emoji + text (not color alone)
- Tooltip on hover explains priority reasoning

---

## 3. Kanban Board Component (Epic 6, Stories 6.2-6.8)

**Purpose:** Visual compliance progress tracking with drag-and-drop workflow

**PRD Requirements:**

- Story 6.2: Five columns (Not Started, In Progress, Blocked, Review, Compliant)
- Story 6.5: Drag-and-drop between columns with `@dnd-kit`
- Story 6.6: Filtering by category, priority, assigned employee, tags
- Story 6.7: Column customization (rename, add, reorder, delete)
- Story 6.8: Bulk actions (move, set priority, assign, add tag)

**Structure:**

### Column Component

- Column header with count: "In Progress (5)"
- Drag-and-drop zone for cards
- "Add Law" button
- Empty state: "No laws in this column yet"

### Board Layout

- Desktop: 5 columns side-by-side (horizontal scroll if needed)
- Mobile: Vertical stack with section headers OR horizontal scroll

### Filter Bar (Story 6.6)

- Category (multi-select dropdown)
- Priority (High/Medium/Low)
- Assigned employee (dropdown)
- Tags (multi-select)
- Search input (filters by law title)
- Clear filters button
- Filter state persisted in URL query params

### Bulk Actions Toolbar (Story 6.8)

- Appears when ≥1 card selected
- Actions: Move to column, Set priority, Assign to employee, Add tag, Delete
- Confirmation modals for destructive actions

---

## 4. AI Chat Interface (Epic 3, Stories 3.3-3.8)

**Purpose:** RAG-powered chatbot with drag-and-drop context building

**PRD Requirements:**

- Story 3.3: "AI Chat sidebar (fixed right side, 400px width), streaming responses"
- Story 3.4: "Drag law cards into chat → converts to context pill"
- Story 3.5: "Drag employee cards into chat → adds employee context"
- Story 3.6: "Drag task cards into chat"
- Story 3.7: "Drag documents (PDFs) into chat"

### Chat Sidebar

- Fixed right side, 400px width (desktop)
- Full-screen modal (mobile)
- Message history (scrollable)
- Input field with context pills above
- Send button
- Keyboard shortcut: `Cmd+K` or `/` opens chat (Story 3.3)

### Message Components

#### User Message

- Right-aligned
- Blue bubble
- Avatar optional

#### AI Message (Story 3.3)

- Left-aligned
- Gray bubble
- Laglig.se logo
- Streaming animation (word-by-word TypeWriter effect)
- Citations inline: `[1]`, `[2]`
- Citation tooltip on hover:
  - Law title
  - SFS number
  - Snippet
  - "View law" link

#### Loading State

- Typing indicator: "AI skriver..."
- Animated dots

### Context Pills (Stories 3.4-3.7)

**Purpose:** Display dragged items as context above chat input

**Types:**

1. **Law Context Pill** (Story 3.4)
   - Law title
   - "X" button to remove
   - Max 10 context items

2. **Employee Context Pill** (Story 3.5)
   - Employee name
   - Role
   - "X" button to remove

3. **Task Context Pill** (Story 3.6)
   - Task title
   - "X" button to remove

4. **Document Context Pill** (Story 3.7)
   - Filename
   - File size
   - "X" button to remove

**Behavior:**

- Context persists across chat messages (until manually removed)
- Mobile: Tap item → "Add to chat context" button → pill appears

---

## 5. Diff Viewer Component (Story 8.2)

**Purpose:** GitHub-style visual diff for law amendments

**PRD Requirements:**

- Story 8.2: "Side-by-side comparison: Old version | New version (GitHub-style)"
- Story 8.2: "Changed sections highlighted: Red background for removed text, green for added"
- Story 8.2: "Contextual explanation: § 26 was modified - this section handles X"
- Competitive note: "Notisum shows raw text in grey box - no visual diff"

**Structure:**

### Desktop: Side-by-Side View

- Left column: Old version
- Right column: New version
- Line numbers for reference
- Changed sections highlighted:
  - Red background for deletions
  - Green background for additions
  - Line-through for removed text
  - Underline for added text

### Mobile: Stacked View

- Old version (collapsed by default)
- New version (expanded)
- Vertical layout

### Header

- Law title + SFS number
- Change type badge (Amendment, New Section, Repeal, Metadata Update)
- Detected date
- **AI Summary** (2-3 sentences in plain Swedish)
- **Business Impact** (1 sentence)

### Footer

- "Mark as Reviewed" button
- "View Full Law" link
- "Official Riksdagen PDF" link

### Legend

- "- Borttaget | + Tillagt | ~ Ändrat"
- Always visible

**Diff Library:** Use `diff` npm package or similar (Story 8.2)

---

## 6. Change Notification Card (Story 8.1)

**Purpose:** Display law change summary in Changes tab

**PRD Requirements:**

- Story 8.1: Each change displayed as card with priority badge, AI summary, business impact

**Structure:**

- 🔴/🟡/🟢 Priority badge (High/Medium/Low)
- Law title + SFS number
- Change detected date
- Change type badge (Amendment, New Section, Repeal, Metadata Update)
- **AI Summary** (1-2 sentences in plain Swedish)
- **Business Impact** (1 sentence): "Action required by Dec 1" or "FYI only"
- "View Details" button → Opens diff modal
- "Mark as Reviewed" button

**Sort Order:**

- Priority (High → Medium → Low)
- Then by date (newest first)

**States:**

- Unacknowledged (default, visible in Changes tab)
- Acknowledged (removed from tab after "Mark as Reviewed")

---

## 7. Notification Bell Component (Story 8.5)

**Purpose:** In-app notification indicator for unacknowledged changes

**Structure:**

- Bell icon in top navigation (right side)
- Badge with count: "3" (unacknowledged changes)
- Dropdown on click showing:
  - Last 5 recent changes
  - Each item: Law title, AI summary (truncated to 50 chars), time ago
  - "View All Changes" link at bottom → Opens Changes tab
- Badge disappears when count = 0
- Real-time updates: Poll every 5 minutes or WebSocket

---

## 8. Dashboard Widgets (Story 6.1, FR27)

**PRD Requirements:**

- FR27: "Compliance progress ring, AI insights, quick actions, recent activity feed"
- Story 6.1: Circular progress chart, AI insights, quick actions, activity feed

### Compliance Progress Ring

- Circular progress chart
- Shows % of laws "Compliant" vs total
- Interactive (click → Opens Kanban)

### AI Insights Section

- Recent law changes (last 7 days) affecting workspace
- New laws recommended for industry
- AI-generated priority suggestions: "3 laws need urgent attention"

### Quick Actions

- Buttons: "Ask AI", "Add Law", "Invite Team", "Add Employee"

### Recent Activity Feed

- Last 10 actions: "Anna reviewed Law X", "Law Y changed yesterday"
- Timestamp + user avatar

### Law List Preview

- Top 5 prioritized laws with status badges

**Performance:** Dashboard loads in <2 seconds (Story 6.1)

---

## 9. Onboarding Components (Epic 4, Stories 4.1-4.4b)

### Org-Number Input (Story 4.1)

- Input field: 10 digits, format: XXXXXX-XXXX
- Client-side validation
- Auto-formatting (adds hyphen after 6 digits)
- Privacy note: "Vi hämtar endast publik info från Bolagsverket"

### Dynamic Question Card (Story 4.2b)

- Progress indicator: "Fråga 2 av ~4"
- Contextual intro: "Eftersom ni har 12 anställda:"
- Question text (large, clear Swedish)
- Answer options (radio buttons or large buttons)
- Educational tooltip: "💡 Med 10+ anställda krävs skyddsombud"
- Navigation: [← Tillbaka] [Fortsätt →]
- "Hoppa över" link (small, de-emphasized)

### Streaming Law List (Stories 4.4, 4.4b)

- Laws appear one-by-one with fade-in animation
- Each card: Title, SFS number, category badge, AI commentary (1-2 sentences)
- Progress indicator: "12/20 lagar valda..."
- Badge at bottom: "🔒 +45-65 mer lagar väntar efter registrering" (Phase 1)

### Phase 2 Progress Bar (Story 4.4b)

- "Kompletterar din laglista... 23/68 lagar"
- Animated progress bar
- Estimated time: "~45 sekunder kvar"
- Dismissible (X button, but generation continues)
- Success toast when complete: "✅ Klar! 68 lagar i din lista"
- Optional confetti animation

---

## 10. Form Components

### Multi-Select Dropdown

- Used for: Assigned employees, categories, tags
- Checkbox-based selection
- Search/filter within dropdown
- "Select All" option

### Date Picker

- Used for: Due dates, effective dates
- Swedish date format (YYYY-MM-DD)
- Calendar popup
- Keyboard accessible

### Markdown Textarea

- Used for: Notes (Story 6.3)
- Markdown preview tab
- Formatting toolbar
- Auto-save

---

## 11. Common UI Patterns

### Drag-and-Drop System (Stories 3.4-3.7, 6.5)

**Library:** `@dnd-kit` or `react-beautiful-dnd`

**Draggable Items:**

- Law cards
- Employee cards
- Task cards
- Documents (PDFs)

**Drop Zones:**

- Kanban columns
- AI chat input area
- Law lists

**Visual Feedback:**

- Dragging: Card opacity 0.5, cursor grabbing
- Drop zone highlighted on hover
- Smooth animation on drop

**Accessibility:**

- Keyboard: Arrow keys + Enter to move
- Touch support for mobile
- Screen reader announcements

### Toast Notifications

- Success: "✅ Change marked as reviewed"
- Error: "❌ Failed to update law"
- Info: "💡 New law added to your list"
- Position: Top-right
- Auto-dismiss after 5 seconds (or manual close)
- Undo action for reversible operations

### Loading States

- Skeleton loaders for content placeholders
- Circular spinner for indeterminate operations
- Progress bars for determinate operations (file uploads, Phase 2 generation)
- Inline loading: "Saving..." text + spinner

---

## 12. HR Module Components (Epic 7, Stories 7.1-7.12)

### 12a. Employee Card Component (Story 7.6)

**Purpose:** Draggable employee cards for AI chat context and visual employee directory

**PRD Requirements:**

- Story 7.6: "Employee List view includes card layout option (toggle: Table/Cards)"
- Story 7.6: "Each card shows: Name, role, photo (if uploaded), compliance status badge"
- Story 7.6: "Cards draggable (already implemented in Epic 3.5)"

**Structure:**

- Employee photo (or initials avatar fallback)
- Employee name (bold)
- Role badge
- Department (small, gray text)
- Compliance status badge (✅ Compliant / ⚠️ Needs Attention / ❌ Non-Compliant)
- Employment date (small text)

**States:**

- Default
- Hover (elevated shadow)
- Dragging (opacity 0.5, follows cursor)
- Selected (for bulk actions)

**Interactions:**

- Click → Opens Employee Profile page
- Drag → Can be dropped into AI Chat (Story 3.5)
- Checkbox → Enables bulk actions

**Privacy:**

- Story 7.6: "Only HR Manager/Admin/Owner can drag employee cards"

---

### 12b. Employee List View (Stories 7.1, 7.8)

**Purpose:** Centralized employee management with table and card layouts

**PRD Requirements:**

- Story 7.1: "HR Module page created at `/hr/employees`"
- Story 7.1: "Table view shows all employees with columns: Name, Role, Employment Date, Contract Type, Status"

**Table Columns:**

1. Checkbox (for bulk actions)
2. Photo (avatar thumbnail)
3. Name (sortable, clickable → profile)
4. Role (dropdown for inline edit)
5. Department
6. Employment Date (sortable)
7. Contract Type (Permanent, Fixed-term, Consultant)
8. Compliance Status badge
9. Actions (Edit, Delete)

**Filter Bar (Story 7.8):**

- Department (multi-select dropdown)
- Role (multi-select)
- Contract Type (multi-select)
- Compliance Status (Compliant/Needs Attention/Non-Compliant)
- Manager (dropdown)
- Search input (filters by name)
- Clear filters button
- Filters persist in URL query params

**Sorting (Story 7.8):**

- Name (A-Z / Z-A)
- Employment Date (newest/oldest)
- Compliance Status (Non-Compliant → Needs Attention → Compliant)

**View Toggle:**

- Table view (default, data-dense)
- Card view (visual, drag-enabled)

**Actions:**

- "Add Employee" button (opens Add Employee Modal)
- "Import CSV" button (Story 7.3)
- "Export filtered list" button (CSV download)

**Empty State:**

- "No employees yet. Add your first employee or import from CSV."

---

### 12c. Add Employee Modal (Story 7.1)

**Purpose:** Form for creating new employee records

**PRD Requirements:**

- Story 7.1: "Add Employee button opens modal"

**Form Fields:**

1. **Name** (text input, required)
2. **Personnummer** (Swedish SSN, 10 digits, required, encrypted at rest)
   - Format: YYYYMMDD-XXXX
   - Client-side validation
3. **Email** (text input, optional)
4. **Phone** (text input, optional)
5. **Employment Date** (date picker, required)
6. **Contract Type** (dropdown, required)
   - Options: Permanent, Fixed-term, Consultant
7. **Role** (dropdown, required)
   - Options: Manager, Employee, Intern, etc.
8. **Department** (text input with autocomplete from existing departments)
9. **Manager** (dropdown of existing employees, optional)

**Actions:**

- [Cancel] button (closes modal, no save)
- [Save Employee] button (validates + creates record)

**Validation:**

- Red error messages below invalid fields
- Disable Save button until required fields valid

---

### 12d. Employee Profile Page (Story 7.2)

**Purpose:** Detailed employee information with tabbed interface

**PRD Requirements:**

- Story 7.2: "Clicking employee name opens profile page: `/hr/employees/[id]`"
- Story 7.2: "Profile tabs: Overview, Documents, Compliance, Activity"

**Header:**

- Employee photo (large, left side)
- Employee name (h1)
- Role badge
- Compliance status badge
- [Edit Profile] button (opens modal with all fields)
- [Mark as Inactive] button (Story 7.10)

**Tab 1: Overview**

- Personal info card:
  - Name, Personnummer, Email, Phone
- Employment details card:
  - Role, Department, Manager (clickable link)
  - Employment date, Contract type
  - End date (if fixed-term contract)

**Tab 2: Documents (Story 7.2)**

- Document list table:
  - Columns: Filename, Upload Date, Uploader, Actions
  - Actions: Download, Delete
- [Upload Document] button
  - Accepts: PDF, image (JPG/PNG)
  - Max 10MB per file
- Empty state: "No documents uploaded yet"

**Tab 3: Compliance (Story 7.2, 7.4, 7.5)**

- Compliance status card:
  - Status badge (✅/⚠️/❌)
  - Compliance reasons: "Missing kollektivavtal assignment", "No contract document uploaded"
- Kollektivavtal assignment:
  - Dropdown selector
  - "None" option
  - Link to view kollektivavtal PDF
- Related laws section:
  - List of laws that apply to this employee (Story 7.9)
  - Auto-suggested by AI based on role + department + kollektivavtal

**Tab 4: Activity (Story 7.2)**

- Audit log table:
  - Timestamp, User, Action
  - Example: "2025-10-15 14:30 - Anna Svensson edited employment date"
- Sorted by date (newest first)

**Notes Section (Story 7.11):**

- Rich text editor (markdown supported)
- @mention functionality:
  - Type @ → Dropdown of team members
  - @mentioned users receive in-app notification
- Notes timestamped and attributed to author
- Edit/delete own notes only (Admin/Owner can edit all)
- Privacy: Only visible to HR Manager/Admin/Owner

---

### 12e. CSV Import Component (Story 7.3)

**Purpose:** Bulk employee import from spreadsheet

**PRD Requirements:**

- Story 7.3: "Import button on Employee List page"
- Story 7.3: "Upload CSV file (max 10MB)"

**Flow:**

**Step 1: Upload**

- Drag-and-drop zone or file picker
- Accepts: CSV, Excel (.xlsx)
- Max 10MB
- Loading spinner during parse

**Step 2: Preview & Mapping**

- Preview table shows first 10 rows
- Column mapping interface:
  - Left: CSV column headers
  - Right: System field dropdowns
  - Auto-detection if headers match expected names
- Expected columns: Name, Personnummer, Email, Phone, Employment Date, Contract Type, Role, Department
- Date format selector (DD/MM/YYYY, YYYY-MM-DD, etc.)

**Step 3: Validation (Story 7.3)**

- Invalid rows highlighted in red
- Validation errors shown:
  - Missing required fields (Name, Personnummer, Employment Date)
  - Invalid personnummer format
  - Invalid date format
- **GPT-4 fuzzy role matching:** "Builder" → "construction_worker", "CEO" → "manager"
- "Skip invalid rows" checkbox (default: checked)

**Step 4: Import**

- [Cancel] button
- [Import X Employees] button (shows valid count)
- Progress bar during import
- Summary toast: "45 imported, 5 skipped"
- Error log downloadable: CSV with skipped rows + reasons

---

### 12f. Compliance Status Badge (Story 7.4)

**Purpose:** Visual indicator of employee compliance status

**PRD Requirements:**

- Story 7.4: "Compliance status calculated per employee"

**Variants:**

1. **✅ Compliant (Green)**
   - All required fields filled
   - Kollektivavtal assigned
   - Contract document uploaded

2. **⚠️ Needs Attention (Yellow)**
   - Some missing data
   - Examples: No kollektivavtal, missing contract document

3. **❌ Non-Compliant (Red)**
   - Critical missing data
   - Examples: No employment date, invalid personnummer

**Tooltip on Hover:**

- Shows compliance reasons
- Example: "Missing kollektivavtal assignment, No contract document uploaded"

**Usage Locations:**

- Employee List (table and card views)
- Employee Profile header
- Employee cards (draggable)
- Dashboard compliance summary: "40/50 employees compliant"

---

### 12g. Kollektivavtal Management (Story 7.5)

**Purpose:** Upload and assign collective agreements to employees

**PRD Requirements:**

- Story 7.5: "Kollektivavtal page created at `/hr/kollektivavtal`"

**Kollektivavtal List View:**

- Table columns:
  - Name (e.g., "Byggnads Kollektivavtal 2024")
  - Type (Arbetare, Tjänstemän, Specialized)
  - Upload Date
  - Assigned Employees Count (clickable → shows list)
  - Actions (View PDF, Assign, Delete)

**Upload Flow:**

1. [Upload PDF] button
2. Upload modal:
   - File picker (PDF only, max 20MB)
   - Name input field
   - Type selector (dropdown)
   - [Cancel] [Upload] buttons
3. Upload → PDF chunked and embedded into vector database
4. Success toast: "Kollektivavtal uploaded and indexed"

**Assign to Employees:**

- Checkbox list of employees
- Bulk assign by department/role
- Search filter
- [Save Assignments] button

**AI Chat Integration (Story 7.5):**

- AI can query kollektivavtal: "What does our agreement say about vacation days?"
- Citations distinguish between laws and kollektivavtal: `[Kollektivavtal: Byggnads 2024, §3.2]`

---

### 12h. Employee Photo Upload (Story 7.7)

**Purpose:** Visual employee avatars

**PRD Requirements:**

- Story 7.7: "Employee Profile → Photo upload section"

**Upload Interface:**

- Click to upload or drag-and-drop
- Image requirements: Max 5MB, JPG/PNG, min 200x200px
- Image cropping tool (square crop for avatar)
- Preview before save

**Storage:**

- Photo stored in Supabase storage
- Photo URL saved in `employees.photo_url`

**Fallback:**

- Initials avatar if no photo (e.g., "AS" for Anna Svensson)
- Colored background (generated from name hash)

**Usage:**

- Employee List (card view)
- Employee Profile header
- Chat context pills (when employee dragged to chat)
- Notes @mentions

---

### 12i. Employee Offboarding Modal (Story 7.10)

**Purpose:** Mark employees as inactive when they leave

**PRD Requirements:**

- Story 7.10: "Employee Profile → 'Mark as Inactive' button"

**Modal Fields:**

1. **Last Working Day** (date picker, required)
2. **Offboarding Reason** (dropdown, required)
   - Options: Resignation, Termination, Retirement, End of contract
3. **Notes** (textarea, optional)
4. **Data Export Checkbox** (checked by default)
   - "Export employee data (GDPR compliance)"

**Actions:**

- [Cancel] button
- [Mark as Inactive] button

**Post-Offboarding:**

- Employee status set to "inactive"
- Hidden from default Employee List view
- "Show inactive employees" toggle to reveal
- Cannot be assigned to new tasks/laws
- Data retained for 2 years (GDPR), then hard deleted

---

### 12j. Employee-Law Relationship (Story 7.9)

**Purpose:** Auto-suggest relevant laws for each employee

**PRD Requirements:**

- Story 7.9: "When employee created, AI analyzes role + department + kollektivavtal"
- Story 7.9: "System suggests 5-10 relevant laws"

**Suggestions UI (Employee Profile → Compliance Tab):**

- "Suggested Laws for [Name]" section
- Each suggestion shows:
  - Law title + SFS number
  - AI reasoning: "Relevant because: Role is construction_worker + kollektivavtal is Byggnads"
  - [Accept] [Reject] buttons
- Accepted laws linked in `employee_laws` table
- Rejected suggestions hidden (not shown again)

**Kanban Integration:**

- Law cards in Kanban show assigned employee avatars
- Filter Kanban by employee → Shows only their relevant laws

---

---

## 13. Legal Content Discovery Components (Epic 2, Stories 2.5-2.9)

### 13a. Law Detail Page Component (Story 2.5)

**Purpose:** SEO-optimized public pages for viewing individual legal documents

**PRD Requirements:**

- Story 2.5: "Dynamic routes created for each content type"
- Story 2.5: "All pages use Server-Side Rendering (SSR) for SEO"

**Page Variants:**

#### SFS Law Page (`/lagar/[lawSlug]`)

- Law title (h1) + SFS number
- Category badge
- Status badge (Active, Repealed, Amended)
- Publication date + Effective date
- **Layered disclosure** (Design Principle #1):
  - Primary layer: AI plain Swedish summary (200-300 words)
  - Secondary layer: Full legal text (§-by-§ structure)
  - "Visa fullständig lagtext" accordion
- **Amendments section:**
  - List of all amendments with dates
  - Links to amending SFS laws
- **Cross-references section** (Story 2.8):
  - "Referenced in 12 court cases" (clickable)
  - "Implements EU Directive 2016/679" (clickable)
- **Related laws section:** AI-suggested similar laws
- **"Add to My List" CTA** (requires authentication)
- **"Ask AI About This Law" button** → Opens AI chat with law pre-loaded
- **Official source link:** "Riksdagen PDF"

#### Court Case Page (`/rattsfall/[court]/[caseSlug]`)

- Case number (e.g., "NJA 2024 s. 123") + Court name
- Decision date
- Category badge
- **Summary section:** Plain Swedish AI summary (150-200 words)
- **Full judgment:** Facts, Analysis, Conclusion (collapsible sections)
- **Cited Laws section** (Story 2.8):
  - List of SFS laws cited in judgment
  - Context snippet: "This case interprets § 7 regarding..."
- **Lower court:** Link to lower court decision (if applicable)
- **Parties:** Plaintiff and defendant (anonymized if personal data)
- **"Add to My List" CTA**
- **Official source link:** "Domstolsverket PDF"

#### EU Document Page (`/eu/[type]/[docSlug]`)

- Document title + EU number (e.g., "Regulation (EU) 2016/679")
- CELEX number
- Document type badge (Regulation, Directive)
- Publication date + Entry into force date
- **Layered disclosure:**
  - Primary: AI plain Swedish summary
  - Secondary: Full text (articles, recitals)
- **National Implementation section** (for directives, Story 2.8):
  - List of Swedish SFS laws implementing directive
  - Implementation status: Complete/Partial/Pending
- **Cross-references to Swedish laws**
- **"Add to My List" CTA**
- **Official source link:** "EUR-Lex"

**Common Elements:**

- Breadcrumb navigation
- Meta tags (SEO-optimized)
- Structured data (JSON-LD)
- Share buttons (LinkedIn, Twitter, copy link)
- Related documents sidebar

---

### 13b. Category Browse Pages (Story 2.6)

**Purpose:** Browse legal content by subject category and content type

**PRD Requirements:**

- Story 2.6: "Category pages created for each content type"
- Story 2.6: "Content type filter on category pages"

**Category Landing Page (`/lagar/kategorier/[category]`)**

- Category name (h1): "Arbetsrätt"
- Category description (AI-generated, 1-2 sentences)
- Document count per type:
  - "245 lagar" | "89 rättsfall" | "34 EU-förordningar"
- **Content type filter tabs:**
  - All (default)
  - Lagar (SFS Laws)
  - Rättsfall (Court Cases)
  - EU-lagstiftning (EU Legislation)
- Document list (card layout):
  - Each card: Title, document number, content type badge, snippet
  - Sortable by: Relevance, Date (newest/oldest), Title (A-Z)
- Pagination (20 per page)
- SEO-optimized meta tags

**Supported Categories:**

1. Arbetsrätt (Labour Law)
2. Dataskydd (Data Protection)
3. Skatterätt (Tax Law)
4. Bolagsrätt (Corporate Law)
5. Miljö & Bygg (Environment & Construction)
6. Livsmedel & Hälsa (Food & Health)
7. Finans (Finance)
8. Immaterialrätt (IP Law)
9. Konsumentskydd (Consumer Protection)
10. Transport & Logistik (Transport & Logistics)

---

### 13c. Unified Search Page (Story 2.7)

**Purpose:** Full-text search across all 170,000+ legal documents

**PRD Requirements:**

- Story 2.7: "Unified search page created: `/sok`"
- Story 2.7: "Search performance <800ms for 170,000+ documents"

**Search Interface:**

- Large search input field (center of page)
- Search button
- Recent searches (cookie-based)
- Suggested queries: "GDPR", "arbetsmiljö", "parental leave"

**Search Results:**

- Results count: "345 resultat för 'arbetsmiljö'"
- Mixed content types with clear badges
- Each result card:
  - Content type badge (color-coded)
  - Title (bold, clickable)
  - Document number (small, gray)
  - Category badge
  - Snippet (200 chars, highlighted match)
  - Relevance score (hidden, for sorting)
- Pagination (20 results per page)

**Filter Sidebar:**

1. **Content Type** (multi-select checkboxes)
   - Lagar (SFS)
   - HD Rättsfall (Supreme Court)
   - HovR Rättsfall (Court of Appeal)
   - HFD Rättsfall (Supreme Admin Court)
   - EU Förordningar
   - EU Direktiv
2. **Category** (multi-select)
   - All 10 categories
3. **Business Type**
   - B2B / Private / Both
4. **Date Range** (publication date)
   - Date pickers (from/to)

**Sort Options:**

- Relevance (default)
- Date (newest first)
- Date (oldest first)
- Title (A-Z)

**Empty State:**

- "No results found for '[query]'"
- Suggestions: "Did you mean '[similar query]'?"
- "Try searching for: [popular queries]"

**Performance:**

- PostgreSQL full-text search with `tsvector`
- Weighted ranking (title > document number > full text)
- Results load in <800ms

---

### 13d. SNI Discovery Page (Story 2.9)

**Purpose:** Industry-specific legal content discovery

**PRD Requirements:**

- Story 2.9: "SNI discovery page created: `/upptack-lagar/bransch`"
- Story 2.9: "Results page shows tabbed view"

**Landing Page (`/upptack-lagar/bransch`)**

- Hero text: "Vilka lagar gäller för din bransch?"
- SNI code input field (5 digits, format: XXXXX)
- Client-side validation
- [Sök] button
- Popular industries (clickable cards):
  - Restaurang (SNI 56.x)
  - Bygg & Anläggning (SNI 41-43)
  - E-handel (SNI 47.9)
  - Vårdgivare (SNI 86.x)
  - IT-konsult (SNI 62.x)

**Results Page (`/upptack-lagar/bransch/[industry]`)**

- Industry name (h1): "Bygg & Anläggning"
- SNI code displayed
- Total document count: "45 lagar, 8 rättsfall, 12 EU-förordningar"
- **Three tabs:**

**Tab 1: Lagar (SFS Laws)**

- 12-25 curated SFS laws
- Each law card:
  - Title + SFS number
  - Category badge
  - AI commentary (1-2 sentences): "Why this law matters for construction companies"
  - [Add to My List] button

**Tab 2: Rättsfall (Court Cases)**

- 3-8 key court cases showing precedent
- Each case card:
  - Case number + Court
  - Decision date
  - Brief summary (50-100 words)
  - Cited laws
  - [Add to My List] button

**Tab 3: EU-lagstiftning (EU Legislation)**

- 5-12 EU regulations/directives
- Each EU doc card:
  - Title + EU number
  - Type badge (Regulation/Directive)
  - AI commentary
  - [Add to My List] button

**Sort Options (per tab):**

- Relevance (default)
- Date (newest first)
- Category

**CTA:**

- "Lägg till alla i Min Lista" (Add all to My List) → Requires authentication

---

### 13e. Cross-Document Navigation Sections (Story 2.8)

**Purpose:** Navigate between related legal documents

**PRD Requirements:**

- Story 2.8: "SFS law pages display 'Referenced in Court Cases' section"
- Story 2.8: "Bidirectional navigation works"

**Section Types:**

**1. "Referenced in Court Cases" (on SFS Law Pages)**

- Displayed if law cited in ≥1 court case
- Section title: "Rättsfall som refererar till denna lag (12)"
- List of court cases:
  - Case number + Court
  - Decision date
  - Context snippet: "This case interprets § 7 regarding working hours"
  - [View Case] link
- Sortable by: Date (newest first), Court (HD > HovR > HFD)

**2. "Cited Laws" (on Court Case Pages)**

- Section title: "Lagar som refereras i domen (5)"
- List of SFS laws:
  - Law title + SFS number
  - Section referenced: "§ 7, § 26"
  - [View Law] link
- Sortable by: Frequency of citation, Title (A-Z)

**3. "Swedish Implementation" (on EU Directive Pages)**

- Section title: "Svenska genomförandelagar"
- Implementation status badge: ✅ Complete / ⚠️ Partial / ❌ Pending
- List of SFS laws implementing directive:
  - Law title + SFS number
  - Implementation date
  - [View Law] link

**4. "Implements EU Directive" (on SFS Law Pages)**

- Section title: "Genomför EU-direktiv"
- EU directive title + number
- [View Directive] link

---

## 14. Workspace & Team Collaboration Components (Epic 5, Stories 5.1-5.12)

### 14a. Workspace Switcher Dropdown (Story 5.9)

**Purpose:** Multi-workspace context switching

**PRD Requirements:**

- Story 5.9: "Top navigation includes workspace switcher dropdown"
- Story 5.9: "Dropdown shows all workspaces user belongs to"

**Dropdown Trigger:**

- Current workspace name (truncated at 20 chars)
- Down arrow icon
- Located in top navigation (left side)

**Dropdown Menu:**

- List of user's workspaces:
  - Workspace name (bold)
  - Role badge (Owner/Admin/HR Manager/Member/Auditor)
  - Current workspace highlighted (checkmark icon)
  - Click → Switches context, reloads page
- Divider line
- [+ Create New Workspace] button
- Max height: 400px, scrollable if >5 workspaces

**Mobile:**

- Switcher in hamburger menu
- Full-screen modal for workspace list

---

### 14b. Team Members List (Stories 5.3, 5.7)

**Purpose:** Display and manage workspace team members

**PRD Requirements:**

- Story 5.7: "Team tab shows current members list"
- Story 5.3: "Team settings page shows current members list"

**Location:** Workspace Settings → Team tab

**Member List Table:**

- Columns:
  1. Photo (avatar)
  2. Name + Email
  3. Role (dropdown for inline role change)
  4. Joined Date
  5. Status (Active/Pending Invite)
  6. Actions (Remove button)
- Sortable by: Name, Role, Joined Date
- Search filter (by name or email)

**Pending Invites Section:**

- Separate table below active members
- Columns: Email, Role, Invited By, Invited Date, Actions
- Actions: Re-send Invite, Revoke Invite
- Auto-delete after 7 days expiry

**Role Permissions Display:**

- Info tooltip explaining each role:
  - Owner: Full access + billing + workspace deletion
  - Admin: Full access except billing
  - HR Manager: Full HR access, read-only laws
  - Member: Read-only laws, AI chat
  - Auditor: Read-only multi-workspace access

**Empty State:**

- "No team members yet. Invite your first teammate!"

---

### 14c. Invite Member Modal (Story 5.3)

**Purpose:** Send email invitations to join workspace

**PRD Requirements:**

- Story 5.3: "Invite Member button opens modal"
- Story 5.3: "Invitation email sent to recipient"

**Modal Fields:**

1. **Email** (text input, required)
   - Validation: Valid email format
   - Check if user already in workspace (error)
2. **Role** (dropdown, required)
   - Options: Admin, HR Manager, Member, Auditor
   - Owner role not available (only 1 owner per workspace)
   - Info tooltip per role
3. **Personal Message** (textarea, optional)
   - Max 500 chars
   - Placeholder: "I'd like to invite you to our compliance workspace..."

**Actions:**

- [Cancel] button
- [Send Invite] button

**Success Flow:**

- Toast: "Invitation sent to [email]"
- Email sent with:
  - Workspace name
  - Inviter name
  - "Join Workspace" CTA link
  - Invite link format: `/invite/[token]`

**Invite Expiry:**

- 7 days from sending
- Auto-delete expired invites

---

### 14d. Workspace Settings Page (Story 5.7)

**Purpose:** Centralized workspace configuration

**PRD Requirements:**

- Story 5.7: "Workspace Settings page with tabs"

**Tab Navigation:**

1. General
2. Team
3. Billing
4. Notifications
5. Integrations

**Tab 1: General**

- Workspace name (editable text input)
- Company logo upload:
  - Drag-and-drop or file picker
  - Max 2MB, PNG/JPG
  - Square crop (200x200px)
  - Preview
- Industry (SNI code, readonly)
  - Set during onboarding, cannot be changed
- [Save Changes] button

**Tab 2: Team**

- Team Members List (Component 14b)
- [Invite Member] button → Opens Invite Modal (Component 14c)

**Tab 3: Billing** (Component 14e)

**Tab 4: Notifications**

- Email preferences (toggles):
  - ✅ Daily change digest (08:00 CET)
  - ✅ Weekly industry digest
  - ✅ Instant change alerts (High priority only)
  - ⬜ Marketing emails
- In-app notification preferences (toggles):
  - ✅ Law change notifications
  - ✅ Team activity notifications
  - ⬜ AI chat suggestions
- [Save Preferences] button

**Tab 5: Integrations**

- Placeholder card: "Fortnox integration coming soon"
- Future: OAuth connections, API keys

**Owner-Only Actions:**

- Settings clearly marked with "Owner only" badge
- Non-owners see disabled state with tooltip

---

### 14e. Billing Page (Stories 5.4, 5.5, 5.6)

**Purpose:** Subscription management and usage tracking

**PRD Requirements:**

- Story 5.4: "Billing page shows: Current plan, next billing date, payment method, invoice history"
- Story 5.5: "Usage tracked: ai_queries_this_month, employee_count, storage_used_mb"
- Story 5.6: "Add-ons defined"

**Current Plan Card:**

- Plan name (Solo / Team / Enterprise)
- Monthly price (e.g., "€899/månad")
- Billing cycle: "Next payment: 2025-12-01"
- Plan features list (checkmarks)
- [Upgrade Plan] button (if not on highest tier)
- [Change Plan] button (opens plan selector modal)

**Usage Limits Card (Story 5.5):**

- **Users:** "3/5 users" + Progress bar
  - Warning at 80%: "You've used 4/5 users. Upgrade?"
  - Hard limit at 110%: "Upgrade to continue"
- **Employees:** "42/50 employees" + Progress bar
- **AI Queries:** "387/500 queries this month" + Progress bar
- **Storage:** "7.2GB/10GB used" + Progress bar
- Usage resets: "Monthly limit resets on Dec 1"

**Add-Ons Section (Story 5.6):**

- Available add-ons:
  - **+10 employees:** €100/month (toggle switch)
  - **+5GB storage:** €50/month (toggle switch)
- Currently active add-ons highlighted
- Total with add-ons: "€899 + €100 = €999/månad"
- Prorated charges explained: "Charged immediately for current billing period"

**Payment Method Card:**

- Credit card info: "\***\* \*\*** \*\*\*\* 4242"
- Expiry: "12/2027"
- [Update Card] button → Stripe Checkout

**Invoice History:**

- Table:
  - Columns: Invoice Date, Amount, Status, PDF Link
  - Last 12 months visible
  - [View All Invoices] link

**Billing Contact:**

- Email for invoices (editable)
- Company billing address (editable)

---

### 14f. Pause/Delete Workspace Modals (Story 5.8)

**Purpose:** Temporarily pause or permanently delete workspace

**PRD Requirements:**

- Story 5.8: "Pause workspace button"
- Story 5.8: "Confirmation modal requires typing workspace name"

**Pause Workspace Modal:**

- Warning text: "Your data will be preserved but access blocked until resumed. Stripe subscription will be canceled."
- Consequences:
  - ✅ Data preserved indefinitely
  - ❌ Team members cannot login
  - ❌ No future charges
- [Cancel] button
- [Pause Workspace] button (red)
- Post-pause: Workspace status set to "paused"
- Workspace Settings → [Resume Workspace] button appears

**Delete Workspace Modal (Owner Only):**

- **Step 1: Warning Screen**
  - Danger zone styling (red border)
  - Warning text: "This action cannot be undone. All data will be permanently deleted after 30 days."
  - Consequences:
    - ❌ All laws, employees, tasks deleted
    - ❌ Team members lose access
    - ❌ Subscription canceled immediately
    - ✅ 30-day recovery period
- **Step 2: Confirmation Input**
  - "Type workspace name to confirm: [workspace name]"
  - Text input (must match exactly)
  - Delete button disabled until match
- [Cancel] button
- [Delete Workspace Permanently] button (red, destructive)
- Email sent to all team members: "Workspace deleted"

**Recovery Flow (Owner Only, within 30 days):**

- Email notification with [Restore Workspace] link
- Restoration page: "Your workspace was deleted on [date]. You have [X] days left to restore."
- [Restore Workspace] button

---

### 14g. Onboarding Checklist (Story 5.12)

**Purpose:** Guide new users through initial setup

**PRD Requirements:**

- Story 5.12: "After first login, onboarding checklist displayed in Dashboard"
- Story 5.12: "Progress % shown"

**Checklist Widget (Dashboard):**

- Card title: "Kom igång med Laglig.se"
- Progress indicator: "2/5 klar" + Progress bar (40%)
- Checklist items:
  1. ✅ **Law list generated** (auto-completed during onboarding)
  2. ⬜ **Invite your team** → Opens Invite Modal
  3. ⬜ **Add your first employee** → Opens HR Module
  4. ⬜ **Ask AI a question** → Opens AI Chat
  5. ⬜ **Customize law list** → Opens Law List page
- Each item clickable (links to relevant page)
- [Dismiss Checklist] button (small, de-emphasized)
- Checklist state persisted in user preferences

**Completion Celebration:**

- When 100% complete: Confetti animation
- Success toast: "🎉 Du är redo! Börja använda Laglig.se"
- Checklist auto-dismisses after 5 seconds

---

### 14h. Activity Log (Story 5.11 - Enterprise Only)

**Purpose:** Audit trail for compliance documentation

**PRD Requirements:**

- Story 5.11: "Activity Log page (Enterprise tier only)"
- Story 5.11: "Filterable by: User, Action type, Date range"

**Access:** Enterprise tier only, locked for Solo/Team tiers

**Activity Log Page (`/workspace/activity`):**

- Page title: "Workspace Activity Log"
- Export button: [Export as CSV]

**Filter Bar:**

1. **User** (dropdown, all team members)
2. **Action Type** (multi-select)
   - Law change reviewed
   - Employee added/edited/deleted
   - Team member invited/removed
   - Settings changed
   - File uploaded/deleted
3. **Date Range** (date pickers, from/to)
4. [Clear Filters] button

**Activity Table:**

- Columns:
  1. Timestamp (YYYY-MM-DD HH:mm)
  2. User (avatar + name)
  3. Action (e.g., "Reviewed law change")
  4. Resource (e.g., "Arbetsmiljölagen (SFS 1977:1160)")
  5. Details (expandable JSON)
- Sortable by: Timestamp (default: newest first)
- Pagination (50 entries per page)
- Indexed for fast queries

**Retention:**

- Logs retained for 2 years
- Automatically archived after 2 years

**Empty State:**

- "No activity recorded yet"

---

## 15. Authentication & Account Components (Epic 1, Story 1.3)

### 15a. Login Page Component

**Purpose:** User authentication with multiple providers

**PRD Requirements:**

- Story 1.3: "Login page with email/password form and OAuth buttons"

**Login Page (`/login`)**

- Page title: "Logga in på Laglig.se"
- **Email/Password Form:**
  - Email input (required, validated)
  - Password input (required, password masked)
  - "Glömt lösenord?" link → Password Reset flow
  - [Logga in] button (primary)
  - Error messages (invalid credentials, account not verified, etc.)

**OAuth Providers:**

- [Fortsätt med Google] button (white, Google branding)
- [Fortsätt med Microsoft] button (blue, Microsoft branding)
- OAuth handled via Supabase Auth + NextAuth.js

**Footer Links:**

- "Inget konto? Skapa konto" → Signup Page
- Privacy policy + Terms of Service links

**Session Management:**

- Session cookies: 30-day expiration, HTTP-only
- Protected routes redirect here if not authenticated

**Mobile:**

- Full-screen layout
- Large touch targets for OAuth buttons

---

### 15b. Signup Page Component

**Purpose:** New user registration

**PRD Requirements:**

- Story 1.3: "Sign-up page with password complexity validation"

**Signup Page (`/signup`)**

- Page title: "Skapa konto"
- **Registration Form:**
  1. **Full Name** (text input, required)
  2. **Email** (text input, required, validated)
  3. **Password** (password input, required)
     - Client-side validation:
       - Min 8 characters
       - At least 1 uppercase letter
       - At least 1 number
       - At least 1 special character
     - Real-time password strength indicator (Weak/Medium/Strong)
  4. **Confirm Password** (password input, required, must match)
  5. **Terms Checkbox** (required): "Jag accepterar användarvillkoren och integritetspolicyn"
  6. [Skapa konto] button (disabled until valid)

**OAuth Options:**

- Same Google/Microsoft buttons as Login Page
- Note: "Snabbare registrering med Google eller Microsoft"

**Success Flow:**

- Account created → Email verification sent
- Redirect to Email Verification page
- Toast: "Konto skapat! Kolla din email för verifieringskod."

**Footer Links:**

- "Har redan konto? Logga in" → Login Page

---

### 15c. Email Verification Flow

**Purpose:** Verify user email ownership

**PRD Requirements:**

- Story 1.3: "Email verification flow (6-digit code)"

**Verification Page (`/verify-email`)**

- Hero text: "Verifiera din email"
- Subtitle: "Vi har skickat en 6-siffrig kod till [email@example.com]"
- **6-digit code input:**
  - 6 separate input boxes (auto-focus next box)
  - Large, clear digits
  - Auto-submit when 6 digits entered
- Validation: Code valid for 15 minutes
- Error message: "Ogiltig kod, försök igen"
- [Skicka ny kod] link (cooldown: 1 minute between sends)

**Success Flow:**

- Code verified → Redirect to Dashboard or Onboarding
- Success toast: "Email verifierad! Välkommen till Laglig.se ✓"

**Resend Logic:**

- [Skicka ny kod] available after 1 minute
- Max 5 codes per hour (rate limiting)

---

### 15d. Password Reset Flow

**Purpose:** Recover account access

**PRD Requirements:**

- Story 1.3: "Password reset flow"

**Step 1: Request Reset (`/reset-password`)**

- Page title: "Återställ lösenord"
- Email input field
- [Skicka återställningslänk] button
- Instructions: "Vi skickar en länk till din email"

**Step 2: Email Sent Confirmation**

- Success message: "Kolla din email! Vi har skickat återställningsinstruktioner till [email]"
- Note: "Länken är giltig i 1 timme"
- [Tillbaka till inloggning] link

**Step 3: Reset Password Page (`/reset-password/[token]`)**

- Page title: "Välj nytt lösenord"
- **New Password Form:**
  - New Password input (with validation, same as Signup)
  - Confirm Password input
  - Password strength indicator
  - [Återställ lösenord] button
- Token validation: Expire after 1 hour
- Error state: "Länken har gått ut, begär en ny"

**Success Flow:**

- Password updated → Redirect to Login
- Success toast: "Lösenord uppdaterat! Logga in nu"

---

### 15e. Protected Route Component

**Purpose:** Authentication wrapper for private pages

**PRD Requirements:**

- Story 1.3: "Protected routes redirect to login if not authenticated"

**Middleware Logic:**

- Check session: `req.cookies.get('session')`
- If no session → Redirect to `/login?redirect=[current-page]`
- After login → Redirect back to intended page

**Protected Routes:**

- `/dashboard`
- `/lagar` (workspace law lists)
- `/hr/*` (HR Module)
- `/kanban` (Compliance Workspace)
- `/settings`
- `/chat` (AI Chat)

**Public Routes:**

- `/` (Homepage)
- `/lagar/[lawSlug]` (Public law pages)
- `/upptack-lagar/*` (Discovery pages)
- `/sok` (Search)
- `/login`, `/signup`, `/verify-email`, `/reset-password`

---

## Component Priority for MVP

**High Priority (Core UX):**

1. **Login/Signup Pages** - **Gateway to product**
2. Law Card (all variants)
3. Kanban Board
4. AI Chat Interface
5. Onboarding Components (dynamic questioning, streaming law generation)
6. Priority Badge
7. **Law Detail Page** (SFS, Court Case, EU Document variants) - **SEO-critical**
8. **Unified Search Page** - **Discovery engine**
9. Employee Card (draggable)
10. Employee List View

**Medium Priority (Key Features):** 11. Diff Viewer 12. Change Notification Card 13. Notification Bell 14. Dashboard Widgets 15. Add Employee Modal 16. Employee Profile Page 17. Compliance Status Badge 18. **Category Browse Pages** - **SEO value** 19. **SNI Discovery Page** - **Onboarding funnel** 20. **Cross-Document Navigation Sections** - **SEO + UX value** 21. Workspace Switcher Dropdown 22. Team Members List 23. Invite Member Modal 24. **Email Verification Flow** 25. **Password Reset Flow**

**Low Priority (Nice-to-Have):** 26. CSV Import 27. Kollektivavtal Management 28. Employee Photo Upload 29. Employee Offboarding Modal 30. Workspace Settings Page (General, Notifications, Integrations tabs) 31. Billing Page (usage limits, add-ons) 32. Pause/Delete Workspace Modals 33. Onboarding Checklist Widget 34. Activity Log (Enterprise only) 35. Advanced filters (law and employee) 36. Bulk actions 37. Column customization

---

## Total Component Count: 15 Component Groups, 55+ Individual Components

**By Epic:**

- **Epic 1 (Authentication):** 1 component group (Login, Signup, Verification, Reset Password, Protected Routes)
- **Epic 2 (Legal Content Discovery):** 5 component groups (Law pages, search, categories, SNI, cross-refs)
- **Epic 3 (AI Chat):** 1 component group (Chat interface, context pills, streaming responses)
- **Epic 4 (Onboarding):** 1 component group (Org-number input, dynamic questions, streaming law generation)
- **Epic 5 (Workspace/Team):** 8 component groups (Switcher, team list, invite modal, settings, billing, pause/delete, checklist, activity log)
- **Epic 6 (Kanban/Dashboard):** 2 component groups (Kanban board, dashboard widgets)
- **Epic 7 (HR Module):** 10 component groups (Employee cards, list, modals, profile, CSV import, compliance, kollektivavtal, photos, offboarding, law relationships)
- **Epic 8 (Change Monitoring):** 3 component groups (Change cards, diff viewer, notification bell)

**Coverage:** All 8 PRD epics documented with complete component specifications extracted from stories
