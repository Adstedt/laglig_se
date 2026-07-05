# Semrush playbook

The research step. Goal: replace the brief's _guessed_ keywords/volumes with **measured** ones, discover terms the brief missed, and read what page type the SERP actually rewards. Data overrides the brief on every conflict.

## Setup

- **Database: `se`** (Swedish SERP). Always. Never `us` for these pages.
- MCP workflow is **discovery tool → `get_report_schema` → `execute_report`**. Report/column names differ between toolkits, so confirm the schema before calling `execute_report` rather than assuming argument names. Call `execute_report` several times (one per report type, or per keyword batch) and combine.
- `display_limit` 30–50 for exploratory pulls.

## The three passes (per page)

Run all three. This is the method the shipped 49-page omraden cluster used.

1. **Volume/KD/intent on the brief's keywords** — the "phrase / these keywords" report. For the primary + every secondary + long-tail in the brief, pull **monthly volume, Keyword Difficulty (KD 0–100), and intent** (I=informational, C=commercial, N=navigational). This tells you which brief terms are real and which measure ~0.

2. **`phrase_related` — gap exploration.** Feed the primary term (and strong secondaries) into the related-keywords report to surface terms the brief never listed. This is where the wins hide: on miljöbalken it found _försiktighetsprincipen_ (590/KD 19), _förordning om miljöfarlig verksamhet och hälsoskydd_ (720/KD 18), _miljöbalken 7 kap_ (170/KD 14) — each became a named ProcessSteps step, a prose phrase, or a new H3.

3. **`phrase_organic` — SERP structure on the primary term.** Read the top results and classify the dominant page type:
   - **free lagtext** (riksdagen / lagen.nu) → we win by pairing the free catalog lawtext _with_ an explainer (no competitor has both halves).
   - **myndighetsvägledning** (Arbetsmiljöverket, Naturvårdsverket, räddningstjänst) → we win with a practical "hur gör man" structure.
   - **certification bodies / SIS** (ISO terms) → we differentiate with the _lagkrav / bindande krav_ angle.
   - **commercial explainers / competitors** → match depth + add freshness + product hand-off.

   The SERP type dictates page structure. Note it explicitly; it goes in the validation block.

## Turning data into structure

- **Pick a winnable primary.** Prefer commercial/informational terms that map to the product. **Do not** make a myndighet-owned head term the primary (Arbetsmiljöverket owns _arbetsmiljöplan_/_AFS_, IMY owns _GDPR_ rich results, Livsmedelsverket owns _HACCP_, Boverket owns _PBL_). Use those as supporting H2/FAQ under the winnable primary.
- **Redirect the primary when the data demands it.** Real examples from the cluster:
  - `egenkontroll miljö` (20/mån) → broad `egenkontroll` (880) with a multi-regime structure.
  - brief's `eu-taxonomin` primary (~0) → `taxonomin` (1 300) worked into the body, H1 keeps disambiguation.
  - ambiguous acronyms (`SAM`, `AFS`, `DORA`, `REACH`, `LAS`) → full-phrase primary + disambiguated H1 ("DORA-förordningen", "AFS — Arbetsmiljöverkets föreskrifter"), acronym kept as an alias.
  - `iso-45001`: the _certification_ term (3 600/KD 19) was bigger than the base term → certifiering goes in the title + an early process H2.
- **Map every real secondary to a slot** — an H2, H3, a verbatim phrase in prose, or an FAQ question. A high-volume low-KD term (KD ≤ 20 with volume) is a priority: it's where first rankings land. Fold folk spellings in beside the formal term (_säkerhetsblad_ 1 000/KD 19 next to _säkerhetsdatablad_ on REACH).
- **Zero-volume GEO/freshness plays are legitimate** when deliberate: category-creation terms (`AI-lagbevakning`), ICP commercial terms (`lagrevision`), and terms riding a regulatory shift (`maskinförordningen` before the 2027 transition, `ai-act`). Flag them as such — don't silently target a 0-volume primary as if it had traffic.

## Guardrails

- **Anti-cannibalization is a Semrush decision too.** If a term belongs to a sibling page (e.g. `miljölagstiftning` → `/omraden/miljo`, not `/omraden/miljobalken`), leave it there and note the boundary. One intent per page.
- **The long-tail tail is mostly unmeasurable.** The briefs' ~490 long-tail phrases measure ~0 in Semrush — that's expected. They still earn their place as FAQ/heading phrasing and are captured post-deploy via GSC impressions + AI-answer citations. Don't discard a good question just because Semrush shows 0.
- **Position Tracking** — `keywords.txt` in the briefs folder is the import list; the low-KD-with-volume terms are the ones to watch first after deploy.

Everything you find gets written into the brief's `## Semrush-validering` block (see `brief-and-validation.md`).
