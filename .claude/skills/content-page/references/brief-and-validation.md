# Brief structure & the Semrush-validering block

Each page has a brief at `docs/prd/epic-26-content-briefs/{kind}/[slug].md`. The brief is the plan; the MDX is the build; the `## Semrush-validering` block appended to the brief is the proof-of-validation. Per the README, **a page counts as done only when its MDX exists AND its brief carries a `## Semrush-validering` block.**

Model any new brief on `docs/prd/epic-26-content-briefs/omraden/miljobalken.md`.

## Brief skeleton

```markdown
# Innehållsbrief — <Title>

- **Route:** /{kind}/[slug]
- **Cluster / template:** {kind} (<lagförklaring | bransch | funktion>) / <TemplateName>
- **Sökintention:** informational | commercial | navigational (+ mix)
- **Ordmål:** ~1100

## Nyckelord

- **Primärt:** <winnable primary — post-Semrush>
- **Sekundärt:** <secondaries with real volume>
- **Long-tail:** <8–10 real search questions (FAQ/heading fuel)>

## SEO-meta

- **Meta-titel (<=60 tecken):** …
- **Meta-beskrivning (~155 tecken):** …
- **H1:** …

## Produktvinkel (hook)

<how Laglig.se solves the intent — the guide→product bridge in one paragraph>

## Sidstruktur (H2/H3)

<numbered H2s, each tagged with its component (DefinitionBox / ProcessSteps / SplitFeature …)
and — for bransch/funktioner — its product hand-off>

## Kataloglänkar (CatalogLawList)

<the laws, with [bekräfta i katalogen] on any number you haven't verified yet>

## FAQ (3–5, formulerade som riktiga sökfrågor)

<question → answer hint>

## Interna länkar (relatedPages)

<paths to sibling omraden/funktioner/branscher + relevant /lagar/\*>

## Bildmaterial

<screenshots to stage + people-photo prompts (Scandinavian realism, cream grade, flawless depicted compliance)>

## Källor (grundning)

<riksdagen/SFS, myndighet guidance, EUR-Lex, the catalog>

## Anmärkningar

<anti-cannibalization boundaries; [bekräfta] items to verify before publish>
```

## The `## Semrush-validering` block (appended last)

This is the deliverable that closes the loop. Write it from the three Semrush passes (see `semrush-playbook.md`). Exemplar (miljöbalken):

```markdown
## Semrush-validering (YYYY-MM-DD, db=se)

- **Bekräftat primärt:** miljöbalken — 9 900/mån, KD 32, informational. Vinnbar svårighet.
- **Upptäckta keywords (ej i brief):** förordning om miljöfarlig verksamhet och hälsoskydd (720, KD 18 → exakt fras i brödtext + kataloglista); försiktighetsprincipen (590, KD 19 → namngivet ProcessSteps-steg); miljöbalken 7 kap (170, KD 14 → 7 kap.-H3 tillagd); hänsynsreglerna i miljöbalken (110, KD 14 → H2 verbatim).
- **Nedgraderade:** briefens long-tails har ~0 volym utom "vad är miljöbalken" (110, KD 23 → första H2). Övriga används endast som FAQ-formuleringar.
- **Strategibeslut:** "miljölagstiftning" (110, KD 12) lämnas till /omraden/miljo (kannibalisering). Katalogfynd: förordning (1998:905) om MKB är UPPHÄVD → miljöbedömningsförordningen (2017:966); REACH = 32006R1907, CLP = 32008R1272.
```

Required lines:

- **Bekräftat primärt** — primary term, measured volume, KD, intent, one-line winnability verdict.
- **Upptäckta keywords (ej i brief)** — each discovered term with volume/KD and _where it landed in the page_ (which H2/H3/phrase/FAQ). This is the audit trail that the Semrush pass actually changed the page.
- **Nedgraderade** — brief terms that measured ~0 and were demoted to FAQ phrasing only.
- **Strategibeslut** — redirects (primary swaps), anti-cannibalization boundaries, and **catalog fixes** (wrong/repealed numbers found during fact-verification, correct celex/SFS).

Also record catalog fixes that need engineering follow-up (ACTIVE-but-repealed rows, wrong titles, ingestion-candidate laws the page wants but the catalog lacks) — these roll up into `docs/prd/epic-26-content-briefs/semrush-keyword-report.md`.

## Status hygiene

When a page ships, reflect it in `docs/prd/epic-26-content-briefs/README.md` (the wave/status tables) so the inventory stays accurate. For a wave, update the wave row; for a single page, ensure its row and the cluster count are right.
