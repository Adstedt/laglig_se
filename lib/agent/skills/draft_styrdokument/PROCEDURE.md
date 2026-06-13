# Procedure

You author a complete, type-correct styrdokument and propose it via the
`draft_styrdokument` tool. The user approves it on an inline card — never paste the
document into chat prose.

## Steps

1. **Resolve the document type.** Map the request to one `docType`: POLICY,
   RISK_ASSESSMENT (riskbedömning), ACTION_PLAN (handlingsplan), PROCEDURE (rutin),
   INSTRUCTION (instruktion), CHECKLIST (checklista), REPORT (rapport) or OTHER.
   The type is usually explicit in the request ("skriv en **rutin** för...") — if
   genuinely ambiguous, ask one short clarifying question before drafting.

2. **Check for an existing document — list FIRST, then search.** Call
   **list_workspace_documents** (filter by the resolved `docType`) to get the
   authoritative list of existing documents of that type, INCLUDING unapproved
   drafts. This is the reliable duplicate check — it reads the database directly,
   so it catches a draft even if it has not been indexed yet. Then optionally call
   **search_workspace_documents** for a topical/semantic match (note: this is index-
   based and may miss a freshly-created, not-yet-indexed draft — never rely on it
   alone to conclude "no existing document"). If a document of the same type and
   topic already exists, say so and ask whether the user wants a revision of it
   instead of a duplicate (revisions go through `update_document`/`add_document_section`,
   not this skill). Read a close match in full with **get_workspace_document** if you
   need to compare scope.

3. **Pull company context.** Call **get_company_context** — bransch, storlek,
   certifieringar and verksamhetsområden shape scope, ansvar and exemplifying
   content. A styrdokument must read as written for THIS company, not a generic
   template.

4. **Consult the type module.** Read the section `### Type: <docType>` under
   "Type modules" below (e.g. `### Type: risk_assessment` for a riskbedömning).
   It defines the canonical STRUCTURE (the section skeleton you must follow), the
   per-type STYLE (verb form and perspective) and the per-type CRITERIA (invariants
   the quality gate enforces — a draft violating them is rejected by the tool).

5. **Pull the legal basis.** Call **search_laws** for the governing legislation. If
   the chat concerns a law in the bevakningslista, call **get_law_list_item** (and
   **list_linked_artifacts** when linked documents exist) to ground the draft in the
   company's kravpunkter and existing material. Every legal claim in the draft needs
   a citation per Style (GR-001).

6. **Draft the document.** Build Tiptap JSON following the type module's STRUCTURE
   exactly: `heading` nodes for sections, `paragraph` for prose, `table` where the
   module requires one (riskmatris, åtgärdstabell, kontrollpunktstabell),
   `bulletList`/`orderedList` for enumerations. Write in the type's verb form per
   the module STYLE. Fill content with company-specific substance — placeholders
   like "[komplettera]" only where the company must supply facts you cannot know
   (e.g. named persons).

7. **Self-check against the criteria.** Before calling the tool, verify the draft
   against BOTH the cross-cutting Criteria below AND the type module's CRITERIA
   (e.g. riskbedömning has its matrix table; handlingsplan rows carry ansvarig +
   klart-senast; checklista points are verifiable yes/no statements).

8. **Propose via the tool.** Call **draft_styrdokument** with `title`, the resolved
   `docType`, the Tiptap `contentJson`, and `contextLinks` for the tasks/laws the
   chat is about. The inline card IS the confirmation — do not describe the document
   in prose first, do not ask permission first.

9. **Offer follow-through (optional).** Where natural, offer — as proposals, not
   pushiness: a **create_task** for review/fastställande of the document (e.g.
   "Granska och fastställ [titel]" with a due date), or pointing out which
   kravpunkt the document, once approved, will serve as bevis for.

## Behaviour rules

- Name laws, documents and tasks in natural Swedish — never internal ids, enum
  values or tool names in user-facing prose (CP-001 in Criteria).
- Never invent legal text. If you could not retrieve the governing law, draft the
  operational content and mark the legal-basis section for completion — say so.
- One draft per request. If the user asks for several documents, propose them one
  at a time so each approval card is reviewable.
- The approved/draft distinction matters: if you reference other workspace
  documents inside the draft, only an APPROVED document is cited as gällande
  (`[Källa: …]`); an unapproved draft is referenced as pågående utkast
  (`[Utkast: …]`).
