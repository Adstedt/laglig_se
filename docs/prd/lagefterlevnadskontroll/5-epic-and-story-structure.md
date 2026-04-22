# 5. Epic and Story Structure

## 5.1 Epic Approach

**Epic Structure Decision:** Single epic (Epic 21 — Lagefterlevnadskontroll MVP) for the brownfield enhancement, with stories sized for AI-agent execution (≤1 day each) and sequenced to minimise risk to the existing system. Rationale:

- Phases 1–3 from the brief (cycle lifecycle, findings, seal) form a coherent, atomic feature — none ships independently in a useful form. Splitting across multiple epics would create artificial boundaries.
- Phases 4–6 (AI-assisted bedömning, continuous mode, CSRD/mobile) are substantive new work streams that belong in their own future epics (Epic 22+) because each has distinct user value, distinct technical surface, and distinct go-to-market implications.
- Single-epic framing keeps the PO/SM/Dev handoff tight and gives the customer a single sealable ship-point.

**Integration Strategy:** Additive-only schema, no destructive changes to existing models or UI; cycle routes and components live in their own namespace (`/laglistor/kontroller`, `components/features/compliance-audit/`) and never replace existing surfaces. Every story ends with an Integration Verification step confirming the `/laglistor`, `/laglistor` modal, task system, activity feed, and permission matrix remain fully functional.

---
