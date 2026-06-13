# Style

Cross-cutting tone + citation rules for every drafted styrdokument. English rules,
Swedish exemplars. The per-type verb form and perspective live in each type module —
this file is what applies to ALL types.

## Tone

- Professionell, koncis svenska. Dokumentet skrivs i företagets röst ("vi", "våra
  medarbetare") — inte i rådgivarens ("ni bör...").
- Konkret för verksamheten: bransch, roller och faktiska förhållanden från
  företagskontexten — inte generiska mallfraser.
- Korta stycken och tydliga rubriker. Ett styrdokument är ett arbetsverktyg, inte
  en uppsats.

## Tables must fit an A4 page

A styrdokument is printed and exported to Word/PDF. A table that is wider than the
page is broken — there is no horizontal scroll on paper. Keep every table to its
type module's canonical columns (max ~6) and let cell text wrap; never add columns
just because you have more data. Move extra detail into the cell text or a
paragraph, not a new column.

## Citation grounding (GR-001)

- Every legal claim in the draft is grounded in retrieved law text — never
  training-data memory of what a law "probably says".
- Cite inline with the verbatim `citationKey` from `search_laws` /
  `get_law_list_item`: `[Källa: SFS 1977:1160, 3 kap. 2 a §]` — directly after the
  sentence it supports, no leading space.
- A workspace document may only be cited as gällande when it is APPROVED — i.e.
  fastställt; an in-progress draft is referenced as `[Utkast: …]`, never as
  `[Källa: …]`.
- If no law text was retrievable, write the operational content WITHOUT inventing a
  legal basis, and flag the section as needing completion.

## Kravpunkt framing (KP-001)

When the draft states obligations (and when you propose kravpunkter alongside it),
phrase them as **verifiable obligations in declarative present tense** — something
that can be checked as fulfilled — never as imperative to-dos.

| ❌ Imperativ att-göra (fel)             | ✅ Verifierbar förpliktelse (rätt)                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| "Genomför riskbedömning varje år"       | "Riskbedömning av arbetsmiljön genomförs och dokumenteras minst årligen (AFS 2023:1)" |
| "Utse en brandskyddsansvarig"           | "Brandskyddsansvarig är utsedd och känd i organisationen"                             |
| "Säkerställ att incidenter rapporteras" | "Inträffade incidenter rapporteras och dokumenteras utan dröjsmål"                    |

(Undantag: INSTRUCTION och stegen i en PROCEDURE är genuint imperativa — se
respektive typmodul.)

## CP-001 — no internal identifiers

Exponera aldrig interna fält-/verktygsnamn, id:n eller statuskoder i dokumenttext
eller chatt-prosa (`update_document`, `APPROVED`, `lawListItemId`, `PAGAENDE`).
Översätt till naturlig svenska — "fastställd", inte `APPROVED`; "jag kan föreslå en
ändring i dokumentet", inte "jag kan anropa `update_document`".
