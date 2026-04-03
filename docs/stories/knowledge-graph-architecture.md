# Knowledge Graph: Cross-Reference Architecture

## Status

Idea / Discussion

## Vision

Build a navigable graph of legal cross-references so the AI can traverse connections between laws, regulations, court cases, EU acts, and propositions — rather than relying solely on embedding-based search.

## The Problem Today

Documents exist as isolated islands. The AI finds relevant text via RAG search but has no awareness of structural connections:
- A law delegates to a föreskrift — the AI doesn't know to check the föreskrift
- A court case interprets a specific paragraph — the AI can't discover this
- An amendment changes a section — which other laws reference that section?
- A föreskrift implements a chapter — the AI can't trace the empowerment chain

## Reference Types in Swedish Legal Text

| Type | Pattern | Example | From → To |
|---|---|---|---|
| Intra-law | "enligt X kap. Y §" | "enligt 9 kap. 80 §" | Section → Section (same law) |
| Inter-law (SFS) | "law name (YYYY:NNN)" | "miljöbalken (1998:808)" | Law → Law |
| EU regulation | "förordning (EU) YYYY/NNN" | "förordning (EU) 2024/573" | Law → EU Act |
| EU directive | "direktiv (EU) YYYY/NNN" | "direktiv 2008/98/EG" | Law → EU Directive |
| Proposition | "Prop. YYYY/YY:NNN" | "Prop. 2024/25:205" | Amendment → Proposition |
| Föreskrift (AFS etc) | "AFS YYYY:NN" | "AFS 2023:10" | Law → Agency regulation |
| Court case | "NJA YYYY s. NNN" | "NJA 2021 s. 235" | Law → Court ruling |
| Delegation | "föreskrifter meddelade med stöd av..." | — | Law chapter → Föreskrift |

## Proposed Data Model

```
LegalReference {
  id            String
  source_doc_id String   // FK to LegalDocument
  source_section String? // e.g., "9:80" — specific section
  target_doc_id String?  // FK to LegalDocument (if resolved)
  target_ref    String   // Raw reference text: "SFS 1998:808", "AFS 2023:10"
  target_section String? // e.g., "6:1" — specific section referenced
  ref_type      Enum     // INTRA_LAW, INTER_LAW, EU_REGULATION, EU_DIRECTIVE, PROPOSITION, FORESKRIFT, COURT_CASE, DELEGATION
  context       String?  // Surrounding text for relevance
  resolved      Boolean  // Whether target_doc_id was matched to a DB record
  created_at    DateTime
}
```

## Two-Phase Approach

### Phase 1: Extract & Store at Ingestion
- Parse references from `full_text` / `html_content` during document ingestion
- Swedish legal citations follow consistent patterns (we already have regex patterns in `linkifyHtmlContent`)
- Store as `LegalReference` rows — source document, target reference, type
- Resolve `target_doc_id` where we have the target document in our DB
- Unresolved references stay as text (target_ref) — useful for understanding scope

### Phase 2: AI Tool for Graph Traversal
- `get_related_documents(documentId, refTypes?)` — "what references this document?"
- `get_references(documentId, direction: 'outgoing' | 'incoming')` — follow links both ways
- `trace_delegation_chain(sfsNumber, chapter?)` — follow delegation from law → föreskrift → detailed rules
- The AI uses these during assessments to find complete context

## Value for Different Features

### Assessment Quality
AI can follow: amendment → base law → delegated föreskrifter → interpreting court cases
Result: More complete, authoritative assessments

### Krav (Requirements) Identification
Trace delegation chains: Arbetsmiljölagen 4 kap. → AFS 2023:1 → specific requirements
Result: Automatic, structured requirement extraction

### Change Impact Analysis
Reverse lookup: "which laws reference the section that just changed?"
Result: Proactive notifications for downstream effects

### Compliance Mapping
For a law list: "show me all implementing regulations for each law"
Result: Complete regulatory picture per law

## What We Already Have

- `linkifyHtmlContent` in `lib/linkify.ts` — already identifies SFS references in HTML and creates links. The regex patterns exist.
- `AmendmentDocument.base_law_sfs` — the simplest cross-reference (amendment → law)
- `AmendmentDocument.proposition_id` (Story 8.24) — amendment → proposition
- `SectionChange` — amendment → specific sections in the base law
- Embedding-based search — finds semantically related content (complements structural graph)

## Open Questions

1. Should we extract references from ALL documents at once (big backfill) or incrementally as documents are ingested/re-processed?
2. How do we handle unresolvable references (e.g., references to EU directives we don't have in our DB)?
3. Should the graph be bidirectional (store both "A references B" and "B is referenced by A") or compute reverse lookups on demand?
4. How does this interact with the existing linkify system? Should linkify use the reference table instead of runtime regex?
5. Performance: how many references per document on average? (Estimate: 5-20 for laws, 2-5 for föreskrifter, 1-3 for amendments)

## Priority

High for MVP — the krav identification feature depends on understanding delegation chains (law → föreskrift). Without the graph, krav extraction is blind to which regulations implement which law chapters.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-04-02 | 0.1 | Initial idea document — captured during assessment pipeline work | — |
