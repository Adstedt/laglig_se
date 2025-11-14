# Epic 7: HR Module (Employee Management) (DETAILED)

**Goal:** Connect employees to laws for context-aware HR compliance, improving AI chatbot value.

**Value Delivered:** Centralized employee database + AI can answer employee-specific questions + kollektivavtal integration ensures compliance.

---

## Story 7.1: Build Employee List View (CRUD)

**As an** HR manager,
**I want** to manage employees in a centralized list,
**so that** I track who works for my company.

**Acceptance Criteria:**

1. HR Module page created at `/hr/employees`
2. Table view shows all employees with columns: Name, Role, Employment Date, Contract Type, Status
3. "Add Employee" button opens modal
4. **Add Employee Modal fields:**
   - Name (required)
   - Personnummer (Swedish SSN, encrypted at rest, required)
   - Email (optional)
   - Phone (optional)
   - Employment date (date picker, required)
   - Contract type (dropdown: Permanent, Fixed-term, Consultant)
   - Role (dropdown: Manager, Employee, Intern, etc.)
   - Department (text input)
   - Manager (dropdown of existing employees)
5. "Save" creates employee record
6. Edit button (inline edit or modal)
7. Delete button (confirmation modal)
8. Search bar filters by name
9. Role-based access: Only HR Manager, Admin, Owner can access

---

## Story 7.2: Implement Employee Profile Page with Tabs

**As an** HR manager,
**I want** to view detailed employee profile,
**so that** I see all HR data and compliance status in one place.

**Acceptance Criteria:**

1. Clicking employee name opens profile page: `/hr/employees/[id]`
2. Profile tabs: Overview, Documents, Compliance, Activity
3. **Overview tab:**
   - Personal info (name, personnummer, email, phone)
   - Employment details (role, department, manager, employment date)
   - Contract type, end date (if fixed-term)
   - Edit button (opens modal with all fields)
4. **Documents tab:**
   - Uploaded documents (contract, ID, certificates)
   - Upload button (PDF/image)
   - Document list with: filename, upload date, uploader
   - Download/delete buttons
5. **Compliance tab:**
   - Kollektivavtal assignment
   - Compliance status (Compliant/Needs Attention/Non-Compliant)
   - Related laws (laws that apply to this employee)
6. **Activity tab:**
   - Audit log: Who edited this employee's data and when

---

## Story 7.3: Implement CSV Import for Employee Data

**As an** HR manager,
**I want** to import employees from CSV/Excel,
**so that** I don't manually enter 50+ employees.

**Acceptance Criteria:**

1. Import button on Employee List page
2. Upload CSV file (max 10MB)
3. CSV columns expected: Name, Personnummer, Email, Phone, Employment Date, Contract Type, Role, Department
4. Preview table shows first 10 rows
5. Column mapping: User maps CSV columns to system fields (auto-detected if headers match)
6. Date format selector (DD/MM/YYYY, YYYY-MM-DD, etc.)
7. **GPT-4 fuzzy role matching:** "Builder" → "construction_worker", "CEO" → "manager"
8. Validation: Highlight invalid rows (missing required fields, invalid personnummer)
9. "Skip invalid rows" checkbox
10. Import button processes valid rows, shows summary: "45 imported, 5 skipped"
11. Error log downloadable: "Row 12: Invalid personnummer format"

---

## Story 7.4: Implement Employee Compliance Status Calculation

**As an** HR manager,
**I want** to see which employees are compliant,
**so that** I prioritize HR tasks.

**Acceptance Criteria:**

1. Compliance status calculated per employee:
   - **Compliant:** All required fields filled, kollektivavtal assigned, no missing documents
   - **Needs Attention:** Some missing data (e.g., no kollektivavtal, missing contract document)
   - **Non-Compliant:** Critical missing data (e.g., no employment date, invalid personnummer)
2. Status badge shown in Employee List and Profile
3. Compliance reasons listed: "Missing kollektivavtal assignment", "No contract document uploaded"
4. Dashboard shows compliance summary: "40/50 employees compliant"
5. Filter employees by status
6. Automated reminders to HR Manager when employee status is "Needs Attention" for >7 days

---

## Story 7.5: Implement Kollektivavtal (Collective Agreement) Management

**As an** HR manager,
**I want** to upload and assign kollektivavtal to employees,
**so that** the AI knows which agreement applies to each employee.

**Acceptance Criteria:**

1. Kollektivavtal page created at `/hr/kollektivavtal`
2. Upload PDF button
3. Upload flow:
   - Select PDF (max 20MB)
   - Name input (e.g., "Byggnads Kollektivavtal 2024")
   - Type selector (Arbetare, Tjänstemän, Specialized)
   - Upload → PDF chunked and embedded into vector database
4. Kollektivavtal list shows: Name, Type, Upload date, Assigned employees count
5. Assign to employees: Checkbox list or bulk assign by department/role
6. AI chat can query kollektivavtal: "What does our agreement say about vacation days?"
7. Citations distinguish between laws and kollektivavtal
8. Delete kollektivavtal (confirmation, unassigns from employees)

---

## Story 7.6: Implement Employee Cards (Draggable to Chat)

**As a** user,
**I want** to drag employee cards into AI chat,
**so that** I ask HR questions specific to that employee.

**Acceptance Criteria:**

1. Employee List view includes card layout option (toggle: Table/Cards)
2. Each card shows: Name, role, photo (if uploaded), compliance status badge
3. Cards draggable (already implemented in Epic 3.5)
4. Dragging into chat adds employee context
5. AI uses employee metadata: role, kollektivavtal, employment date
6. Example: Drag "Anna Svensson" → Ask "How many vacation days does Anna have?" → AI checks her kollektivavtal
7. Privacy: Only HR Manager/Admin/Owner can drag employee cards

---

## Story 7.7: Add Employee Photo Upload

**As an** HR manager,
**I want** to upload employee photos,
**so that** the employee list is more visual and recognizable.

**Acceptance Criteria:**

1. Employee Profile → Photo upload section
2. Click to upload or drag-and-drop
3. Image requirements: Max 5MB, JPG/PNG, min 200x200px
4. Image cropping tool (square crop for avatar)
5. Photo stored in Supabase storage
6. Photo URL saved in `employees.photo_url`
7. Avatar displayed in: Employee List (card view), Profile, Chat context pills
8. Fallback: Initials avatar if no photo

---

## Story 7.8: Implement Employee Filters and Sorting

**As an** HR manager,
**I want** to filter and sort employees,
**so that** I find specific groups quickly.

**Acceptance Criteria:**

1. Filter bar on Employee List page
2. Filters: Department, Role, Contract Type, Compliance Status, Manager
3. Multi-select filters (AND logic)
4. Sort by: Name (A-Z), Employment Date (newest/oldest), Compliance Status
5. Filters persist in URL query params
6. Clear filters button
7. Export filtered list as CSV

---

## Story 7.9: Build Employee-Law Relationship (Auto-Assignment)

**As a** system,
**I want** to automatically suggest laws relevant to each employee,
**so that** users see which laws apply to whom.

**Acceptance Criteria:**

1. When employee created, AI analyzes role + department + kollektivavtal
2. System suggests 5-10 relevant laws (e.g., employee role=construction_worker → suggest Arbetsmiljölagen, Byggarbetskonventionen)
3. Suggested laws shown in Employee Profile → Compliance tab
4. User can accept/reject suggestions
5. Accepted laws linked in `employee_laws` table
6. Law cards in Kanban show assigned employees
7. Filtering Kanban by employee shows only their relevant laws

---

## Story 7.10: Implement Employee Offboarding Workflow

**As an** HR manager,
**I want** to offboard employees when they leave,
**so that** I maintain accurate records and compliance.

**Acceptance Criteria:**

1. Employee Profile → "Mark as Inactive" button
2. Offboarding modal fields: Last working day, Offboarding reason (dropdown: Resignation, Termination, Retirement, End of contract)
3. Marking inactive sets `employees.status = 'inactive'` and `employees.end_date`
4. Inactive employees hidden from default Employee List view
5. "Show inactive employees" toggle
6. Inactive employees cannot be assigned to new tasks/laws
7. Data retained for 2 years (GDPR compliance), then hard deleted
8. Export employee data before offboarding (GDPR right to data portability)

---

## Story 7.11: Add Employee Notes and @Mentions

**As an** HR manager,
**I want** to add notes to employee profiles and @mention teammates,
**so that** I collaborate on HR matters.

**Acceptance Criteria:**

1. Employee Profile → Notes section
2. Rich text editor (markdown supported)
3. @mention functionality: Type @ → Dropdown of team members
4. @mentioned users receive in-app notification
5. Notes timestamped and attributed to author
6. Edit/delete own notes only (or Admin/Owner can edit all)
7. Notes searchable via global search
8. Privacy: Notes only visible to HR Manager/Admin/Owner roles

---

## Story 7.12: Implement Fortnox Schema Compatibility (FR41)

**As a** product owner,
**I want** to design employee schema to support future Fortnox integration,
**so that** we enable one-click sync post-MVP.

**Acceptance Criteria:**

1. Employee schema fields mapped to Fortnox API structure:
   - `employee_id` → Fortnox `EmployeeId`
   - `personnummer` → Fortnox `PersonalIdentityNumber`
   - `contract_type` → Fortnox `PersonnelType`
   - `employment_date` → Fortnox `EmploymentDate`
   - `role` → Fortnox `ScheduleId` (mapping table for role → schedule)
2. Database migration adds `fortnox_id` field (null for now)
3. Documentation created: "Fortnox Integration Mapping"
4. No user-facing features in MVP (infrastructure only)
5. Post-MVP: OAuth flow will populate `fortnox_id` and enable sync

---

**Epic 7 Complete: 12 stories, 3-4 weeks estimated**

---
