# User Interface Design Goals

## Overall UX Vision

**Design Philosophy:** "Coolt med koll" - Compliance as aspirational, modern business infrastructure

Laglig.se transforms legal compliance from bureaucratic drudgery into intuitive, even _enjoyable_ workflows. The UI should feel like **Jira met a modern legal AI assistant** - powerful for professionals, approachable for SMB owners.

**Core UX Principles:**

1. **Progressive Disclosure** - Hide complexity until needed. Start simple (law list), reveal depth on interaction (drag into chat, view detailed diff).

2. **Component-First Mental Model** - Everything is a draggable, reusable card (law, employee, task, file). Users build context visually, not through complex forms.

3. **Streaming = Magic** - Dynamic onboarding streams law list generation in real-time. AI chat streams responses. Users see intelligence at work, building trust.

4. **Zero Jargon** - Legal terms explained in plain Swedish. Status badges use symbols + short text ("✅ Compliant" not "Regulatory adherence achieved").

5. **Confidence Through Clarity** - Users should always know: What do I need to do? Why does this matter? Where do I find help?

---

## Key Interaction Paradigms

### 1. Drag-and-Drop Context Building

**Interaction:** Users drag law cards, employee cards, task cards, files directly into AI chat sidebar to build contextual queries.

**Why it works:**

- **Tangible** - Makes abstract "context" feel physical and manipulable
- **Discoverable** - Hover states and drop zones teach the interaction naturally
- **Powerful** - Enables complex multi-entity queries without forms

**Implementation notes:**

- Visual feedback: Glow/highlight on hover, smooth animation on drop
- Context pills appear above chat input showing active components
- Max 10 components to prevent context overload

---

### 2. Streaming Intelligence

**Interaction:** AI responses, onboarding law lists, and component suggestions stream word-by-word or card-by-card to frontend.

**Why it works:**

- **Perceived performance** - User sees progress immediately
- **Trust building** - Watching AI "think" makes process transparent
- **Engagement** - Streaming creates anticipation

**Implementation notes:**

- Vercel AI SDK `useChat` hook for text streaming
- Component streaming: Law cards appear one-by-one
- Graceful handling if stream interrupted

---

### 3. Task-Centric Compliance Workflow

**Interaction:** Four-layer architecture with Jira-style modals:

1. **Law List** - Primary compliance view showing list items with status, responsible person, progress
2. **Legal Document Modal** - Jira-style two-panel (60% scrollable left, 40% static right) for deep work on a law: AI summary, tasks, evidence, activity log, collapsible legal text
3. **Task Workspace** - Kanban board where task cards (not laws) move through customizable columns (default: Att göra, Pågående, Klar)
4. **Task Modal** - Same two-panel layout for task details, assignees, due dates, evidence, comments

**Why it works:**

- **Familiar mental model** - Mimics Jira's issue modal layout users already know
- **Separation of concerns** - Laws define what to comply with; tasks define how to achieve compliance
- **Multi-list flexibility** - Same law can appear on multiple lists with independent tracking
- **Visual progress** - Task Kanban shows operational progress; law list shows compliance status

**Implementation notes:**

- Use @dnd-kit for Task Kanban drag-and-drop
- Modal proportions: 80% viewport width, 90% height (matching Jira)
- Left panel scrollable, right panel fixed position
- Mobile: Full-screen modal with tab navigation

---

### 4. Inline Contextual Help

**Interaction:** Tooltips, hover states, and inline hints explain features without leaving page.

**Why it works:**

- **Self-serve** - Reduces support burden
- **Contextual** - Help appears exactly when needed
- **Non-intrusive** - Doesn't block workflow

---

### 5. Citation-First AI Responses

**Interaction:** Every AI answer includes inline citations `[1]` that show hover tooltips with source law text and clickable links.

**Why it works:**

- **Trust** - Users verify AI isn't hallucinating
- **Learning** - Users discover related law sections organically
- **Legal defensibility** - Answers traceable to official sources

---

## Core Screens and Views

1. **Public Law Pages** - SEO entry point
2. **Dynamic Onboarding Widget** - Conversion engine
3. **Dashboard (Summary View)** - Default landing after login
4. **Law List (Compliance View)** - Primary compliance dashboard with status, responsible person, progress
5. **Legal Document Modal** - Jira-style two-panel deep workspace for law compliance
6. **Task Workspace** - Kanban board with customizable columns + List/Calendar/Summary views
7. **Task Modal** - Jira-style two-panel for task details and evidence
8. **AI Chat Sidebar** - Always accessible
9. **Individual Law Page** - Deep dive with tabs (public)
10. **HR Module - Employee List** - Table/card views
11. **HR Module - Employee Profile** - 4 tabs
12. **Law List - Changes Tab** - Review unacknowledged changes
13. **Workspace Settings** - Configuration

---

## Accessibility

**Target Level:** WCAG AA (for MVP)

**Key requirements:**

- Keyboard navigation for all interactive elements
- Screen reader compatibility (semantic HTML, ARIA labels)
- Color contrast ratios ≥4.5:1 for normal text
- Focus indicators on all focusable elements
- Alt text for images, icons

**Post-MVP:** WCAG AAA for public sector customers

---

## Branding

**Design Philosophy:** Minimalist, OpenAI-inspired, light mode default

**Visual Direction:**

- **Inspiration:** OpenAI's ChatGPT interface - clean, spacious, content-focused
- **Whitespace:** Generous padding, breathing room
- **Simplicity:** Minimal UI elements, hide complexity
- **Light mode default:** Clean white/light gray backgrounds

**Color Palette:**

- **Primary:** Deep blue (#1e40af) - Trust, professionalism
- **Accent:** Bright green (#10b981) - Compliance success
- **Warning:** Amber (#f59e0b)
- **Error:** Red (#ef4444)
- **Background:** White (#ffffff) and subtle gray (#f9fafb)
- **Border:** Light gray (#e5e7eb)
- **Text:** Near-black (#111827)

**Typography:**

- **Sans-serif:** Inter, SF Pro, or system font stack
- **Font weights:** Regular (400), Medium (500), Semibold (600)
- **Monospace:** For SFS numbers and legal citations

**UI Elements:**

- **Rounded corners:** 8px border-radius
- **Shadows:** Subtle shadow-sm and shadow-md
- **Borders:** 1px, light gray, minimal use

**Layout Principles:**

- **Spacious:** 24px-32px gaps between sections
- **Single column primary content:** Focused, centered
- **Max-width content:** ~800px for readability

**Tone of Voice:**

- **Conversational, not bureaucratic**
- **Confident, not preachy**
- **Helpful, not condescending**

**Iconography:**

- **Minimal icon use:** Text-first
- **Style:** Outlined icons (Heroicons, Lucide)
- **Size:** 20px or 24px consistent

**Reference:**

- Primary inspiration: chat.openai.com
- Secondary: linear.app

---

## Design System & Components

### Component Library Approach

**Framework:** shadcn/ui + Tailwind CSS

**Rationale:**

- Pre-built, accessible components
- Minimalist aesthetic matches OpenAI inspiration
- Components copied into codebase (full control)
- Tailwind-native

**Implementation Note:** Full component specifications will be defined in design handoff document. Architects should use shadcn/ui defaults as starting point.

---

### Standardized UI Patterns

**Reusable Components Required:**

- **Buttons:** Primary, Secondary, Ghost, Destructive variants
- **Status Badges:** Compliant (green), Needs Attention (amber), Non-Compliant (red)
- **Cards:** Law cards, Employee cards, Task cards (all draggable)
- **Form Inputs:** Text, Textarea, Select (consistent styling)

**Color System:**

- Define Tailwind config with custom tokens
- Ensures consistent colors across all components

**Typography Scale:**

- Semantic heading levels (H1-H4)
- Body text sizes (large/default/small)

**Spacing System:**

- Use Tailwind's spacing scale consistently
- Generous whitespace (OpenAI-inspired)

---

### Design Handoff Requirements

**Architects will receive:**

1. Component library specification
2. Color token definitions for Tailwind config
3. Typography scale and usage guidelines
4. Icon library selection
5. Animation/transition standards

---

## Target Device and Platforms

**Primary Target:** Web Responsive (Desktop + Tablet + Mobile)

**Breakpoints:**

- **Desktop:** 1280px+ (primary target)
- **Tablet:** 768px-1279px
- **Mobile:** 320px-767px

**Platform priorities:**

1. Desktop Chrome/Edge (70% of B2B users)
2. Desktop Safari (Mac users)
3. Mobile Safari (iPhone)
4. Mobile Chrome (Android)

**NOT in MVP:**

- Native mobile apps
- Desktop apps
- Browser extensions

**Progressive Web App (PWA):**

- Add to homescreen capability
- Offline mode for law pages
- Push notifications (post-MVP)

---
