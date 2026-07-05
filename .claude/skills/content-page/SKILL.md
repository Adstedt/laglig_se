---
name: content-page
description: Author and validate a Laglig.se marketing/content page (an /omraden, /branscher, /funktioner, /jamfor or /ordbok page in content/marketing/*.mdx) end to end — Semrush keyword+intent+SERP research, the guide→product structure, MDX writing to the typed frontmatter contract, legal-fact verification against the catalog, and SEO/GEO validation. Use whenever the user wants to create, rewrite, research, or SEO-validate a marketing content page, add a page to Epic 26, or write a page brief. Not for app/product UI (use frontend-design) or for law-catalog pages under /lagar.
---

# Writing Laglig.se content pages

This skill runs the **Epic 26 content pipeline**: research a page with Semrush, structure it around the search intent AND the buyer mental model, write it as MDX against the typed contract, verify every legal fact against the catalog, and validate SEO + GEO before it ships. It exists so a new page is _editorial work, not engineering_ — and so quality never regresses below the bar set by the ~120 pages already shipped.

The reference files hold the detail. **Read the one you need at each step — do not hold all four in context at once.**

- `references/semrush-playbook.md` — the exact Semrush workflow (reports, db=se, how data overrides the brief, redirect rules).
- `references/mdx-contract.md` — frontmatter schema, which sections are auto-rendered vs. body-authored, the component vocabulary, worked example.
- `references/seo-geo-checklist.md` — SEO + GEO best practices, Swedish copy rules, the pre-publish gates.
- `references/brief-and-validation.md` — brief structure and the `## Semrush-validering` block appended at the end.

## When you're invoked

First establish **which page** and **which cluster**. The five template kinds and their intents:

| Kind         | Route                | Intent it owns                                            | Primary keyword shape                                |
| ------------ | -------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| `omraden`    | `/omraden/[slug]`    | Law/topic explainer — "vad är X / krav / sammanfattning"  | the law/standard name (miljöbalken, NIS2, ISO 14001) |
| `branscher`  | `/branscher/[slug]`  | "vilka lagar gäller för [bransch]" / "laglista [bransch]" | `laglista X` / `lagefterlevnad X`                    |
| `funktioner` | `/funktioner/[slug]` | Feature/capability + the ISO vocabulary                   | e.g. `lagefterlevnadskontroll`, `AI-lagbevakning`    |
| `jamfor`     | `/jamfor/[slug]`     | Branded-competitor + buying-stage                         | `Notisum alternativ`, `laglista Excel`               |
| `ordbok`     | `/ordbok/[term]`     | Glossary / definition long-tail                           | the term itself                                      |

If a brief already exists in `docs/prd/epic-26-content-briefs/{kind}/[slug].md`, start from it — but **Semrush data overrides the brief** wherever they conflict. If no brief exists, you produce one as part of the run (see `brief-and-validation.md`).

Check `docs/prd/epic-26-content-briefs/README.md` for status (what's shipped, the wave table) and `docs/prd/epic-26-marketing-pages-seo-content-engine.md` for the epic frame.

## The pipeline (run in order)

A page is **not done** until every step passes. Steps 1–2 are research, 3–4 are writing, 5–8 are the validation gate.

1. **Semrush-validate** (`db=se`). For the brief's keywords: volume, KD, intent. Then `phrase_related` to find keywords the brief missed, and `phrase_organic` on the primary term to read **what page type the SERP rewards** (free lagtext, myndighetsvägledning, or commercial explainer). The data — not the brief's guesses — drives volume claims, the primary term, and the H2 structure. See `references/semrush-playbook.md`. **Skip only if the user explicitly says research is already done** and points you at a filled `## Semrush-validering` block.

2. **Choose the winnable primary + map secondaries to structure.** Do **not** chase myndighet-owned head terms (Arbetsmiljöverket, IMY, Livsmedelsverket, Boverket own arbetsmiljöplan/GDPR/HACCP/PBL) as the primary — use them as supporting H2/FAQ under a winnable commercial or informational primary. Redirect the primary when the data says so (e.g. brief's term has ~0 volume). Every discovered secondary with real volume becomes an H2, H3, verbatim phrase in prose, or FAQ.

3. **Verify author­itative facts against the catalog** _before_ writing them. Every SFS/celex number, in-force date, "upphävd/ersatt" status, and paragraph reference must be checked against the catalog DB — not written from memory. The pipeline has repeatedly caught real errors this way (upphävda lagar cited as active, wrong SFS numbers). See the verification method in `references/seo-geo-checklist.md`.

4. **Write the MDX** to `content/marketing/{kind}/[slug].mdx`. Match the typed frontmatter contract exactly (build fails on a missing/invalid field) and use only the body components that are actually registered. The template auto-renders the hero, CTAs, catalog list, change feed, FAQ and related grid **from frontmatter** — do not hand-write those in the body. Follow the guide→product structure and the Swedish copy rules. Model the house style on `content/marketing/omraden/miljobalken.mdx`. Full contract in `references/mdx-contract.md`.

5. **Capability check.** No product promises outside `funktioner` pages. Explainer and industry pages describe the law and hand off to the product ("så gör Laglig X hanterbar") without claiming features the product doesn't have.

6. **SEO + GEO gate.** Meta title ≤60 chars, description ~155 (schema hard-caps 170). Answer-first blocks, `faq` min 3 with visible/JSON-LD parity, catalog citations, freshness hooks on 2025/2026 changes, no cannibalization of a sibling page's intent. Full checklist in `references/seo-geo-checklist.md`.

7. **Render + link validation.** All internal links resolve (catalog links match a real `document_number`/slug; `relatedPages` point at pages that exist). Confirm the file type-checks / builds.

8. **Append the `## Semrush-validering` block** to the brief — confirmed primary, discovered keywords + where each landed, downgrades, strategic redirects, catalog fixes. This block is what marks the page _validated_ (per the README). Format in `references/brief-and-validation.md`.

## Non-negotiables (project memory)

- **Swedish copy naturalness** — no stiff derived nouns ("kompletthet(skontroll)"); use adjectives / "uppgifter saknas". Read every line aloud as an HR/KMA user would. (See seo-geo-checklist for the full ban list.)
- **Palette** — landing-v3 is near-monochrome warm ink + grays on cream with ONE sparing amber accent. No sage/clay as foreground accents. You rarely touch color in MDX, but any inline styling respects this.
- **Typography** — Safiro (`font-safiro`, `font-medium`, never faux-bold) for titles/section labels; Google Sans Flex for content. The MDX component map already enforces this; don't override it.
- **Almåsa is not referenceable** in marketing copy — real company used only for an internal demo workspace.
- **Guide→product bridge** — no editorial H2 on a bransch/funktioner page without a product hand-off in or right after it. Explainer (`omraden`) pages hand off more softly but still end in "så gör Laglig …" + catalog list + org-check.

## Doing the work at scale

One page is a linear run. A **wave** of pages (as in the README's wave table) parallelizes well: research is independent per page, so fan out Semrush validation across pages, then write. If the user asks for a batch and opts into orchestration, a Workflow with a research→write→validate pipeline per page fits — but a single page does not need it.
