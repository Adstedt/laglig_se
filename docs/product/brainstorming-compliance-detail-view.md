# Brainstorming Session Results: Compliance Detail View

**Session Date:** 2026-01-29
**Facilitator:** Business Analyst Mary
**Participant:** Product Owner

---

## Executive Summary

**Topic:** Law List Compliance Detail View — A second view mode for law list pages

**Session Goals:** Design an innovative, low cognitive load UX that surfaces compliance details ("Hur påverkar denna lag oss?" and "Hur efterlever vi kraven?") directly in the list view without requiring modal access.

**Techniques Used:**

1. Role Playing (User Personas)
2. Analogical Thinking (UX Pattern Exploration)
3. Assumption Reversal
4. SCAMPER Method

**Total Ideas Generated:** 15+

### Key Themes Identified:

- Clear separation between "Status View" (workflow) and "Compliance View" (substance)
- Read-first interaction model — editing happens in modal
- Hover tooltips as primary quick-access method
- Optional inline expansion for users who prefer persistent reading
- Visual consistency with existing law list structure
- Low cognitive load through fixed row heights and truncation

---

## Technique Sessions

### Role Playing — 15 min

**Description:** Explored the feature from the perspective of a Compliance Officer preparing for an audit.

**Ideas Generated:**

1. View 1 (existing) focuses on "what and who" — documents, priorities, statuses, responsible persons
2. View 2 (new) focuses on "why and how" — business impact and compliance actions
3. Users need to scan 50+ laws quickly without opening modals
4. Two key fields: "Hur påverkar denna lag oss?" (demands/impact) and "Hur efterlever vi kraven?" (actions taken)
5. Both fields share equal visual hierarchy — equally important for audit prep

**Insights Discovered:**

- The modal is for "deep work" — the list view should be for scanning and understanding
- Users want to scroll through the list and see compliance substance at a glance
- The new view should complement, not replace, the existing status view

**Notable Connections:**

- Pattern A (Hover Preview) best serves the "quick scanning" use case
- Read-first approach aligns with existing modal editing infrastructure

---

### Analogical Thinking — 20 min

**Description:** Explored UX patterns from other products that handle variable-length content in list views.

**Ideas Generated:**

1. Email clients (Gmail/Outlook): Fixed-height rows, truncated preview, hover for more
2. Notion databases: Cell truncation with hover tooltips, click opens full page
3. GitHub Issues: Title prominent, metadata secondary, description preview below
4. Accordion pattern (existing in app): Chevron expand/collapse familiar to users

**Insights Discovered:**

- Fixed row heights create scannable visual rhythm
- Hover tooltips provide instant access without layout disruption
- Chevron expand pattern is already familiar from group accordions
- Competitors fail due to random column widths and visual clutter

**Notable Connections:**

- Notion databases are closest analog to desired functionality
- Existing accordion chevron pattern can be repurposed for row expansion

---

### Assumption Reversal — 10 min

**Description:** Challenged core assumptions to validate design decisions.

**Assumptions Tested:**

| Assumption                   | Reversal Question                  | Outcome                                          |
| ---------------------------- | ---------------------------------- | ------------------------------------------------ |
| Two separate views needed    | Could we combine into one view?    | Keep separate — will gather user feedback        |
| Both fields equal importance | Is one more valuable?              | Keep equal — both columns visible                |
| Show all laws equally        | Should we filter to problems only? | Keep all — smart filtering is future enhancement |

**Insights Discovered:**

- View separation provides mental focus — different modes for different tasks
- Smart "problem-first" filtering identified as future opportunity
- Current approach is solid foundation for user feedback iteration

---

### SCAMPER Method — 15 min

**Description:** Systematically refined the design through structured questions.

**Ideas Generated:**

| Letter           | Question                            | Exploration                                          | Decision                 |
| ---------------- | ----------------------------------- | ---------------------------------------------------- | ------------------------ |
| **S** Substitute | Tabbed cell instead of two columns? | Would reduce width but add interaction complexity    | Keep two columns         |
| **C** Combine    | Add fill indicators (●/○)?          | "Lägg till →" already serves this purpose            | No additional indicators |
| **E** Eliminate  | Hide metadata in View 2?            | Status/Priority/Responsible provide valuable context | Keep all metadata        |
| **R** Rearrange  | Move text fields to end?            | Original order (text in middle) feels natural        | Keep original order      |

**Insights Discovered:**

- Design held up well under scrutiny — no major changes needed
- Compact badges (not full text) for Status/Priority/Responsible in View 2
- Original column order provides best reading flow

---

## Idea Categorization

### Immediate Opportunities

_Ideas ready to implement now_

1. **Compliance Detail View (View 2)**
   - Description: Second view mode showing "Hur påverkar..." and "Hur efterlever..." columns
   - Why immediate: Core feature request, clear specification defined
   - Resources needed: Frontend development, database fields exist

2. **Hover Tooltip Preview**
   - Description: Hover on truncated text shows full content with metadata and author
   - Why immediate: Standard UI pattern, low complexity
   - Resources needed: Tooltip component enhancement

3. **Row Expansion with Chevron**
   - Description: Chevron icon (⌄) allows inline row expansion for persistent reading
   - Why immediate: Reuses existing accordion pattern
   - Resources needed: Minor component adaptation

4. **"Hur efterlever vi kraven?" Modal Accordion**
   - Description: New accordion section in legal document modal
   - Why immediate: Extends existing modal structure
   - Resources needed: New accordion component, database field

5. **Column Header Tooltips**
   - Description: Explanatory tooltips for "Hur påverkar..." and "Hur efterlever..." columns
   - Why immediate: Follows existing pattern (efterlevnad/prioritet tooltips)
   - Resources needed: Copy writing, tooltip implementation

### Future Innovations

_Ideas requiring development/research_

1. **Smart Filtering ("Problem-First" View)**
   - Description: Default filter showing only laws with empty compliance fields or non-compliant status
   - Development needed: Filter logic, UX for toggling between "all" and "problems"
   - Timeline estimate: After initial user feedback on View 2

2. **Density Toggle**
   - Description: Compact → Comfortable → Expanded view density options
   - Development needed: Responsive row height system
   - Timeline estimate: Based on user feedback requests

### Insights & Learnings

_Key realizations from the session_

- **Read-first principle**: The compliance view is for understanding, not editing — keeps cognitive load low
- **Familiar patterns win**: Reusing chevron accordion pattern reduces learning curve
- **Competitor failures guide us**: Avoiding random column widths and visual clutter is critical differentiator
- **View separation is valuable**: Different mental modes for different tasks (workflow vs. substance)

---

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Compliance Detail View (View 2)

- **Rationale:** Core feature that addresses the primary user need — surfacing compliance substance without modal access
- **Next steps:**
  1. Create technical specification from this document
  2. Design mockups/wireframes
  3. Implement view toggle in toolbar
  4. Build column components with truncation
- **Resources needed:** Frontend developer, designer review
- **Timeline:** Primary deliverable

#### #2 Priority: Hover Tooltip with Metadata

- **Rationale:** Essential interaction for the truncation strategy to work — users need access to full content
- **Next steps:**
  1. Design tooltip component with header, content, metadata, author
  2. Implement hover trigger with appropriate delay
  3. Handle edge cases (empty content, long content)
- **Resources needed:** Frontend developer
- **Timeline:** Implement alongside View 2

#### #3 Priority: Modal Accordion for "Hur efterlever vi kraven?"

- **Rationale:** Ensures consistency — field must be editable somewhere, modal is the editing location
- **Next steps:**
  1. Add new accordion section to legal document modal
  2. Position after "Hur påverkar denna lag oss?" (Business Context)
  3. Implement editor with same patterns as existing fields
- **Resources needed:** Frontend developer, database schema update if needed
- **Timeline:** Implement alongside View 2

---

## Feature Specification

### View Toggle

- Location: Toolbar (alongside existing Card/Table toggle)
- Labels: "Status" (View 1) | "Efterlevnad" (View 2)
- Persistence: Remember user preference

### Column Structure (View 2)

| Column                      | Content                 | Width    | Truncation | Hover                        | Notes          |
| --------------------------- | ----------------------- | -------- | ---------- | ---------------------------- | -------------- |
| Dokument                    | Law identifier/title    | Auto     | —          | —                            | Links to modal |
| Hur påverkar denna lag oss? | Business impact text    | Flexible | 2 lines    | Full text + updated + author | Core field     |
| Hur efterlever vi kraven?   | Compliance actions text | Flexible | 2 lines    | Full text + updated + author | Core field     |
| Status                      | Compliance badge        | Compact  | —          | Existing tooltip             | Same as View 1 |
| Prioritet                   | Priority badge          | Compact  | —          | Existing tooltip             | Same as View 1 |
| Ansvarig                    | Avatar                  | Compact  | —          | Name tooltip                 | Same as View 1 |
| Expand                      | Chevron (⌄/⌃)           | Icon     | —          | —                            | View 2 only    |

### Hover Tooltip Structure

```
┌─────────────────────────────────────┐
│ Hur påverkar denna lag oss?         │  ← Header
│ ─────────────────────────────────── │
│ [Full text content...]              │  ← Body
│                                     │
│ Senast uppdaterad: 2026-01-15       │  ← Metadata
│ Av: Anna Svensson                   │  ← Author
└─────────────────────────────────────┘
```

### Expanded Row Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Miljöbalken 3 kap.                                          ⌃   │
├─────────────────────────────────────────────────────────────────┤
│ Hur påverkar denna lag oss?                                     │
│ [Full text with comfortable line height and reading width...]   │
│ Senast uppdaterad: 2026-01-15 · Av: Anna Svensson              │
├─────────────────────────────────────────────────────────────────┤
│ Hur efterlever vi kraven?                                       │
│ [Full text with comfortable line height and reading width...]   │
│ Senast uppdaterad: 2026-01-20 · Av: Johan Lindberg             │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Matrix

| Action              | View 1     | View 2                         |
| ------------------- | ---------- | ------------------------------ |
| Hover on text cell  | N/A        | Tooltip with full content      |
| Click chevron       | N/A        | Expand/collapse row inline     |
| Click row           | Open modal | Open modal                     |
| Click "Lägg till →" | N/A        | Open modal with editor focused |

### Empty State Logic

| Compliance Status  | "Hur påverkar..." | "Hur efterlever..." |
| ------------------ | ----------------- | ------------------- |
| Ej tillämplig      | `—`               | `—`                 |
| Any other (empty)  | `Lägg till →`     | `Lägg till →`       |
| Any other (filled) | Truncated text    | Truncated text      |

### Structural Requirements

- Same group accordion structure as View 1
- Same group headers with compliance indicators (Story 6.17)
- Same drag-and-drop behavior within groups
- Same filtering and search functionality
- Chevron column only visible in View 2

---

## Reflection & Follow-up

### What Worked Well

- Role Playing quickly clarified the core value proposition (substance vs. status)
- Analogical Thinking grounded decisions in proven UX patterns
- SCAMPER validated the design held up under systematic questioning
- Clear decision-making kept session focused and productive

### Areas for Further Exploration

- **User testing**: Validate hover vs. expand preference with real users
- **Mobile/tablet**: How does this view work on smaller screens?
- **Keyboard navigation**: Ensure accessibility for non-mouse users
- **Performance**: Tooltip rendering with many rows visible

### Recommended Follow-up Techniques

- **User interviews**: Validate assumptions with compliance officers
- **A/B testing**: Compare hover-only vs. hover+expand after launch
- **Card sorting**: Validate column order preference with users

### Questions That Emerged

- Should "Lägg till →" have different styling to stand out as actionable?
- What's the ideal tooltip delay (instant vs. 200-500ms)?
- Should expanded rows collapse when another row is expanded?
- How to handle very long compliance text in expanded view (max height + scroll)?

### Next Session Planning

- **Suggested topics:** Visual design mockups, mobile responsiveness, accessibility review
- **Recommended timeframe:** After initial implementation prototype
- **Preparation needed:** Working prototype of View 2 for user testing

---

_Session facilitated using the BMAD-METHOD brainstorming framework_
