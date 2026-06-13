# Riskbedömning (risk assessment)

A riskbedömning identifies hazards, grades their risk and decides what must be
done. Its core is the risk matrix table — prose alone is never a riskbedömning.

## Structure

1. **Inledning** — what is being assessed (verksamhet/arbetsmoment/förändring),
   when, and by whom (roles, including skyddsombud/medarbetarmedverkan).
2. **Metod** — how sannolikhet and konsekvens are graded (e.g. 1–3 scales) and how
   risknivå follows from them.
3. **Riskmatris** — REQUIRED `table` node. Columns: **Riskkälla** | **Sannolikhet**
   | **Konsekvens** | **Risknivå** | **Åtgärd** — these FIVE, in this order. One
   row per identified hazard. Keep to these five so the table fits an A4-sida; put
   any motivering in the Åtgärd cell, not in extra columns.
4. **Handlingsplan/uppföljning** — how identified åtgärder are carried over to a
   handlingsplan, and when the assessment is reviewed (vid förändring + minst
   årligen) [Källa-cite the SAM ground: systematiskt arbetsmiljöarbete].

## Style

- Factual, assessing voice: "risken bedöms som hög eftersom…".
- Each riskkälla named concretely ("truckkörning på lagret", not "fordon").
- Gradings justified, not just stated.

## Criteria

- **MUST contain a riskmatris as a `table` node** with riskkälla/sannolikhet/
  konsekvens columns — the quality gate rejects a riskbedömning without a table.
- Every row with risknivå Hög has an åtgärd (or an explicit motivated acceptance).
- Method section explains the grading scale used in the matrix.
- Medarbetarmedverkan (who participated) is recorded.
