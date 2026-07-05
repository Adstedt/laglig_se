# SEO + GEO checklist & the pre-publish gate

Run this before considering a page done. SEO = rank in Google. GEO = get cited by AI answer engines. Laglig's pages are built to win both, plus one thing competitors can't fake: the free law catalog underneath.

## Legal-fact verification (do this BEFORE writing the fact)

Every author­itative claim gets checked against the catalog — never written from memory. The pipeline has repeatedly caught real errors: _elsäkerhetslagen has no sanktionsavgifter_; _alkohollagen's mat-krav (8 kap. 15 §) was repealed by 2026:511_; _MKB-förordningen 1998:905 upphävd → miljöbedömningsförordningen 2017:966_; _gamla LEK 2003:389 → 2022:482_.

Verify: **every SFS/celex number, in-force date, "upphävd/ersatt" status, paragraph reference, sanction type, and amount.**

How:

- Resolve law numbers against the catalog the same way the site does — `lib/marketing/catalog-link.ts` matches `document_number`/slug to `LegalDocument` Prisma rows. A `documentNumber` that renders as plain text (logs `[CATALOG_LINK_UNMATCHED]`) is either wrong or not ingested — investigate, don't ship it.
- For the lagtext itself, check the catalog DB / the `/lagar/[slug]` route the link points to. If a law you cite isn't in the catalog, note it as an **ingestion candidate** (the semrush-keyword-report lists a running set) rather than inventing a route.
- Swedish legal notation throughout: `2 kap. 3 §`, `SFS 1998:808`, `(EG) nr 1907/2006`.

## SEO gate

- **Title** ≤60 chars, front-loads the primary term, written for the click (root layout appends `| Laglig.se`).
- **Meta description** ~155 chars (hard cap 170), contains the primary term + the payoff + a soft CTA ("Börja med ert org.nr.").
- **H1** (`heroTitle`) contains/disambiguates the primary term; may differ from the meta title.
- **One intent per page** — no cannibalization of a sibling, the hub, or the `/lagar/*` lawtext page. Explainer owns "vad är/krav/sammanfattning"; catalog owns "läs lagtexten"; hub owns the overview.
- **Keyword placement** — primary in title, H1, first 100 words, one H2; each real secondary in an H2/H3/prose/FAQ slot (from the Semrush pass).
- **Internal links** — link out to 2–4 related `/omraden`, `/funktioner`, `/branscher` pages in prose (beyond the auto RelatedPagesGrid) and into `/lagar/*` for cited laws. Bidirectional catalog linking is the core authority play.
- **Canonical** is auto (`${NEXT_PUBLIC_BASE_URL}/{kind}/{slug}`); don't fight it. Pages auto-register in the sitemap (the generator walks `content/marketing/`), so no manual sitemap edit.
- **Lighthouse SEO ≥ 90** is the template's quality bar — mostly handled by the template, but broken links / missing alt / thin content drop it.

## GEO gate (get cited by AI answer engines)

- **Answer-first.** The `<DefinitionBox>` under the first H2 must answer "vad är X?" in a self-contained, quotable 2–3 sentences with a `source` line. AI engines lift these.
- **Structured, enumerable facts.** Use `<ProcessSteps>` / lists / tables for principles, thresholds, A/B/C-levels — each item named and statute-cited. Machine-parseable beats prose for facts.
- **FAQPage JSON-LD** (auto from `faq`, min 3). Questions phrased as real user queries; answers self-contained (don't require the surrounding page). This is the primary GEO surface — comprehension + citability, not rich-result chips (Google restricted those since 2023).
- **Freshness hooks.** Name the specific 2025/2026 regulatory changes for the topic (new SFS numbers, in-force dates, repealed provisions). This is where thin competitor blogs are stale and where the live `<ChangeFeedEmbed>` reinforces the signal.
- **Cite primary sources.** Every substantive claim ties to a named författning linked into the catalog. Answer engines prefer sourced content; the catalog link is verifiable ground truth.
- **Cover the unmeasurable questions.** The long-tail/AI questions that measure ~0 in Semrush still belong as FAQ/H3 — they're exactly what someone asks an assistant.

## Swedish copy rules (non-negotiable)

- **Banned:** stiff derived nouns like _kompletthet_, _kompletthetskontroll_, and similar bureaucratic nominalizations. Use adjectives or plain phrasings — _"uppgifter saknas"_, not _"ofullständighet"_. For missing data show _"Ej ifylld"_.
- **Read every line aloud as an HR/KMA user would.** If it sounds like a translated compliance brochure, rewrite it. Warm, direct, competent — not salesy, not academic.
- **Capability discipline** — no product promises outside `funktioner` pages. On explainer/industry pages the product appears only as "så gör Laglig X hanterbar" hand-offs describing features that actually exist.
- **Almåsa is never named** in marketing copy.
- Typography/palette are enforced by the component map (Safiro `font-medium` titles, GSF body, cream + one amber accent) — don't override with inline styles.

## Final render/link pass

- File type-checks / builds (frontmatter validates, MDX parses, only registered components used).
- All `relatedCatalogLaws` match (no `[CATALOG_LINK_UNMATCHED]`); all `relatedPages` resolve; all prose links valid.
- Images exist at their `src` paths (or are flagged for generation) with real `alt`.
- Word count meets the target (~1100 for omraden; ≥1000 for funktioner/branscher).
- Then append the `## Semrush-validering` block to the brief (see `brief-and-validation.md`) — that's what marks the page validated.
