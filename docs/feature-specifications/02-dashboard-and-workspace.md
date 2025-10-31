# Dashboard & Workspace - Complete Specification

**Status:** ✅ COMPLETE
**Last Updated:** 2025-10-29
**Previous:** Homepage & Onboarding
**Next:** AI Chat Interface specification

---

## Table of Contents

1. [Overview](#overview)
2. [Layout Architecture](#layout-architecture)
3. [Navigation Structure](#navigation-structure)
4. [Dashboard (Summary View)](#dashboard-summary-view)
5. [Kanban Board (Compliance Workspace)](#kanban-board-compliance-workspace)
6. [Law Card Modal](#law-card-modal)
7. [Global Task Management](#global-task-management)
8. [AI Chat Integration](#ai-chat-integration)
9. [Notifications System](#notifications-system)
10. [First-Time User Experience](#first-time-user-experience)
11. [Technical Implementation](#technical-implementation)

---

## Overview

### Purpose

The Dashboard/Workspace is the authenticated user's primary interface for:
1. Tracking compliance status across all laws
2. Managing tasks and team collaboration
3. Monitoring law changes and updates
4. Accessing AI assistance contextually
5. Coordinating compliance workflows

### Strategic Context

**User Journey:**
- User completes onboarding → sees streaming law list generation → signs up for trial
- Lands on Dashboard with personalized law list ready
- First impression critical for activation and engagement

**Key Challenge:** Balance information density with clarity while providing power-user functionality

**Design Philosophy:** Jira-inspired compliance workspace with AI superpowers

---

## Layout Architecture

### Four-Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Header Bar                                                       │
│ [Logo][Breadcrumbs]    [Global Search] [🔔][?][Avatar▼]        │
├──────────────┬──────────────────────────────────┬───────────────┤
│  Left        │   Main Content Area              │  Right        │
│  Sidebar     │   (Dashboard/Kanban/Views)       │  Sidebar      │
│              │                                  │  (AI Chat)    │
│  Navigation  │   Dynamic content based on       │               │
│  Menu        │   selected nav item              │  [Foldable]   │
│              │                                  │               │
│  Accordions  │   Tabs & Views within pages      │  [Toggle ⚡]  │
│  & Links     │                                  │               │
│              │                                  │               │
│              │                                  │               │
└──────────────┴──────────────────────────────────┴───────────────┘
```

**Dimensions:**
- Left sidebar: 240px fixed width (collapsible)
- Main content: Fluid (remaining space)
- Right sidebar: 400px fixed width (foldable, starts expanded)
- Header: 60px height

---

### Header Bar

**Left Section:**
```
[Laglig.se Logo] > Dashboard > Min huvudlista
```
- Logo: Home link (returns to Dashboard)
- Breadcrumbs: Navigation trail (dynamic based on current page)

**Right Section:**
```
[🔍 Search] [🔔 Notiser: 3] [? Hjälp] [Avatar: AA ▼]
```

**Global Search:**
- Keyboard shortcut: `/` or `Cmd/Ctrl + K` (future)
- Search across: Laws, Tasks, Employees, Comments
- Instant results dropdown
- Navigate to result on Enter

**Notifications Bell:**
- Badge count for unread notifications
- Click → Dropdown notification center
- Priority colors (red/yellow/white)

**Help Icon:**
- Link to documentation
- Video tutorials
- Support contact
- Keyboard shortcuts reference (future)

**Avatar Dropdown:**
- Account settings
- Subscription/Billing
- Team management (Pro/Enterprise)
- Logout

---

## Navigation Structure

### Left Sidebar Menu

```
┌─────────────────────────┐
│ [Laglig.se Logo]        │
├─────────────────────────┤
│                         │
│ 📋 Dashboard            │← Summary view (default landing)
│                         │
│ 💬 AI Chat              │← Toggle right sidebar (optional)
│                         │
│ ⚖️ Laglistor ▼          │← Accordion (user's law lists)
│   📑 Min huvudlista     │  47 lagar
│   📑 Bygglagstiftning   │  15 lagar
│   + Skapa ny lista      │
│                         │
│ 📚 Alla Lagar           │← Wiki: All 10k+ laws (SFS, rulings)
│                         │
│ ✅ Uppgifter            │← Global task view (all tasks)
│                         │
│ 👥 HR ▼                 │← Accordion (HR module)
│   📊 Översikt           │
│   👤 Medarbetare        │
│   📋 Mallar             │
│                         │
│ 🔔 Ändringsbevakning    │← Change monitoring dashboard
│                         │
│ 👥 Team (Pro)           │← Multi-user features
│                         │
│ 📁 Mina Filer           │← Document storage (drag to AI chat)
│                         │
│ ⚙️ Inställningar        │← Account settings
│                         │
├─────────────────────────┤
│ [Trial: 12 days left]   │← Trial status widget
│ [Uppgradera →]          │
└─────────────────────────┘
```

### Navigation Behavior

**Accordion Mechanics:**
- **Laglistor:** Click to expand/collapse, shows all law lists
- **HR:** Click to expand/collapse, shows sub-items
- Persists state (remembers open/closed)
- Active item highlighted (blue background)

**Law List Navigation:**
- Click "Min huvudlista" → Navigate to Kanban board showing 47 laws
- Click "Bygglagstiftning" → Navigate to separate Kanban board showing 15 construction laws
- **One Kanban board per law list** (each persists its own state)

**"Alla Lagar" vs. "Laglistor" Distinction:**
- **Laglistor:** Personalized, tracked lists with compliance status (Kanban boards)
- **Alla Lagar:** Complete legal wiki (10k+ laws, browse-only, can add to lists)

---

## Dashboard (Summary View)

### Purpose
Default landing page showing overview of compliance status, recent activity, and quick actions.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Välkommen tillbaka, Alexander! 👋                            │
│                                                             │
│ ┌─ Efterlevnad ──────┬─ AI-insikter ────┬─ Snabblänkar ──┐│
│ │                    │                  │                 ││
│ │   [87%]            │ ⚠️ 3 lagar       │ • Fråga AI     ││
│ │   Progress ring    │   ändrade        │ • Lägg till lag ││
│ │                    │   sedan igår     │ • Bjud in team  ││
│ │   41/47 lagar      │                  │                 ││
│ │   efterlevs        │ 🆕 2 nya lagar   │                 ││
│ │                    │   för ditt       │                 ││
│ │   [Se detaljer →]  │   företag        │                 ││
│ │                    │                  │                 ││
│ │                    │ [Se ändringar →] │                 ││
│ └────────────────────┴──────────────────┴─────────────────┘│
│                                                             │
│ ┌─ Senaste aktivitet ────────────────────────────────────┐ │
│ │                                                         │ │
│ │ • Arbetsmiljölagen uppdaterad - Kräver granskning      │ │
│ │   2 timmar sedan                                        │ │
│ │                                                         │ │
│ │ • Anna kommenterade på GDPR                             │ │
│ │   "Har vi koll på dataskyddsombudet?" @Johan            │ │
│ │   4 timmar sedan                                        │ │
│ │                                                         │ │
│ │ • Johan slutförde uppgift "Utse skyddsombud"           │ │
│ │   Igår kl. 14:32                                        │ │
│ │                                                         │ │
│ │ • Du frågade AI: "Vad innebär nya alkohollagen?"       │ │
│ │   Igår kl. 10:15                                        │ │
│ │                                                         │ │
│ │ [Visa alla aktiviteter →]                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Teamaktivitet (Pro tier) ──────────────────────────────┐│
│ │                                                         ││
│ │ Anna: 3 uppgifter slutförda denna vecka                ││
│ │ Johan: Aktiv på 5 lagar                                 ││
│ │ Sara: Lade till 2 nya lagar                             ││
│ │                                                         ││
│ │ [Se teamöversikt →]                                     ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Kom igång med Laglig.se (4/6) ─────────────────────────┐│
│ │ ✅ Skapa konto och laglista                             ││
│ │ ✅ Utforska din Kanban-tavla                            ││
│ │ ✅ Ställ en fråga till AI                               ││
│ │ ✅ Flytta en lag till "In Progress"                     ││
│ │ ☐ Lägg till en medarbetare (HR)                        ││
│ │ ☐ Aktivera ändringsbevakning                           ││
│ │ [Fortsätt →]                                            ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [Gå till Kanban-tavla →] [Fråga AI →] [Lägg till lag →]   │
└─────────────────────────────────────────────────────────────┘
```

### Widget Specifications

#### 1. Efterlevnad (Compliance Overview)

**Visual:**
- Circular progress ring (87% = 41/47 laws)
- Color: Green (>80%), Yellow (50-80%), Red (<50%)
- Large percentage number in center

**Data:**
- Total laws: 47
- Compliant: 41 (laws in "Compliant" column)
- In progress: 4
- Not started: 2
- Updated (requires review): 0

**Interaction:**
- Click → Navigate to Kanban board
- Filtered to show non-compliant laws only

**Calculation:**
```
Compliance % = (Laws in "Compliant" column / Total laws in list) × 100
```

---

#### 2. AI-insikter (AI Insights)

**Two types of insights:**

**A. Law Changes (Change monitoring):**
```
⚠️ 3 lagar ändrade sedan igår
- Arbetsmiljölagen (2025-01-15)
- GDPR Anpassningslag (2025-01-14)
- Alkohollagen (2025-01-13)

[Se ändringar →]
```

**B. New Law Discoveries (SNI-based):**
```
🆕 2 nya lagar för ditt företag
- Nya krav på digitala kvitton (SNI 56.10)
- Uppdaterade serveringsregler (SNI 56.10)

[Granska nya lagar →]
```

**How SNI-based discovery works:**
1. New law published affecting specific SNI code (e.g., 56.10 - Restauranger)
2. System identifies all customers with that SNI code
3. AI generates insight for those customers
4. Appears in Dashboard widget
5. Click → Modal showing law details with "Lägg till i min laglista" CTA

**Why this drives retention:**
- Proactive value delivery (system "works for you" in background)
- Personalized to industry (not generic)
- Creates FOMO if user cancels subscription

---

#### 3. Snabblänkar (Quick Links)

**Always-visible quick actions:**
```
• Fråga AI en fråga
• Lägg till lag till lista
• Bjud in teammedlem (Pro)
```

**Click → Opens relevant interface:**
- "Fråga AI" → Opens right sidebar chat
- "Lägg till lag" → Opens modal with search (from "Alla Lagar" wiki)
- "Bjud in teammedlem" → Opens invite modal (Pro/Enterprise only)

---

#### 4. Senaste aktivitet (Recent Activity Feed)

**Activity types:**
- Law updated (system event)
- User comment (@mentions highlighted)
- Task completed (user + timestamp)
- AI chat question (user's own activity)
- Law status changed (user moved card)
- Team member activity (Pro tier)

**Display format:**
```
[Icon] [Activity description] [Actor] [Timestamp]
[Optional: Preview or context]
[Optional: Action button]
```

**Example:**
```
🔔 Arbetsmiljölagen uppdaterad - Kräver granskning
   2 timmar sedan
   [Granska ändringar →]
```

**Interaction:**
- Click activity → Navigate to relevant page (law card, task, chat)
- Timestamps: Relative ("2 timmar sedan") for recent, absolute for older

**Limit:** Show last 10 activities, link to "Visa alla"

---

#### 5. Teamaktivitet (Team Activity) - Pro/Enterprise only

**Shows team member contributions:**
```
Anna: 3 uppgifter slutförda denna vecka
Johan: Aktiv på 5 lagar (commented, moved cards)
Sara: Lade till 2 nya lagar till listan
```

**Click → Navigate to Team dashboard (shows detailed team metrics)**

**Why Pro/Enterprise only:** Encourages team upgrades, showcases collaboration value

---

#### 6. Kom igång-checklista (Onboarding Checklist)

**Visible for first 7 days after signup**

**Checklist items:**
1. ✅ Skapa konto och laglista (auto-completed)
2. ✅ Utforska din Kanban-tavla (visit Kanban board)
3. ✅ Ställ en fråga till AI (send one AI chat message)
4. ☐ Flytta en lag till "In Progress" (drag card on Kanban)
5. ☐ Lägg till en medarbetare (HR) (create one employee)
6. ☐ Aktivera ändringsbevakning (enable notifications)

**Interaction:**
- Click item → Navigate to relevant page/feature
- Dismissible (X button) but reappears until 100% complete
- After 7 days or 100% complete, widget auto-hides

**Why this matters:**
- Drives feature adoption (activation metrics)
- Reduces time-to-value
- Increases retention (users who complete checklist churn less)

---

### Dashboard CTA Buttons

**Three primary CTAs at bottom:**

1. **"Gå till Kanban-tavla"** → Navigate to default law list Kanban
2. **"Fråga AI"** → Open right sidebar chat
3. **"Lägg till lag"** → Open "Alla Lagar" search modal

---

## Kanban Board (Compliance Workspace)

### Purpose
Main workspace for managing compliance status across all laws in a list.

### Board Structure

**One Kanban board per law list:**
- "Min huvudlista" → Kanban with 47 laws
- "Bygglagstiftning" → Separate Kanban with 15 construction laws
- Each board persists its own state (card positions, filters, sorting)

**Columns:**
1. **Not Started** - Default for all laws (sorted by priority)
2. **In Progress** - User actively working on compliance
3. **Compliant** - Compliance achieved (can be hidden via filter)

**No "Updated" column** - Updated laws stay in current column with visual badge

---

### Kanban Board Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Min huvudlista (47 lagar)                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [Quick Filters]                                              │
│ [🔴 Högprioritet: 12] [🔴 Uppdaterade: 3] [👤 Mina: 8]     │
│ [Alla filter ▼] [🔍 Sök...]                                 │
│                                                              │
│ [View Options]                                               │
│ [⚙️ Card/List] [👁️ Hide Compliant] [🏊 Swimlanes: Off]    │
│                                                              │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ Not Started  │ In Progress  │ Compliant    │              │
│ (25)         │ (15)         │ (7)          │              │
├──────────────┼──────────────┼──────────────┤              │
│              │              │              │              │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │              │
│ │ Law Card │ │ │ Law Card │ │ │ Law Card │ │              │
│ │ 🔴 High  │ │ │ 🔴 UPPD. │ │ │ ✓        │ │              │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │              │
│              │              │              │              │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │              │
│ │ Law Card │ │ │ Law Card │ │ │ Law Card │ │              │
│ │ 🟡 Med   │ │ │ 🟡 Med   │ │ │ ✓        │ │              │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │              │
│              │              │              │              │
│ [+ Add law] │              │              │              │
│              │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

---

### Law Card Design

**Maximum detail (without AI comment on card):**

```
┌─────────────────────────────────────────┐
│ Arbetsmiljölagen (1977:1160)            │
│ 🔴 Hög prioritet | 🏷️ Arbetsmiljö       │
│                                         │
│ Senast ändrad: 2024-03-15               │
│ 🔴 UPPDATERAD ← Badge for updated laws  │
│                                         │
│ 3 uppgifter | 2 kommentarer             │
│                                         │
│ Tilldelad: Anna  [@mentions: 1]         │
└─────────────────────────────────────────┘
```

**Card elements:**
- **Title:** Law name + SFS number
- **Priority badge:** 🔴 High, 🟡 Medium, ⚪ Low
- **Category tag:** Arbetsmiljö, GDPR, Skatt, etc.
- **Last changed date:** Date of last amendment
- **Updated badge:** Red "UPPDATERAD" if law changed since last review
- **Task count:** Number of tasks tied to this law
- **Comment count:** Number of team comments
- **Assigned user:** Avatar + name (if assigned)
- **@mentions:** Count of unread mentions

**Visual states:**
- **Normal:** White background, subtle border
- **Hover:** Elevated shadow, shows action icons
- **Dragging:** Semi-transparent, follows cursor
- **Updated:** Red badge, slightly highlighted background
- **Assigned to me:** Blue left border

---

### Card Interactions

**Click card:**
- Opens law card modal (Jira-style, see section below)

**Hover card:**
- Subtle elevation
- Shows action icons:
  - 💬 Comment
  - ✏️ Edit/Assign
  - 🔗 Copy link
  - ⚡ Quick status change

**Drag card:**
- Drag to different column (changes status)
- Drag to AI chat sidebar (adds context to chat)
- Visual feedback: Card becomes semi-transparent, target column highlights

**Right-click card (Context menu):**
- Assign to user
- Change status (dropdown)
- Copy link
- Add flag
- Add label
- Create task
- Remove from list (⚠️ warning confirmation)

---

### Filters & Sorting

#### Quick Filters (Always Visible)

```
[🔴 Högprioritet: 12] [🔴 Uppdaterade: 3] [👤 Mina: 8] [Alla filter ▼]
```

**Quick filter buttons:**
- **Högprioritet:** Shows only high-priority laws (red badge)
- **Uppdaterade:** Shows only laws with "UPPDATERAD" badge
- **Mina:** Shows only laws assigned to current user

**Click quick filter:**
- Toggles filter on/off
- Can combine multiple quick filters (AND logic)
- Badge shows count

---

#### Advanced Filters (Dropdown)

**Filter panel (opens from "Alla filter ▼"):**
```
┌──────────────────────────────┐
│ Filter lagar                 │
├──────────────────────────────┤
│ Prioritet:                   │
│ ☐ Hög  ☐ Medel  ☐ Låg       │
│                              │
│ Kategori:                    │
│ ☐ Arbetsmiljö                │
│ ☐ GDPR                       │
│ ☐ Skatt                      │
│ ☐ Alkohol                    │
│                              │
│ Tilldelad:                   │
│ ☐ Anna                       │
│ ☐ Johan                      │
│ ☐ Ej tilldelad               │
│                              │
│ Label:                       │
│ ☐ Restaurang                 │
│ ☐ Stockholm                  │
│                              │
│ Status:                      │
│ ☐ Not started                │
│ ☐ In progress                │
│ ☐ Compliant                  │
│                              │
│ Senast ändrad:               │
│ ☐ Senaste 7 dagarna          │
│ ☐ Senaste 30 dagarna         │
│ ☐ Senaste året               │
│                              │
│ Flaggor:                     │
│ ☐ Flaggade endast            │
│                              │
│ [Rensa filter] [Tillämpa]    │
└──────────────────────────────┘
```

**Filter logic:**
- Multiple selections within category = OR (e.g., High OR Medium priority)
- Multiple categories = AND (e.g., High priority AND Arbetsmiljö AND Assigned to Anna)
- Active filters shown as chips above Kanban board
- Click chip X to remove filter

---

#### Search

**Full-text search field:**
```
[🔍 Sök i lagnamn, kommentarer, uppgifter...]
```

**Searches across:**
- Law names (e.g., "Arbetsmiljö")
- SFS numbers (e.g., "1977:1160")
- AI-generated comments
- User comments
- Task titles

**Real-time filtering:**
- Results update as user types
- Highlights matching text in cards
- Shows "X lagar hittades" count

---

#### Sorting (Within Columns)

**Sort dropdown (per column):**
```
[⬆️⬇️ Sortera: Prioritet ▼]
```

**Sort options:**
- **Prioritet:** High → Medium → Low
- **Alfabetisk:** A → Z
- **Senast ändrad:** Newest → Oldest
- **Manuell:** User-defined drag order (default)

**Sorting behavior:**
- Each column can have independent sorting
- Sorting persists per user (saved in preferences)
- Manual sorting = drag cards within column to reorder

---

### View Options

**Toggle buttons above Kanban:**

1. **Card view vs. List view:**
   ```
   [⬜ Card View] [☰ List View]
   ```

   **List view = Table:**
   ```
   | Lag                    | Prioritet | Kategori    | Status      | Tilldelad | Uppgifter | Ändrad     |
   | Arbetsmiljölagen       | 🔴 Hög    | Arbetsmiljö | In Progress | Anna      | 3         | 2024-03-15 |
   | GDPR Anpassningslag    | 🔴 Hög    | GDPR        | Not Started | Johan     | 0         | 2024-01-10 |
   ```

   - Sortable columns (click header)
   - Click row → Opens law card modal
   - More compact, better for reviewing many laws

2. **Show/Hide "Compliant" column:**
   ```
   [👁️ Dölj efterlevda lagar]
   ```

   - Reduces clutter (focus on work in progress)
   - Compliant laws still accessible via filters

3. **Swimlanes (Group by category):**
   ```
   [🏊 Gruppera efter kategori]
   ```

   **Swimlane view:**
   ```
   Arbetsmiljö (12 lagar)
   ├─ Not Started (8) ─ In Progress (3) ─ Compliant (1) ─┤

   GDPR (5 lagar)
   ├─ Not Started (2) ─ In Progress (2) ─ Compliant (1) ─┤

   Skatt (10 lagar)
   ├─ Not Started (6) ─ In Progress (3) ─ Compliant (1) ─┤
   ```

   - Horizontal swimlanes per category
   - Same columns within each swimlane
   - Helps visualize compliance by area

---

### Updated Laws: Notification Strategy

**When law receives amendment:**
1. System detects change via Riksdagen API
2. Identifies all users with this law in their lists
3. Law card gets red "🔴 UPPDATERAD" badge
4. Law stays in current column (doesn't move)
5. User receives notification (bell icon)
6. Quick filter "Uppdaterade" shows count

**Badge on card:**
```
┌─────────────────────────────────┐
│ Arbetsmiljölagen (1977:1160)    │
│ 🔴 Hög prioritet | Arbetsmiljö  │
│                                 │
│ Senast ändrad: 2025-01-15       │
│ 🔴 UPPDATERAD ← Red badge       │
│                                 │
│ 3 uppgifter | 2 kommentarer     │
└─────────────────────────────────┘
```

**Click badge OR open modal:**
- Shows "Diff view" (what changed in the law)
- Comparison: Old version vs. New version
- Highlighted changes (red = removed, green = added)
- Mark as reviewed button (removes badge)

**Why this approach:**
- Preserves workflow (user's progress not disrupted)
- Visual indicator is clear but not interruptive
- Diff view shows exactly what changed (critical for compliance)
- User controls when to review (not forced)

---

## Law Card Modal

### Purpose
Detailed view of a single law with full compliance tracking, tasks, comments, and collaboration features.

### Modal Structure

**Opens when:** User clicks law card on Kanban board

**Layout (Jira-inspired):**

```
┌──────────────────────────────────────────────────────────┐
│ Arbetsmiljölagen (1977:1160)                    [✕ Close]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [Left Column - Details]         [Right Column - Meta]   │
│                                                          │
│ AI-kommentar:                   Status: In Progress ▼   │
│ "Som restaurang med 12          Prioritet: Hög 🔴      │
│ anställda innebär denna lag     Kategori: Arbetsmiljö  │
│ att du måste ha ett            Tilldelad: Anna ▼       │
│ systematiskt arbetsmiljö-       Flaggor: [Urgent]      │
│ arbete, utse skyddsombud,       Labels: [Restaurang]   │
│ och dokumentera risker..."                              │
│                                 Senast ändrad:          │
│ [Läs hela lagen på Riksdagen →]2024-03-15             │
│                                                          │
│ [🔴 UPPDATERAD] - Visa ändringar ↓                      │
│ ┌──────────────────────────────────────────────────────┐│
│ │ Diff View (vad ändrades):                           ││
│ │                                                      ││
│ │ § 3 Arbetsgivaren ska systematiskt planera,         ││
│ │     genomföra och följa upp verksamheten...         ││
│ │     [+ Ny text tillagd 2025-01-15]:                 ││
│ │     "Detta inkluderar nu också distansarbete."      ││
│ │                                                      ││
│ │ [Markera som granskad]                               ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ Uppgifter (3)                         [+ Lägg till]     │
│ ☐ Genomför riskbedömning arbetsmiljö  [📎 2 files]     │
│    Tilldelad: Anna | Deadline: 2025-02-15               │
│ ☐ Dokumentera skyddsrutiner                             │
│    Tilldelad: Johan | Ingen deadline                    │
│ ✓ Utse skyddsombud                                      │
│    Slutförd av: Anna | 2025-01-10                       │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ Kommentarer (2)                                          │
│ Anna (2 dagar sedan)                                     │
│ "Har vi verkligen koll på detta? @Johan kan du kolla?"  │
│ [Svara] [Redigera] [Ta bort]                            │
│                                                          │
│ Johan (1 dag sedan)                                      │
│ "@Anna jag kollar med HR-chef. Borde vara OK."         │
│ [Svara] [Redigera] [Ta bort]                            │
│                                                          │
│ [Skriv kommentar...] [@mention] [📎 Bifoga]            │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ Aktivitet (Audit trail)                                  │
│ • Anna flyttade från "Not Started" till "In Progress"   │
│   2025-01-15 kl. 09:30                                  │
│ • Johan lade till uppgift "Genomför riskbedömning"      │
│   2025-01-14 kl. 14:22                                  │
│ • System: Lagen uppdaterades (2024-03-15)               │
│   2024-03-15 kl. 11:00                                  │
│ • Anna lade till i "Min huvudlista"                     │
│   2024-01-10 kl. 10:15                                  │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ [Dra till AI Chat] [Kopiera länk] [Radera från lista]  │
└──────────────────────────────────────────────────────────┘
```

---

### Modal Sections

#### Left Column: Law Details

**1. AI-Generated Comment (Contextual)**
- Personalized explanation: "Som [company type] med [employee count] innebär denna lag att..."
- Always shows (generated during onboarding or when law added to list)
- Read-only (system-generated)

**2. Link to Full Law Text**
- "Läs hela lagen på Riksdagen →"
- Opens law page (internal wiki or external Riksdagen link)

**3. Diff View (if law updated)**
- Expandable section: "🔴 UPPDATERAD - Visa ändringar"
- Shows side-by-side or inline diff:
  - Red highlight = text removed
  - Green highlight = text added
  - Gray = unchanged
- "Markera som granskad" button → Removes "UPPDATERAD" badge

**4. Tasks Section**
- List of all tasks tied to this law
- Checkbox to mark complete
- Shows: Title, Assigned user, Deadline, File attachment count
- Click task → Opens task modal (see Task Management section)
- "+ Lägg till uppgift" → Create new task tied to this law

**5. Comments Section**
- Threaded comments (can reply)
- @mentions trigger notifications
- Rich text editor (bold, italic, lists)
- File attachments (PDF, images)
- Edit/delete own comments
- Timestamps (relative or absolute)

**6. Activity Log (Audit Trail)**
- Chronological list of all actions on this law:
  - Status changes (with user + timestamp)
  - Tasks added/completed
  - Comments posted
  - Law amendments (system events)
  - User assignments
  - Labels/flags added
- **Why critical for ISO:** Auditors need proof of compliance process
- Cannot be edited (immutable audit trail)

---

#### Right Column: Metadata

**Status Dropdown:**
```
Status: In Progress ▼
  • Not Started
  • In Progress
  • Compliant
```
- Change status directly from modal
- Updates Kanban board position

**Priority:**
```
Prioritet: Hög 🔴
  • Hög 🔴
  • Medel 🟡
  • Låg ⚪
```

**Category:**
```
Kategori: Arbetsmiljö
  (Select from predefined categories or add custom)
```

**Assigned To:**
```
Tilldelad: Anna ▼
  • Anna
  • Johan
  • Sara
  • Ej tilldelad
```

**Flags:**
```
Flaggor: [Urgent] [+ Add flag]
  (Custom flags: Urgent, Review needed, Blocked, etc.)
```

**Labels:**
```
Labels: [Restaurang] [Stockholm] [+ Add label]
  (Custom labels for filtering/organization)
```

**Last Changed:**
```
Senast ändrad: 2024-03-15
  (Date of last amendment from Riksdagen)
```

---

### Modal Actions (Bottom)

**Primary actions:**

1. **"Dra till AI Chat"**
   - Drag handle icon
   - Drag modal → Right sidebar chat
   - Adds full law context to chat (title, AI comment, tasks, comments, status)
   - AI can answer questions with full context

2. **"Kopiera länk"**
   - Copies shareable URL to clipboard
   - URL format: `laglig.se/laws/arbetsmiljolagen-1977-1160`
   - Paste in chat, email, docs to reference this law

3. **"Radera från lista"**
   - Removes law from current law list
   - ⚠️ Warning: "Detta raderar också alla uppgifter och kommentarer. Är du säker?"
   - Confirmation required

---

### Modal UX Details

**Keyboard shortcuts:**
- `Esc` → Close modal
- `Cmd/Ctrl + Enter` → Post comment
- `e` → Edit status
- `a` → Assign to user
- `c` → Focus comment field

**Responsive:**
- Desktop: Full modal (800px width)
- Tablet: Full-screen overlay
- Mobile: Native sheet (slides up from bottom)

**Performance:**
- Lazy-load activity log (load on scroll)
- Optimistic updates (UI updates before server confirms)
- Auto-save comments (draft saved to localStorage)

---

## Global Task Management

### Purpose
Centralized view of all tasks across all law lists, with filtering, sorting, and bulk actions.

### Task Structure

**Task Object:**
```javascript
{
  id: "task-123",
  title: "Genomför riskbedömning arbetsmiljö",
  description: "Fullständig riskbedömning enligt AML § 3...",
  assignedTo: "user-456", // Anna
  createdBy: "user-789", // Johan
  linkedLaw: "law-101", // Arbetsmiljölagen (OPTIONAL)
  linkedLawList: "list-001", // Min huvudlista
  status: "in_progress", // not_started, in_progress, done
  priority: "high", // high, medium, low
  dueDate: "2025-02-15",
  files: [
    { id: "file-1", name: "Riskbedömning_2025.pdf", url: "..." },
    { id: "file-2", name: "Checklista.xlsx", url: "..." }
  ],
  comments: [...],
  createdAt: "2025-01-10T14:22:00Z",
  completedAt: null,
  completedBy: null
}
```

**Key design decision:**
- Tasks CAN be tied to a law (encouraged) but NOT required
- Tasks without linked law = general tasks (like standalone Jira tickets)
- Tasks WITH linked law = compliance evidence (ISO audit trail)

---

### Global Task View

**Navigate:** Left sidebar → "✅ Uppgifter"

**Layout (Table view):**

```
┌────────────────────────────────────────────────────────────────────────┐
│ Uppgifter (23)                  [Filter ▼] [Sort ▼] [+ Ny uppgift]    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ [Quick filters]                                                        │
│ [🔴 Mina: 8] [⚠️ Försenade: 2] [✓ Slutförda: 45] [Alla filter ▼]    │
│                                                                        │
├───┬──────────────────────┬─────────────┬──────────┬──────────┬────────┤
│ ☐ │ Uppgift              │ Lag         │ Tilldelad│ Deadline │ Status │
├───┼──────────────────────┼─────────────┼──────────┼──────────┼────────┤
│ ☐ │ Genomför risk-       │ Arbetsmiljö │ Anna     │ 2025-02-15│ 🟡     │
│   │ bedömning [📎 2]     │ lagen       │          │          │        │
├───┼──────────────────────┼─────────────┼──────────┼──────────┼────────┤
│ ☐ │ Dokumentera skydds-  │ Arbetsmiljö │ Johan    │ 2025-02-20│ ⚪     │
│   │ rutiner              │ lagen       │          │          │        │
├───┼──────────────────────┼─────────────┼──────────┼──────────┼────────┤
│ ✓ │ Uppdatera integri-   │ GDPR        │ Anna     │ 2025-01-30│ ✅     │
│   │ tetspolicy           │             │          │          │        │
├───┼──────────────────────┼─────────────┼──────────┼──────────┼────────┤
│ ☐ │ Allmän uppgift utan  │ (Ingen lag) │ Johan    │ 2025-02-01│ ⚪     │
│   │ koppling till lag    │             │          │          │        │
├───┴──────────────────────┴─────────────┴──────────┴──────────┴────────┤
│                                                                        │
│ [Visa 23 av 68 uppgifter] [Nästa sida →]                              │
└────────────────────────────────────────────────────────────────────────┘
```

**Table columns:**
1. **Checkbox:** Multi-select for bulk actions
2. **Uppgift:** Title + file attachment icon/count
3. **Lag:** Linked law name (click → Open law card modal)
4. **Tilldelad:** Assigned user avatar + name
5. **Deadline:** Due date (color-coded: red if overdue, yellow if <3 days)
6. **Status:** Icon (⚪ Not started, 🟡 In progress, ✅ Done)

**Sortable columns:**
- Click column header to sort (ascending/descending)
- Multi-column sorting (Shift + click)

---

### Task Filters

**Quick filters:**
- **Mina:** Tasks assigned to me
- **Försenade:** Overdue tasks (past deadline)
- **Slutförda:** Completed tasks (usually hidden by default)

**Advanced filters (dropdown):**
- Status: Not started, In progress, Done
- Assigned to: Anna, Johan, Unassigned
- Priority: High, Medium, Low
- Due date: Overdue, This week, This month, No deadline
- Linked law: Select from law list
- Has files: Only tasks with attachments
- Created by: Filter by creator

---

### Task Modal

**Click task row → Opens task modal (similar to law card modal):**

```
┌──────────────────────────────────────────────────────────┐
│ Genomför riskbedömning arbetsmiljö             [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [Left Column]                   [Right Column - Meta]   │
│                                                          │
│ Beskrivning:                    Status: In Progress ▼   │
│ Fullständig riskbedömning       Prioritet: Hög 🔴      │
│ enligt AML § 3. Inkludera:      Tilldelad: Anna ▼      │
│ - Fysiska risker                                        │
│ - Psykosocial arbetsmiljö       Deadline: 2025-02-15   │
│ - Organisatoriska faktorer                              │
│                                                          │
│ Kopplad lag:                    Skapad av: Johan       │
│ [Arbetsmiljölagen (1977:1160)]  2025-01-10             │
│ [Öppna lag →]                                           │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ Bifogade filer (2)                                       │
│ 📄 Riskbedömning_2025.pdf (2.3 MB)  [📥 Ladda ner]     │
│ 📊 Checklista.xlsx (145 KB)          [📥 Ladda ner]     │
│ [📎 Bifoga fil]                                         │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ Kommentarer (1)                                          │
│ Johan (1 dag sedan)                                      │
│ "@Anna glöm inte inkludera kontorsergonomi!"           │
│                                                          │
│ [Skriv kommentar...] [@mention] [📎 Bifoga]            │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ Aktivitet                                                │
│ • Anna startade uppgiften (2025-01-12)                  │
│ • Johan bifogade "Checklista.xlsx" (2025-01-11)        │
│ • Johan skapade uppgiften (2025-01-10)                  │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ [Markera som klar] [Dra till AI Chat] [Ta bort]        │
└──────────────────────────────────────────────────────────┘
```

**Key features:**
- **Linked law:** Link to law card (bidirectional relationship)
- **File attachments:** Upload evidence of compliance (PDFs, images, spreadsheets)
- **Comments:** Team discussion with @mentions
- **Activity log:** Audit trail (who did what, when)
- **Drag to AI Chat:** Get help completing task from AI

---

### Why File Attachments Matter (ISO Compliance)

**Scenario: ISO 14001 Audit**

Auditor asks: "Show me proof you comply with Arbetsmiljölagen."

**User workflow:**
1. Open "Arbetsmiljölagen" law card
2. See 3 completed tasks:
   - ✓ Genomför riskbedömning [📎 Riskbedömning_2025.pdf]
   - ✓ Dokumentera skyddsrutiner [📎 Skyddsplan_v2.pdf]
   - ✓ Utse skyddsombud [📎 Utnämningsbrev_Anna.pdf]
3. Activity log shows dates, users who completed each task
4. Click file to download and show auditor

**Result:** Complete compliance documentation in one place, auditor satisfied in minutes.

**This is the killer feature for ISO consultant segment!**

---

## AI Chat Integration

### Purpose
Persistent AI assistant accessible from anywhere in the application, with context awareness and drag-and-drop component integration.

### Right Sidebar Chat

**Toggle mechanism:**
- Icon on right side of screen (⚡ lightning bolt or 💬 chat bubble)
- Click to fold in/out
- Starts EXPANDED by default (first-time users for discoverability)
- Users can fold in to maximize workspace

**Sidebar dimensions:**
- Width: 400px fixed
- Height: Full viewport height (minus header)
- Can pop out to full-screen modal

---

### Chat Sidebar Structure

```
┌─────────────────────────────┐
│ AI-Assistent          [✕][↗]│← Close | Pop-out full-screen
├─────────────────────────────┤
│ [Chat history ▼]            │← Dropdown: Switch between chats
│   • Arbetsmiljö diskussion  │
│   • GDPR-frågor (5 jan)     │
│   + Ny chat                 │
├─────────────────────────────┤
│                             │
│ [Conversation - scrollable] │
│                             │
│ AI: Hej Alexander! Jag ser  │← Context-aware welcome
│     att du arbetar med din  │
│     laglista. Hur kan jag   │
│     hjälpa dig idag?        │
│                             │
│ You: Vad innebär den nya    │
│      ändringen i AML?       │
│                             │
│ AI: Den nya ändringen i     │
│     Arbetsmiljölagen (2025- │
│     01-15) innebär att...   │
│     [Källa: AML § 3]        │
│                             │
│ [Drag components here ↓]    │← Drop zone (highlighted on drag)
│ 📄 Arbetsmiljölagen         │← Dropped law card (chip)
│                             │
│ You: Hur påverkar denna lag │
│      våra 12 anställda?     │
│                             │
│ AI: Med kontext från        │
│     Arbetsmiljölagen och    │
│     er företagsprofil...    │
│                             │
├─────────────────────────────┤
│ [💬 Skriv din fråga...]     │← Text input
│ [📎]              [Send →]  │← Attach files | Send button
└─────────────────────────────┘
```

---

### Key Features

#### 1. Chat History (ChatGPT-style)

**Dropdown menu:**
- List of previous conversations (last 30 days)
- Conversation titles auto-generated by AI based on first message
- "+ Ny chat" to start fresh conversation
- Delete old conversations

**Persistence:**
- Each conversation saved with full history
- Switch between conversations without losing context
- Conversations tied to user account (sync across devices)

---

#### 2. Context Awareness

**Chat knows which page user is on:**

**Example contexts:**

**On Dashboard:**
```
AI: Hej! Jag ser att du är på Dashboard. Vill du ha hjälp med något från din laglista eller dina uppgifter?
```

**On Kanban board (Arbetsmiljö filtered):**
```
AI: Jag ser att du tittar på arbetsmiljölagar. Har du frågor om någon specifik lag?
```

**On HR module:**
```
AI: Jag ser att du är i HR-modulen. Fråga mig om anställningsregler, arbetsmiljö eller medarbetarfrågor!
```

**Viewing specific law card:**
```
AI: Jag ser att du tittar på Arbetsmiljölagen. Vill du veta något specifikt om denna lag?
```

**Implementation:**
- AI receives page context with each message (URL, current view, filtered data)
- Welcome message updates when context changes
- More relevant, personalized responses

---

#### 3. Drag-and-Drop Components

**Draggable components:**
1. **Law cards** (from Kanban board)
2. **Employee cards** (from HR module)
3. **Employee group cards** (list of employees)
4. **Task cards** (from task list)

**Drag interaction:**
1. User starts dragging law card from Kanban
2. Right sidebar highlights with "Släpp här för att lägga till kontext"
3. User drops card in chat sidebar
4. Card appears as chip in conversation:
   ```
   📄 Arbetsmiljölagen (1977:1160)
   [✕ Remove]
   ```
5. AI receives full card context:
   - Law title, SFS number
   - AI-generated comment
   - Priority, category
   - Tasks (titles, status)
   - Comments from team
   - Status (Not started, In progress, Compliant)

**Example conversation with context:**
```
[User drags Arbetsmiljölagen card + Anna's employee card]

📄 Arbetsmiljölagen (1977:1160)
👤 Anna (HR Manager, Anställd: 2020)

User: Vad behöver Anna göra för att vi ska uppfylla denna lag?

AI: Baserat på Arbetsmiljölagen och Annas roll som HR Manager, här är vad hon bör göra:

1. Genomföra systematiskt arbetsmiljöarbete (AML § 3)
2. Dokumentera risker och åtgärder
3. Säkerställa att skyddsombud är utsett
4. Utbilda personal om arbetsmiljörutiner

Ska jag skapa uppgifter för dessa i systemet? [Ja] [Nej]
```

**Why this is powerful:**
- AI has FULL context without user typing details
- Reduces friction (no "copy-paste law name")
- Enables complex, multi-component queries
- Feels like "showing" AI what you're working on

---

#### 4. File Attachments

**Click 📎 icon:**
- Upload files from computer (PDF, images, spreadsheets)
- Files sent to AI for analysis
- Use cases:
  - "Läs detta kontrakt och säg om det följer GDPR"
  - "Analysera denna riskbedömning enligt AML"
  - "Är denna policy uppdaterad enligt nya regler?"

**Note:** Vercel AI SDK supports file uploads with vision models

---

#### 5. Full-Screen Mode

**Click ↗ icon:**
- Chat expands to full-screen modal
- Covers entire workspace (except header)
- More space for complex conversations
- Useful for long AI responses or multiple components

**Full-screen advantages:**
- Better for reading long AI explanations
- More room to view dropped components
- Focus mode (no distractions)
- Click outside or Esc to return to sidebar

---

#### 6. RAG-Based Responses (No Hallucinations)

**Every AI response includes:**
1. Answer based ONLY on Swedish legal documents (SFS, court cases, EU law)
2. Citations with source references:
   ```
   [Källa: Arbetsmiljölagen (1977:1160) § 3]
   ```
3. If AI doesn't know: "Jag har inte tillräcklig information för att svara på det. Vill du att jag söker i Riksdagens databas?"

**No query counter in trial** (per your feedback - removed from earlier plan)

---

### Chat UX Details

**Typing indicators:**
- "AI skriver..." with animated dots

**Streaming responses:**
- Text streams in word-by-word (Vercel AI SDK)
- User can start reading before response completes

**Error handling:**
- If API timeout: "Oj, det tog för lång tid. Försök igen?"
- If no results: "Jag hittade inga lagar som svarar på det. Kan du formulera om frågan?"

**Keyboard shortcuts:**
- `Enter` → Send message
- `Shift + Enter` → New line
- `Esc` → Close chat sidebar
- `/` → Focus chat input (global shortcut)

---

## Mina Filer (Document Storage)

### Purpose
Central storage for company documents and files that can be dragged into AI chat for contextual analysis and compliance review.

### Location
**Navigate:** Left sidebar → "📁 Mina Filer"

---

### File Storage Interface

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ Mina Filer                           [🔍 Sök] [⬆️ Ladda upp]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [Mappar]                                                       │
│ 📁 Anställningskontrakt (12 filer)                            │
│ 📁 Riskbedömningar (8 filer)                                  │
│ 📁 Policyer och rutiner (15 filer)                            │
│ 📁 Certifikat och intyg (5 filer)                             │
│ + Skapa ny mapp                                                │
│                                                                │
│ [Senaste filer]                                                │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ 📄 Arbetsmiljöpolicy_2025.pdf          2.3 MB  2 dagar  │   │
│ │ 📊 Riskbedömning_Kontor.xlsx          145 KB   5 dagar  │   │
│ │ 📝 Anställningsavtal_Anna.docx        890 KB   1 vecka  │   │
│ │ 🖼️ Certifikat_ISO14001.jpg            1.2 MB   2 veckor │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                │
│ [Alla filer - Table view]                                     │
├────┬──────────────────────────┬────────┬─────────────┬────────┤
│ ☐  │ Filnamn                  │ Storlek│ Uppladdad   │ Åtgärd │
├────┼──────────────────────────┼────────┼─────────────┼────────┤
│ ☐  │ 📄 Arbetsmiljöpolicy.pdf │ 2.3 MB │ 2025-01-28  │ [···]  │
│ ☐  │ 📊 Riskbedömning.xlsx    │ 145 KB │ 2025-01-26  │ [···]  │
│ ☐  │ 📝 Anställningsavtal.docx│ 890 KB │ 2025-01-22  │ [···]  │
├────┴──────────────────────────┴────────┴─────────────┴────────┤
│ [Visa 24 av 52 filer] [Nästa sida →]                          │
└────────────────────────────────────────────────────────────────┘
```

---

### Key Features

#### 1. Folder Organization

**Default folders (auto-created):**
- **Anställningskontrakt** - Employment contracts
- **Riskbedömningar** - Risk assessments
- **Policyer och rutiner** - Policies and procedures
- **Certifikat och intyg** - Certificates and attestations
- **Allmänna dokument** - General documents

**Custom folders:**
- User can create custom folders
- Nested folders (up to 3 levels)
- Drag-and-drop files between folders

---

#### 2. File Upload

**Upload methods:**
- Click "⬆️ Ladda upp" button
- Drag-and-drop files into interface
- Upload multiple files simultaneously

**Supported file types:**
- Documents: PDF, DOCX, XLSX, TXT
- Images: JPG, PNG
- Archives: ZIP (auto-extracts contents)

**File size limits:**
- Basic tier: Max 10 MB per file, 1 GB total storage
- Pro tier: Max 50 MB per file, 10 GB total storage
- Enterprise tier: Custom limits

**Upload UX:**
```
┌─────────────────────────────────────┐
│ Laddar upp... (2/5 filer)           │
│ ████████████░░░░░░░░ 60%            │
│                                     │
│ ✓ Arbetsmiljöpolicy.pdf (2.3 MB)   │
│ → Riskbedömning.xlsx (145 KB)...   │
│ ☐ Anställningsavtal.docx (890 KB)  │
│ ☐ Policy_GDPR.pdf (1.5 MB)         │
│ ☐ Certifikat.jpg (1.2 MB)          │
└─────────────────────────────────────┘
```

---

#### 3. File Management

**File actions (··· dropdown menu):**
- **Ladda ner** - Download to computer
- **Förhandsgranska** - Preview in browser (PDF, images)
- **Byt namn** - Rename file
- **Flytta till mapp** - Move to different folder
- **Kopiera länk** - Copy shareable link (Pro/Enterprise, with permissions)
- **Dra till AI Chat** - Drag handle for chat integration
- **Koppla till lag** - Link file to specific law card (creates reference)
- **Koppla till uppgift** - Link file to specific task
- **Radera** - Delete file (confirmation required)

**Bulk actions:**
- Select multiple files (checkboxes)
- Bulk download (creates ZIP)
- Bulk move to folder
- Bulk delete

---

#### 4. Search & Filtering

**Search:**
```
[🔍 Sök i filnamn och innehåll...]
```
- Full-text search in file names
- OCR search in PDF content (future)
- Instant results as user types

**Filters:**
- File type: PDF, DOCX, XLSX, Images, All
- Upload date: Last 7 days, 30 days, 3 months, Year, All time
- Folder: Filter by folder
- Size: Small (<1 MB), Medium (1-10 MB), Large (>10 MB)
- Linked to: Laws, Tasks, Unlinked

**Sorting:**
- Name (A-Z, Z-A)
- Date uploaded (Newest, Oldest)
- File size (Largest, Smallest)
- File type

---

#### 5. Drag-and-Drop to AI Chat

**The killer feature:**

**User workflow:**
1. Open "Mina Filer" page
2. Find relevant document (e.g., "Riskbedömning_2025.pdf")
3. Drag file to AI chat sidebar (right sidebar)
4. File appears as attachment in chat
5. AI receives file content for analysis

**Chat interaction:**
```
[User drags Riskbedömning_2025.pdf to chat]

📎 Riskbedömning_2025.pdf (2.3 MB)
[✕ Remove]

User: Är denna riskbedömning komplett enligt
      Arbetsmiljölagen?

AI: Jag har analyserat er riskbedömning.
    Här är min bedömning:

    ✅ Täcker fysiska risker (AML § 3)
    ✅ Inkluderar psykosocial arbetsmiljö
    ⚠️  SAKNAS: Dokumentation av åtgärdsplan
    ⚠️  SAKNAS: Uppföljningsdatum

    För att vara fullständig enligt AML behöver ni:
    1. Lägga till konkreta åtgärder för varje risk
    2. Sätta datum för uppföljning (minst årlig)

    [Källa: Arbetsmiljölagen (1977:1160) § 3,
     Arbetsmiljöverkets föreskrift AFS 2001:1]
```

**Why this is powerful:**
- AI analyzes actual company documents (not just laws)
- Provides specific, actionable compliance feedback
- Reduces "does our policy comply?" questions to legal department
- Creates audit trail (file + AI analysis + timestamp)

---

#### 6. File Preview

**Click file name → Opens preview modal:**

```
┌──────────────────────────────────────────────────────────┐
│ Arbetsmiljöpolicy_2025.pdf                     [✕ Close] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [PDF viewer with zoom, page navigation]                 │
│                                                          │
│ [Preview content rendered here]                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Fil-information:                                         │
│ • Storlek: 2.3 MB                                        │
│ • Uppladdad: 2025-01-28 av Alexander                    │
│ • Mapp: Policyer och rutiner                            │
│                                                          │
│ Kopplad till:                                            │
│ • Arbetsmiljölagen (1977:1160)                          │
│ • Uppgift: "Uppdatera arbetsmiljöpolicy"                │
│                                                          │
│ [Ladda ner] [Dra till AI Chat] [Redigera info] [Radera]│
└──────────────────────────────────────────────────────────┘
```

**Preview support:**
- PDF: Full rendering with zoom, page navigation
- Images: Zoom, rotate
- DOCX: Converted to HTML preview (basic formatting)
- XLSX: Sheet tabs, cell grid (read-only)
- TXT: Plain text with syntax highlighting (if code)
- Other: Download prompt

---

#### 7. Linking Files to Laws and Tasks

**Create references between files and compliance work:**

**Link file to law card:**
1. Open file actions menu (···)
2. Click "Koppla till lag"
3. Search/select law (e.g., "Arbetsmiljölagen")
4. File appears in law card modal under "Relaterade filer"
5. Bidirectional link (law card ↔ file)

**Link file to task:**
1. Open file actions menu (···)
2. Click "Koppla till uppgift"
3. Search/select task
4. File appears in task modal as attachment
5. Use case: Evidence of task completion (ISO audit trail)

**Use case - ISO Audit:**
```
Auditor: "Show proof of risk assessment compliance."

User workflow:
1. Open Arbetsmiljölagen law card
2. See linked file: "Riskbedömning_2025.pdf"
3. Click to preview
4. See also linked task: "Genomför riskbedömning" (completed)
5. Activity log shows: Anna completed task + uploaded file + date

Result: Complete compliance evidence chain
```

---

### Storage Quotas & Upgrades

**Basic tier:**
- 1 GB total storage
- Max 10 MB per file
- No version history
- No shared folders

**Pro tier:**
- 10 GB total storage
- Max 50 MB per file
- Version history (last 10 versions per file)
- Shared folders with team (Pro tier feature)

**Enterprise tier:**
- Custom storage limits (negotiated)
- Max 500 MB per file
- Unlimited version history
- Advanced permissions (read/write/admin per folder)
- SSO integration for file access

**Upgrade prompts:**
```
⚠️ Du närmar dig din lagringsgräns
   920 MB av 1 GB använt (92%)

   Uppgradera till Pro för 10 GB lagring
   [Uppgradera →] [Hantera filer]
```

---

### File Permissions (Pro/Enterprise)

**Shared folder permissions:**
- **Owner:** Full control (upload, delete, manage permissions)
- **Editor:** Can upload, rename, move files
- **Viewer:** Can only view and download files

**Share folder with team:**
```
┌─────────────────────────────────────┐
│ Dela mapp: Policyer och rutiner     │
├─────────────────────────────────────┤
│ Bjud in teammedlemmar:              │
│                                     │
│ Anna    [Editor ▼]    [✕]          │
│ Johan   [Viewer ▼]    [✕]          │
│                                     │
│ [+ Lägg till person]                │
│                                     │
│ [Spara] [Avbryt]                    │
└─────────────────────────────────────┘
```

---

### Integration with Other Features

**1. Task attachments:**
- Files uploaded to task modal → Auto-saved to "Mina Filer"
- Folder: "Uppgiftsfiler" (auto-created)
- Linked to task automatically

**2. AI Chat file uploads:**
- Files attached in chat → Saved to "AI Chat-filer" folder
- Temporary vs. permanent save option
- Can be moved to other folders later

**3. Change monitoring alerts:**
- Law updated → AI suggests: "Review your [Arbetsmiljöpolicy.pdf] to ensure compliance with new requirements"
- Click → Opens file + law card side-by-side

**4. HR module:**
- Employee documents (contracts, certificates) → Auto-linked to employee cards
- Folder: "HR-dokument/[Employee name]"

---

### Search & Discovery

**Global search integration:**
- Header search (🔍) includes files
- Search results show: File name, preview snippet, location (folder), date

**AI-powered file insights (future):**
- "Vi upptäckte att din GDPR-policy är från 2020. Rekommenderar granskning."
- "3 filer innehåller hänvisningar till Arbetsmiljölagen - vill du koppla dem?"

---

### Mobile Access

**Desktop-first (post-MVP for mobile):**
- Full file manager on desktop
- Mobile: View and download files only
- No upload or drag-and-drop on mobile (technical limitations)

---

### Technical Implementation

**Storage:**
- Cloud storage: AWS S3 or Vercel Blob Storage
- CDN for fast downloads
- Server-side virus scanning (ClamAV)

**File processing:**
- PDF: Render with pdf.js
- Images: Thumbnail generation (256px, 1024px)
- DOCX/XLSX: Convert to HTML with mammoth.js / SheetJS
- OCR: Future (Tesseract for searchable PDFs)

**Database:**
```sql
files:
  - id
  - user_id
  - filename
  - original_filename
  - file_type (mime type)
  - file_size (bytes)
  - storage_path (S3 URL)
  - folder_id (FK)
  - uploaded_at
  - uploaded_by (user_id FK)
  - linked_law_id (optional FK)
  - linked_task_id (optional FK)

folders:
  - id
  - user_id
  - name
  - parent_folder_id (for nesting)
  - created_at
```

---

### Security & Privacy

**Access control:**
- Files scoped per user account (Basic tier)
- Shared folders scoped per team (Pro/Enterprise)
- No public file links (must be authenticated)

**Encryption:**
- Files encrypted at rest (S3 server-side encryption)
- HTTPS for all transfers
- Virus scanning on upload

**Data retention:**
- Deleted files → Soft delete (30-day recovery period)
- After 30 days → Permanent deletion
- Account cancellation → Files deleted after 90 days (grace period)

---

### Why "Mina Filer" is Strategic

**1. Reduces external tool dependency:**
- Users currently store docs in Google Drive/Dropbox
- Keep everything in one place = stickier product

**2. Creates compliance evidence chain:**
- File → Linked to law → Linked to task → Activity log
- Complete audit trail in one system

**3. Enhances AI capabilities:**
- AI can analyze actual company documents
- More valuable, specific advice
- "Does MY policy comply?" vs. "What does the law say?"

**4. Competitive differentiation:**
- Notisum/Karnov don't have document storage
- Integrated workflow (law research + document management + AI)

**5. Upsell opportunity:**
- Storage limits drive Pro upgrades
- Teams need shared folders
- Advanced permissions = Enterprise feature

---

## Notifications System

### Purpose
Keep users informed of important events (law changes, task assignments, mentions) with priority-based delivery.

### Notification Priority Levels

**🔴 High Priority (Interruptive):**
- Trial expiring in 24 hours
- Payment failed
- Critical law change (high-priority law updated)

**Delivery:** Push notification (browser), email immediately, in-app badge

**🟡 Medium Priority (In-app):**
- Task assigned to you
- @mentioned in comment
- Law change (medium-priority law)
- Upcoming task deadline (due in 3 days)

**Delivery:** In-app badge, email digest (daily), no push notification

**⚪ Low Priority (Informational):**
- Team member activity
- New feature announcement
- Task completed by someone else
- Low-priority law change

**Delivery:** In-app only, no email, no badge

---

### Notification Center

**Location:** Header bar, bell icon (🔔) in top-right

**Badge count:**
- Shows total unread notifications
- High priority = red badge
- Medium priority = yellow badge
- Low priority = no badge (but shows in center)

**Click bell → Opens dropdown:**

```
┌─────────────────────────────────────┐
│ Notiser (5 olästa) [Markera alla]  │
├─────────────────────────────────────┤
│                                     │
│ 🔴 Din provperiod går ut om 2 dagar│
│    [Uppgradera nu →]                │
│    5 minuter sedan                  │
│                                     │
│ 🟡 Anna @nämnde dig i GDPR          │
│    "Kan du kolla detta?"            │
│    [Se kommentar →]                 │
│    2 timmar sedan                   │
│                                     │
│ 🟡 Arbetsmiljölagen uppdaterad      │
│    Ändrad: 2025-01-15               │
│    [Granska ändringar →]            │
│    4 timmar sedan                   │
│                                     │
│ ⚪ Johan slutförde uppgift          │
│    "Dokumentera skyddsrutiner"      │
│    Igår kl. 14:30                   │
│                                     │
│ ⚪ Ny funktion: Exportera till PDF  │
│    [Läs mer →]                      │
│    3 dagar sedan                    │
│                                     │
│ [Visa alla notiser →]               │
└─────────────────────────────────────┘
```

**Notification item structure:**
- **Icon:** Priority color indicator (🔴🟡⚪)
- **Title:** Brief description
- **Context:** Additional info or preview
- **Action button:** Navigate to relevant page
- **Timestamp:** Relative time

**Interactions:**
- Click notification → Navigate to source (law card, task, comment)
- Hover → Shows "Mark as read" button
- "Markera alla lästa" → Clear all notifications

---

### Email Digest

**Daily summary email (sent at 9 AM):**
```
Subject: Laglig.se - 3 ändringar, 2 uppgifter, 1 kommentar

Hej Alexander,

Här är vad som hänt sedan igår:

🔴 VIKTIGT:
• Arbetsmiljölagen uppdaterad (kräver granskning)
  → Granska ändringar: [Link]

🟡 UPPGIFTER:
• Anna tilldelade dig: "Genomför riskbedömning"
  Deadline: 2025-02-15
  → Se uppgift: [Link]

🟡 KOMMENTARER:
• Johan @nämnde dig i GDPR
  "Kan du kolla detta?"
  → Svara: [Link]

[Logga in på Laglig.se →]
```

**Email preferences (in Settings):**
- Real-time for high-priority only
- Daily digest for medium-priority
- Weekly digest for low-priority
- Opt-out per notification type

---

## First-Time User Experience

### Purpose
Guide new users through key features to drive activation and reduce time-to-value.

### Interactive Tutorial

**Triggers on first login after onboarding:**

**Step 1: Welcome modal**
```
┌─────────────────────────────────────┐
│ Välkommen till Laglig.se! 🎉        │
│                                     │
│ Vi ska snabbt visa dig hur allt    │
│ fungerar. Det tar bara 2 minuter.  │
│                                     │
│ [Starta guiden →] [Hoppa över]     │
└─────────────────────────────────────┘
```

**Step 2: Left sidebar highlight**
```
[Tooltip pointing to left sidebar]
"Detta är din navigering. Här hittar du:
• Dashboard (översikt)
• Laglistor (dina lagar och Kanban-tavlor)
• Uppgifter (alla dina uppgifter)
• HR (medarbetarhantering)"

[Nästa →]
```

**Step 3: Laglistor accordion**
```
[Tooltip pointing to "Laglistor" accordion]
"Här är din första laglista med 47 lagar
anpassade för ditt företag. Klicka för att öppna."

[User clicks → Accordion expands]

"Perfekt! Nu ser du 'Min huvudlista'. Klicka på den."

[Nästa →]
```

**Step 4: Kanban board**
```
[User lands on Kanban board]
[Tooltip pointing to columns]
"Detta är din Kanban-tavla. Här spårar du
efterlevnad för varje lag:
• Not Started → Lagar du inte börjat med
• In Progress → Pågående arbete
• Compliant → Efterlevda lagar"

[Nästa →]
```

**Step 5: Law card**
```
[Tooltip highlighting a law card]
"Klicka på en lag för att se detaljer,
lägga till uppgifter eller kommentera."

[User clicks card → Modal opens]

"Bra! Här ser du all information om lagen,
inklusive AI-genererade förklaringar."

[Nästa →]
```

**Step 6: AI Chat**
```
[Tooltip pointing to right sidebar toggle]
"Fråga vår AI om lagar när som helst.
AI:n ger endast faktabaserade svar från
svenska lagar - inga gissningar!"

[User clicks → Chat sidebar opens]

[Nästa →]
```

**Step 7: Drag-and-drop demo**
```
[Animated demo]
"Du kan dra lagkort direkt in i chatten
för att ge AI:n mer kontext."

[Animation shows card being dragged into chat]

"Prova själv! Dra ett lagkort till chatten."

[User completes → Tutorial ends]
```

**Step 8: Tutorial complete**
```
┌─────────────────────────────────────┐
│ Du är redo! 🎉                      │
│                                     │
│ Du har nu lärt dig grunderna.      │
│ Fortsätt utforska eller använd     │
│ checklistan nedan för att komma     │
│ igång ordentligt.                   │
│                                     │
│ [Börja arbeta →]                    │
└─────────────────────────────────────┘
```

---

### Onboarding Checklist

**Widget on Dashboard (visible for 7 days):**

```
┌─────────────────────────────────────┐
│ Kom igång med Laglig.se (4/6)      │
├─────────────────────────────────────┤
│ ✅ Skapa konto och laglista         │
│ ✅ Utforska din Kanban-tavla        │
│ ✅ Ställ en fråga till AI           │
│ ✅ Flytta en lag till "In Progress" │
│ ☐ Lägg till en medarbetare (HR)    │
│ ☐ Aktivera ändringsbevakning       │
│                                     │
│ [Fortsätt →] [✕ Stäng]             │
└─────────────────────────────────────┘
```

**Checklist items auto-complete when user:**
1. ✅ Creates account (done in onboarding)
2. ✅ Visits Kanban board (first time)
3. ✅ Sends message to AI chat
4. ✅ Moves any law card to "In Progress" column
5. ☐ Adds one employee in HR module
6. ☐ Enables change monitoring notifications

**Click checklist item:**
- Navigates to relevant page/feature
- Helps user discover features

**After 7 days OR 100% complete:**
- Widget auto-hides
- Can be re-enabled in Settings ("Visa checklista igen")

---

### Empty States

**Kanban board with 0 laws:**
```
┌─────────────────────────────────────┐
│ Din laglista är tom                 │
│                                     │
│ Lägg till lagar från "Alla Lagar"  │
│ eller låt AI:n rekommendera lagar   │
│ baserat på din verksamhet.          │
│                                     │
│ [Sök i Alla Lagar →]                │
│ [Fråga AI om rekommendationer →]    │
└─────────────────────────────────────┘
```

**Task list with 0 tasks:**
```
┌─────────────────────────────────────┐
│ Inga uppgifter ännu                 │
│                                     │
│ Skapa uppgifter för att spåra       │
│ compliance-arbete och bygga         │
│ revision-redo dokumentation.        │
│                                     │
│ [Skapa första uppgiften →]          │
└─────────────────────────────────────┘
```

---

## Technical Implementation

### Frontend Stack

**Framework:**
- Next.js 14+ (App Router)
- React Server Components for initial render
- Client Components for interactive features

**UI Library:**
- shadcn/ui + Tailwind CSS + Animate UI (https://animate-ui.com/)
- Radix UI primitives (modals, dropdowns, tooltips)
- Framer Motion for animations

**State Management:**
- React Context for global state (user, theme)
- Zustand for complex state (Kanban board, filters)
- TanStack Query for server state

**Drag-and-Drop:**
- @dnd-kit/core for Kanban board
- Custom drag handlers for chat sidebar integration

---

### Backend Architecture

**API Layer:**
- Next.js API Routes + tRPC for type-safe APIs
- REST endpoints for webhooks (Stripe, Riksdagen)

**Database:**
- PostgreSQL (Supabase or Neon)
- Tables:
  - `users` (accounts, profiles)
  - `law_lists` (user's law lists)
  - `law_list_items` (laws in lists, with status)
  - `tasks` (with optional law_id FK)
  - `comments` (on laws and tasks)
  - `notifications` (in-app notifications)
  - `activity_logs` (audit trail)

**Real-time:**
- WebSockets (Supabase Realtime or Pusher)
- Live updates for:
  - Team member actions (card moves, comments)
  - Notifications
  - AI chat streaming

---

### Key Interactions & Performance

**Kanban Board:**
- Optimistic updates (card moves instantly, sync in background)
- Virtual scrolling for large lists (100+ laws)
- Debounced filtering/search (300ms delay)

**Law Card Modal:**
- Lazy-load activity log (fetch on scroll)
- Optimistic comment posting
- Auto-save comment drafts (localStorage)

**AI Chat:**
- Streaming responses (Vercel AI SDK `useChat` hook)
- Message history pagination (load 20 at a time)
- Optimistic message sending

**Notifications:**
- Polling (every 30 seconds when tab active)
- WebSocket for real-time (optional, if available)
- Service Worker for push notifications (future)

---

### Mobile Responsiveness

**Desktop-first approach (per your feedback):**
- Full dashboard on desktop (1920×1080)
- Simplified views on tablet (1024×768)
- Minimal mobile support (375×667)

**Mobile behavior (post-MVP):**
- Left sidebar → Hamburger menu
- Right chat sidebar → Full-screen modal
- Kanban board → Tabs per column (horizontal swipe)
- Law card modal → Full-screen overlay

---

### Accessibility

**Keyboard navigation:**
- Tab through interactive elements
- Arrow keys in Kanban (move focus between cards)
- Enter to open modals
- Esc to close modals
- Shortcuts for power users (future)

**Screen readers:**
- ARIA labels on all interactive elements
- Live regions for notifications
- Semantic HTML (headings, lists, forms)

**Color contrast:**
- WCAG AA compliance (4.5:1 ratio)
- Priority colors distinguishable for colorblind users

---

## Success Metrics

### Activation Metrics (First 7 days)

**Goal:** Drive feature adoption to increase retention

1. **Onboarding checklist completion:** >70% complete 4+ items
2. **AI chat usage:** >60% send ≥1 message
3. **Law card opened:** >80% open ≥1 law card modal
4. **Kanban interaction:** >50% move ≥1 card
5. **Task creation:** >30% create ≥1 task

---

### Engagement Metrics (Ongoing)

**Goal:** Measure active usage and value delivery

1. **DAU/MAU ratio:** >30% (users return frequently)
2. **Laws tracked:** Average 40-50 per user
3. **Tasks created:** Average 5-10 per week
4. **AI chat queries:** Average 10-15 per week
5. **Comments posted:** Average 3-5 per week (Pro tier)

---

### Retention Metrics

**Goal:** Reduce churn via consistent value delivery

1. **Trial-to-paid conversion:** >40%
2. **Monthly churn:** <4% (target: 3%)
3. **Change monitoring engagement:** >80% click "Se ändringar" when law updates
4. **Compliance score improvement:** Average +10% in first 30 days

---

## Next Steps

### Remaining Features to Specify

1. **AI Chat Interface** - Deep dive into RAG, component streaming, conversation design (partially covered here)
2. **Law Pages (Alla Lagar)** - 10k+ SEO wiki structure, browsing, adding to lists
3. **HR Module** - Employee management, templates, compliance tracking
4. **Change Monitoring System** - How changes detected, diff generation, notification triggers
5. **User/Team Management** - Admin settings, roles, permissions, billing

---

**Status:** Dashboard/Workspace specification is now COMPLETE and ready for PRD handoff

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Author:** Mary (Business Analyst) + Alexander Adstedt
