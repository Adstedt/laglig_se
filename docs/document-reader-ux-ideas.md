# Document Reader UX Ideas — Future Brainstorming

## High-value, low-effort
1. **Copy with citation** — Select text, get auto-formatted citation (text + § ref + doc number). Bestlaw built their product around this gap.
2. **Collapsible sections** — Expand/collapse chapters, bilagor, övergångsbestämmelser. Focus on one section at a time.
3. **Auto-generated clickable TOC** — Jump links to each §. Already have `nav.chapter-toc` for split parents, extend to all multi-section docs.

## Medium-value, medium-effort
4. **Highlight + save snippets** — Select text, highlight in color, save to workspace collection linked back to source §. LiquidText model.
5. **Bookmark/pin sections** — Star individual §§ or chapters to "Mina sparade" list. Simpler than snippets.
6. **"Ask AI about this section"** — Select text → contextual AI explanation. Harvey/CoCounsel pattern. High perceived value.
7. **Traffic-light risk indicators** — Flag sections that are amended, repealed, or have pending changes. Luminance pattern.

## Lower priority but interesting
8. **Cross-reference links** — "enligt 3 kap. 2 §" becomes a clickable link. Westlaw/Lexis do this extensively.
9. **Compare versions** — Side-by-side diff for amended sections. Already have SectionChange data to power this.
10. **Annotation/notes** — Personal notes attached to a §, visible on revisit.

## Recommended implementation order
1. Copy with citation + TOC with jump links (low-effort, high-polish)
2. Bookmarks + Ask AI (workspace-powered differentiators)
3. Cross-references + version compare (data already exists)

## References
- Bestlaw (bestlaw.io) — copy citations, collapsible sections, clean reading view
- LiquidText (liquidtext.net/legal) — excerpt linking, multi-doc workspace
- Harvey AI (harvey.ai) — contextual Q&A, unified workflows
- Luminance — traffic-light risk analysis, pattern recognition
- Westlaw/Lexis — Notes of Decisions, cross-reference links, annotations
