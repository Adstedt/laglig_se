# Chunking Strategy for Legal Document RAG

## Purpose

This document defines how legal documents are broken into chunks for embedding and retrieval in the RAG pipeline. The strategy covers **SFS laws** and **agency regulations** only. Amendments are not chunked — see "Law-First Strategy" decision below.

**Owner:** Story 14.2 (ContentChunk Model & Chunking Pipeline)
**Consumed by:** Story 14.3 (Embedding Generation), Story 14.8 (RAG Retrieval Pipeline), all agent stories

---

## Core Principle

The **paragraf (§)** is the semantic atom of Swedish law. It is the unit lawyers cite ("2 kap. 3 §"), it contains a complete legal provision, and it should remain intact in a single chunk. Splitting below the § level (at stycke/sub-paragraph) fragments legal meaning. Chunking above it (at chapter level) is too coarse for precise retrieval.

---

## Three-Tier Strategy

### Tier 1: Paragraf-Level (Primary)

**Source:** `CanonicalDocumentJson.chapters → paragrafer`

**Rule:** Each `CanonicalParagraf` (§) becomes exactly one chunk, regardless of how many stycken it contains. All stycken text is concatenated into a single `content` string.

**Content assembly:**
1. If the paragraf has a `heading`, include it as the first line
2. Concatenate all `stycken[].text` with newline separators
3. The `content` field on `CanonicalParagraf` already holds this — use it directly
4. `amendedBy` goes into chunk `metadata`, not into content

**Path:** `kap{chapter.number}.§{paragraf.number}`
- Chaptered: `kap2.§3` (Chapter 2, § 3)
- Flat (no chapters): `kap0.§5` (§ 5 in a document with no chapter structure)

**Contextual header:**
- Chaptered: `"Arbetsmiljölagen (SFS 1977:1160) > Kap 2: Arbetsmiljöns beskaffenhet > 3 §"`
- Flat: `"Yrkestrafiklagen (SFS 2012:210) > 5 §"`
- Agency: `"AFS 2023:1 Arbetsplatsens utformning > Kap 3: Ventilation > 15 §"`

**ContentRole:** Use the dominant role from the paragraf's stycken. Typically `STYCKE`. If all stycken share a single role (e.g., all `ALLMANT_RAD` or all `TABLE`), use that role for the chunk.

**Expected token range:** 50–800 tokens per § (median ~200). Rare outliers may reach 1500+ tokens — this is acceptable, do not split.

### Tier 2: Non-§ Content

Content that lives outside the `chapters → paragrafer` hierarchy in the `CanonicalDocumentJson`:

| Source field | Chunk rule | Path | ContentRole | Contextual header suffix |
|---|---|---|---|---|
| `transitionProvisions` | All stycken grouped into one chunk | `overgangsbest` | `TRANSITION_PROVISION` | `> Övergångsbestämmelser` |
| `preamble` | Whole preamble as one chunk | `preamble` | `STYCKE` | `> Inledning` |
| `appendices[N]` | One chunk per appendix | `bilaga.{N}` | `STYCKE` | `> Bilaga {N}` |

**Note:** If transition provisions are very long (>2000 tokens), they may need splitting in a future iteration. For now, keep as one chunk — most are short.

### Tier 3: Markdown Fallback (Paragraph-Merge)

**When triggered:** JSON has 0 paragrafer across all chapters AND no meaningful non-§ content (no transition provisions, preamble, or appendices with content). This typically means the document has a bilaga-style or atypical structure the JSON parser can't handle.

**Why this exists:** ~2,690 SFS_LAW docs (~24%) and ~38 agency regulations have `json_content` with 0 paragrafer. Their canonical HTML lacks `<section class="paragraf">` markers, so the deterministic JSON parser produces empty `paragrafer[]`. This fallback is a **permanent safety net** — future documents may also have structures the parser can't derive § structure from.

**Input:** `markdown_content` (preferred) or `html_content` via `htmlToPlainText()`.

**Algorithm — paragraph-merge:**

```
1. SPLIT at double newlines (\n\n) into raw paragraphs
2. MERGE small adjacent paragraphs:
   - Walk sequentially through raw paragraphs
   - Accumulate into current chunk
   - When current chunk reaches ~300-500 tokens, finalize it and start a new one
   - Never merge across a paragraph that starts with a heading pattern (# or ##)
3. CAP oversized paragraphs:
   - If a single raw paragraph exceeds ~1000 tokens
   - Split at sentence boundaries (". " followed by uppercase letter)
   - If no sentence boundary found, split at single newlines (\n)
4. FILTER:
   - Discard any chunk < 20 characters after trimming
```

**Token thresholds (tunable):**

| Parameter | Value | Rationale |
|---|---|---|
| Merge target | ~300-500 tokens | Balances granularity with embedding quality. Below 100 tokens, embeddings lose semantic signal. |
| Cap threshold | ~1000 tokens | Prevents single oversized chunks. Most embedding models handle up to 8K tokens, but retrieval quality degrades above ~500. |
| Minimum size | 20 chars | Filters out whitespace-only or trivial fragments |

**Path:** `md.chunk{N}` (1-indexed)
**ContentRole:** `MARKDOWN_CHUNK`
**Contextual header:** `"{title} ({documentNumber})"` (no chapter/§ since structure is unknown)

---

## Complete Path Reference

| Document structure | Path | Example header |
|---|---|---|
| Chapter N, § M | `kap{N}.§{M}` | "Title (SFS YYYY:NNN) > Kap N: Chapter Title > M §" |
| Flat doc (no chapters), § M | `kap0.§{M}` | "Title (SFS YYYY:NNN) > M §" |
| Transition provisions | `overgangsbest` | "Title (SFS YYYY:NNN) > Övergångsbestämmelser" |
| Preamble | `preamble` | "Title (SFS YYYY:NNN) > Inledning" |
| Appendix N | `bilaga.{N}` | "Title (SFS YYYY:NNN) > Bilaga N" |
| Markdown fallback chunk N | `md.chunk{N}` | "Title (SFS YYYY:NNN)" |

---

## Contextual Header Design

The contextual header is prepended to chunk content before embedding (Story 14.3). This implements the [Anthropic contextual retrieval pattern](https://www.anthropic.com/news/contextual-retrieval) — the embedding captures both the content AND its position in the document hierarchy.

**Format:** `"{document title} ({document number}) > {chapter} > {paragraf}"`

**Rules:**
- Always include document title and number
- Include chapter part only if the document has chapters (omit for flat docs)
- Include § number for paragraf chunks
- Use `>` as separator
- Keep it concise — this is prepended to content, so every token counts

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-02-24 | § as chunk unit (not stycke) | The § is the semantic atom of Swedish law — what lawyers cite, what contains a complete provision. Stycke-level fragments meaning. |
| 2026-02-24 | Paragraph-merge for markdown fallback | Naive `\n\n` splitting produces too many tiny chunks (one-line list items) or misses boundaries. Merge-then-cap gives ~300-500 token chunks regardless of input structure. |
| 2026-02-24 | Non-§ content as separate chunks | Transition provisions, preamble, and appendices exist outside the § hierarchy and must be chunked separately to avoid being invisible to search. |
| 2026-02-24 | Markdown fallback is permanent | Not just for legacy data — future documents may also have structures the JSON parser can't derive § structure from (bilaga, atypical layouts). |
| 2026-02-24 | Law-first: no amendment chunking | Consolidated SFS_LAW text already reflects amendments (Riksdagen updates within hours). 99.99% of amendments have `base_law_sfs` for reverse lookup. Amendment markdown (1-5K chars) fetched at query time when needed. Reduces corpus from ~340K to ~220K chunks and avoids duplicate content. |

---

## Amendment Context (Query-Time Strategy)

Amendments are NOT embedded as chunks. Instead, when the RAG agent retrieves a law chunk with an `amendedBy` field (e.g., `"SFS 2025:732"`), it can fetch the amendment's `markdown_content` at query time:

```sql
SELECT markdown_content, title, document_number
FROM legal_documents
WHERE content_type = 'SFS_AMENDMENT'
  AND metadata->>'base_law_sfs' = 'SFS 1977:1160'
ORDER BY document_number DESC
```

**Why this works:**
- 34,194 / 34,196 amendments (99.99%) have `base_law_sfs` linking to the parent law
- Amendment markdown is typically 1-5K chars — small enough to include in agent context
- The consolidated law text already reflects the amendment changes, so the amendment is supplementary context, not the primary search surface
- No embedding cost for ~34K amendment documents

**When to revisit:** If retrieval quality evaluation shows users frequently need amendment-specific details (e.g., "what changed in the 2025 amendment to Arbetsmiljölagen?") that aren't captured by the law chunks alone, consider adding thin amendment summary chunks.

---

## Future Iteration Candidates

These are known areas that may need adjustment based on retrieval quality evaluation:

1. **Token thresholds**: The merge target (300-500) and cap (1000) are initial estimates. May need tuning after evaluating embedding quality on real queries.

2. **Oversized transition provisions**: Currently grouped as one chunk. If retrieval quality suffers for long transition provision blocks, consider splitting at numbered point boundaries.

3. **Chapter-level summary chunks**: Could generate an additional "chapter overview" chunk containing just the chapter title + list of §§. Would help broader queries like "what does chapter 6 cover?"

4. **Overlapping chunks**: Some RAG systems use overlapping windows. Not implemented initially — the § boundary is clean and overlaps would duplicate content. Revisit if retrieval misses cross-§ concepts.

5. **Heading-aware markdown splitting**: The merge algorithm could be enhanced to detect heading patterns (`#`, `##`, bold lines) and never merge across them. Listed as a potential improvement.

6. **Appendix sub-structure**: Currently one chunk per appendix. Large appendices with internal structure (tables, numbered lists) may benefit from further splitting.
