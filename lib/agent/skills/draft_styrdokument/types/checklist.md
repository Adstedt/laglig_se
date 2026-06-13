# Checklista (checklist)

A checklista verifies a state: each point is a yes/no-checkable statement. It is
NOT a to-do list — points verify that something IS done/in place, they do not
instruct.

## Structure

1. **Användning** — what the checklist verifies, when it is used (intervall or
   trigger), who fills it in.
2. **Kontrollpunkter** — REQUIRED structured enumeration: either a `table` node
   (columns **Punkt** | **Utförd (Ja/Nej)** | **Kommentar** — the canonical shape)
   or a `bulletList`/`orderedList` with at least 3 points. Group points under
   sub-headings per area when more than ~10.
3. **Avvikelser** — what happens with a "Nej" (åtgärd, ansvarig, eskalering).
4. **Signering** — datum, utförd av.

## Style

- **Verifiable state phrasing: "är genomförd", "finns", "fungerar", "är fri från".**
  Each point answerable Ja/Nej by observation — no judgement calls baked in.
- One condition per point — "Nödutgångar är skyltade och belysta" is TWO points.

## Criteria

- **MUST contain the kontrollpunkter as a `table` OR a list with ≥3 points** — the
  quality gate rejects a checklista without a structured enumeration.
- Every point is a verifiable state, not an action ("Brandsläckare är kontrollerad
  inom senaste året", never "Kontrollera brandsläckare").
- Avvikelsehantering for "Nej" answers is present.
- Points that verify a legal requirement cite it (GR-001).
