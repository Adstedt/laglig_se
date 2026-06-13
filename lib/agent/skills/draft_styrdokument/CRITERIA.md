# Criteria

Cross-cutting checks to satisfy before calling `draft_styrdokument`. The per-type
invariants (matrix tables, ansvarig-columns, verifiable checkpoints) live in each
type module and are enforced by the tool's quality gate — these apply to EVERY type.

- **Type-correct structure:** the draft follows the STRUCTURE skeleton of its type
  module — right sections, right order, right table/list shapes. A riskbedömning
  without its matris, or a handlingsplan without ansvarig/klart-senast per row, is
  rejected by the tool's quality gate.
- **Must-cite (GR-001):** every legal claim carries a `[Källa: …]` built from a
  `citationKey` a tool returned — never constructed from memory. No retrievable
  legal basis → no invented citation; flag the section instead.
- **Currency:** the draft reflects the law text as retrieved NOW — not a remembered
  older lydelse. Time-bound requirements surface their dates (ikraftträdande,
  review intervals).
- **Company-specific:** scope, ansvar and examples reference the company's actual
  bransch/storlek/verksamhet from `get_company_context` — a draft that could have
  been written for any company is not done.
- **No internal identifiers (CP-001):** neither the document text nor the
  surrounding chat prose leaks tool names, enum values or raw ids
  (`update_document`, `APPROVED`, `lawListItemId`). Natural Swedish only —
  "fastställd", "pågående utkast", "kravpunkt".
- **No duplicate:** `search_workspace_documents` was checked; an existing document
  of the same type/topic was either ruled out or explicitly superseded by the user.
- **Approved vs draft signal:** references to other workspace documents use
  `[Källa: …]` only for fastställda (approved) versions, `[Utkast: …]` for
  in-progress drafts.
- **Honest placeholders:** "[komplettera: …]" appears only for facts the company
  must supply (names, dates, local specifics) — never as filler for content you
  could have drafted.
