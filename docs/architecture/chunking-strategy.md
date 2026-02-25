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

The contextual header is a structural breadcrumb generated deterministically from the document's JSON structure (Story 14.2). It is prepended to chunk content before embedding.

**Format:** `"{document title} ({document number}) > {chapter} > {paragraf}"`

**Rules:**
- Always include document title and number
- Include chapter part only if the document has chapters (omit for flat docs)
- Include § number for paragraf chunks
- Use `>` as separator
- Keep it concise — this is prepended to content, so every token counts

---

## LLM Context Prefix (Contextual Retrieval)

**Owner:** Story 14.3 (Embedding Generation Pipeline)

In addition to the structural `contextual_header`, each chunk receives an LLM-generated **context prefix** (50-100 tokens) before embedding. This implements [Anthropic's contextual retrieval pattern](https://www.anthropic.com/news/contextual-retrieval), which reduces retrieval failures by up to 67%.

### How It Works

1. For each document, send its full markdown text + all chunk paths/previews to Claude Haiku in **one API call**
2. The LLM returns a short semantic context for each chunk — explaining what it's about within the document
3. The context prefix is stored in `ContentChunk.context_prefix` and prepended before embedding

### Why One Call Per Document (Not One Per Chunk)

With ~295K chunks across ~11K documents, sending one call per chunk would mean 295K API calls each containing the full document text. Instead, we batch all chunks for a document in a single call:

- **295K calls → ~11K calls** (one per document)
- Same total input tokens (each document's markdown is sent once either way)
- Simpler orchestration, fewer failure points

### Embedding Input Assembly

Each chunk's embedding input combines three layers:

```
{contextual_header}       ← structural breadcrumb (free, deterministic)
{context_prefix}          ← LLM semantic summary (Haiku, 50-100 tokens)

{content}                 ← raw chunk text
```

**Example:**
```
Arbetsmiljölag (SFS 1977:1160) > Kap 2: Arbetsmiljöns beskaffenhet > 3 §
Denna paragraf specificerar arbetsgivarens ansvar för att arbetsplatsen
utformas så att risker för ohälsa och olycksfall förebyggs.

Arbetsförhållandena skall anpassas till människors olika förutsättningar
i fysiskt och psykiskt avseende...
```

### Large Document Strategy

Most documents fit within Claude's context window. For the few that don't:

| Document size (markdown) | Count | Strategy |
|---|---|---|
| < 200K tokens | ~11,385 (99.9%) | Send full markdown |
| > 200K tokens | ~13 | Split at division/avdelning level |

The 13 largest laws (Inkomstskattelagen 316K tokens, Socialförsäkringsbalken 213K, etc.) all have division structure. Each division is sent as a separate API call with only its associated chunks. If a single division exceeds 200K tokens, fall back to chapter-level context.

### Cost

- **One-time:** ~$45-60 for all ~11K documents (Claude Haiku)
- **Incremental:** Negligible per document update (one Haiku call for ~10-50 chunks)

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-02-24 | § as chunk unit (not stycke) | The § is the semantic atom of Swedish law — what lawyers cite, what contains a complete provision. Stycke-level fragments meaning. |
| 2026-02-24 | Paragraph-merge for markdown fallback | Naive `\n\n` splitting produces too many tiny chunks (one-line list items) or misses boundaries. Merge-then-cap gives ~300-500 token chunks regardless of input structure. |
| 2026-02-24 | Non-§ content as separate chunks | Transition provisions, preamble, and appendices exist outside the § hierarchy and must be chunked separately to avoid being invisible to search. |
| 2026-02-24 | Markdown fallback is permanent | Not just for legacy data — future documents may also have structures the JSON parser can't derive § structure from (bilaga, atypical layouts). |
| 2026-02-24 | Law-first: no amendment chunking | Consolidated SFS_LAW text already reflects amendments (Riksdagen updates within hours). 99.99% of amendments have `base_law_sfs` for reverse lookup. Amendment markdown (1-5K chars) fetched at query time when needed. Reduces corpus from ~340K to ~220K chunks and avoids duplicate content. |
| 2026-02-25 | LLM context prefixes via Haiku | Anthropic's contextual retrieval reduces retrieval failures by up to 67%. One API call per document (not per chunk) keeps request count at ~11K instead of ~295K. Markdown sent as context (50% smaller than JSON). |
| 2026-02-25 | One call per document for context | Sending all chunks in one call is cheaper and simpler than per-chunk calls with prompt caching. For 13 oversized laws, split at division/avdelning level. |
| 2026-02-25 | Markdown as LLM context input | Markdown is ~50% the size of JSON (no schema overhead) and contains the same readable text. All but 13 laws fit within 200K token context window when using markdown. |

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

4. **Overlapping chunks**: Not needed — the § boundary is a clean semantic unit. The LLM context prefix (Story 14.3) solves the "chunk lacks context" problem more effectively than mechanical overlap. Revisit only if retrieval evaluation shows cross-§ concept misses.

5. **Heading-aware markdown splitting**: The merge algorithm already never merges across heading patterns. Listed as implemented in Story 14.2.

6. **Appendix sub-structure**: Currently one chunk per appendix. Large appendices with internal structure (tables, numbered lists) may benefit from further splitting.
