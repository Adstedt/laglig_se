# Handlingsplan (action plan)

A handlingsplan turns identified gaps/risks into tracked actions. Its core is the
action table — every row must say WHAT, WHO and BY WHEN.

## Structure

1. **Bakgrund** — what the plan responds to (riskbedömning, revision, lagändring)
   with a reference to that source.
2. **Åtgärdstabell** — REQUIRED `table` node. Columns: **Åtgärd** | **Ansvarig** |
   **Klart senast** | **Status** — these FOUR, in this order. One row per action.
   Do NOT add extra columns (Nr, Riskkälla, Risknivå, Lagstöd) — the table must
   fit an A4-sida; reference the underlying risk or lagstöd inside the Åtgärd text
   or the Bakgrund paragraph, not as its own column.
3. **Uppföljning** — how and when the plan is followed up (möte, intervall, vem).

## Style

- Action rows are concrete and imperative-noun phrased ("Installera fallskydd på
  lastkaj", not "fallskydd bör övervägas").
- Ansvarig is a ROLE (e.g. "Fastighetschef") unless the user named a person.
- Klart senast is a date or a bounded period — never "löpande" for an åtgärd
  (recurring work belongs in a rutin).

## Criteria

- **MUST contain the åtgärdstabell as a `table` node** — the quality gate rejects a
  handlingsplan without a table.
- **Every row has Ansvarig AND Klart senast filled** ("[komplettera: ansvarig]"
  only when the company must name a person).
- Each åtgärd traces to the bakgrund (no orphan actions).
- Status column uses natural Swedish ("Ej påbörjad", "Pågår", "Klar") — never
  internal enum values (CP-001).
