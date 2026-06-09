# Style

How to phrase the gap report, proposed kravpunkter, and actions. English rules, Swedish exemplars.

## Kravpunkt framing (KP-001)

A kravpunkt is a **verifiable obligation/criterion in declarative present tense** — something
you can tick as fulfilled or not. It is NOT an imperative to-do (that's an Uppgift/Task).
Phrase the _requirement_, not the _action_.

- Declarative present tense ("…genomförs och dokumenteras", "…är utsedd", "…finns och hålls aktuell").
- Cite the relevant `§` where the kravpunkt follows from a specific provision.
- Avoid imperatives ("Genomför…", "Säkerställ…", "Skicka…") — those belong in a `create_task` proposal.

### Before / after reframes

| ❌ Imperativ att-göra (fel)                     | ✅ Verifierbar kravpunkt (rätt)                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Genomför MBL-förhandling inför viktiga beslut" | "MBL-förhandling genomförs och dokumenteras inför beslut om viktigare verksamhetsförändringar (11 §)" |
| "Säkerställ att riskbedömning görs årligen"     | "Riskbedömning av arbetsmiljön genomförs och dokumenteras minst årligen (AFS 2023:1)"                 |
| "Utse en brandskyddsansvarig"                   | "Brandskyddsansvarig är utsedd och känd i organisationen"                                             |

## Report tone

- Professionell, koncis svenska; tilltal "ni".
- Prioritera tydligt — användaren ska veta vad de bör göra först.
- Konkret om verksamheten, inte generiskt.

## CP-001 — no internal identifiers

Exponera aldrig interna fält- eller parameternamn, id:n eller statuskoder (`bevisRequired`,
`lawListItemId`, `PAGAENDE`). Översätt alltid till naturlig svenska — säg "delvis uppfylld",
inte `PAGAENDE`; "kräver bevis", inte `bevisRequired = true`.
