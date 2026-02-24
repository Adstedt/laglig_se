# Story 2.5a: Enrich Page Styling and Metadata [BACKLOG]

## Status: BACKLOG

## Context

Story 2.5 delivered functional SEO pages for all content types (SFS laws, court cases, EU legislation). Basic hero headers and card layouts were implemented, but significant UX and content enrichment opportunities remain.

## Dev Notes from Story 2.5

The following items were identified during implementation but deferred to maintain velocity:

### SFS Law Pages (`/lagar/[id]`)
- [ ] Parse and display structured sections (chapters, paragraphs) with navigation
- [ ] Add table of contents for long laws
- [ ] Improve paragraph number (`§`) styling and anchor links
- [ ] Extract and display "Träder i kraft" dates more prominently
- [ ] Add related laws section based on subject codes
- [ ] Implement collapsible amendment history
- [ ] Add print-friendly stylesheet

### Court Case Pages (`/rattsfall/[court]/[id]`)
- [ ] Fetch and display full case text (currently many show "Ingen domtext tillgänglig")
- [ ] Better party information display with roles
- [ ] Timeline visualization for case history
- [ ] Highlight cited law paragraphs with links
- [ ] Add similar cases section
- [ ] Court-specific styling (HD vs HFD vs AD etc.)

### EU Legislation Pages (`/eu/[type]/[id]`)
- [ ] Fetch full document text from EUR-Lex
- [ ] Display Swedish implementation measures with links to SFS laws
- [ ] Show document lifecycle (in force, amended, repealed)
- [ ] Add related EU documents section
- [ ] Language selector for multilingual documents
- [ ] Better CELEX number explanation

### Cross-Cutting Improvements
- [ ] Responsive typography scaling
- [ ] Dark mode optimization for legal documents
- [ ] Reading progress indicator for long documents
- [ ] Keyboard navigation for sections
- [ ] Share/cite functionality with proper legal citation format
- [ ] PDF export option
- [ ] Accessibility audit (WCAG 2.1 AA)

### Listing Pages
- [ ] Add filtering by date, status, subject
- [ ] Implement search within each content type
- [ ] Infinite scroll or better pagination
- [ ] Grid/list view toggle

## Technical Debt
- Remove unused `Separator` import from court case page
- Consider shared `LegalDocumentLayout` component
- Consolidate `legal-document` and `legal-content` CSS classes

## Acceptance Criteria (to be refined)
- [ ] All page types display full document content
- [ ] Consistent navigation patterns across page types
- [ ] Mobile-optimized reading experience
- [ ] Performance: LCP < 2.5s on 3G

## Dependencies
- Story 2.2a (HTML content backfill) - completed
- Story 2.3 (court cases ingestion) - completed
- Story 2.4 (EU legislation ingestion) - in progress

## Estimate
TBD - recommend breaking into sub-stories per page type
