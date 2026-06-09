# Criteria

Checks to satisfy before finishing an assessment:

- **Source-grounded:** the summary is based on the ändringstext provided in the change context block above, not training data or other amendments to the base law. Never name internal blocks or tools (`change_context`, `get_change_details`) in user-facing prose.
- **Recommendation present:** always end with one of Granskad / Åtgärd krävs / Ej tillämplig / Uppskjuten **and** a påverkansnivå (Hög/Medel/Låg/Ingen).
- **Company-specific relevance:** the relevance judgment references the company's bransch / storlek / verksamhetsområden — not a generic "arbetsgivare bör…".
- **Citations verbatim:** every `[Källa: …]` uses a `citationKey` returned by a tool — never constructed.
- **Effective date surfaced** when actions are time-bound (ikraftträdandedatum).
