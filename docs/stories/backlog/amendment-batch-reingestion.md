# Backlog: Amendment Batch Re-Ingestion via PDF→LLM Pipeline

## Status

Backlog

## Story

**As a** user reading amendment documents,
**I want** all ~30k existing amendments re-processed through the PDF→LLM pipeline,
**so that** they have clean semantic HTML (with proper lists, footnotes, cross-references, and section structure) instead of the current garbage text-extracted content.

## Context

- Proven in session 2026-02-13: tested on SFS 2025:1456, produced 22,878 chars of valid HTML (26 sections, 83 paragraphs) vs garbled `full_text`
- Pipeline: `parseAmendmentPdf()` → sends PDF buffer to Claude → validates with `validateLlmOutput()` → derives markdown/JSON/plaintext
- Cost estimate: ~$0.04/doc, ~$1,200 total for 30k via Batch API (50% discount)
- Test script exists: `scripts/test-amendment-ingestion.ts`
- LLM prompt updated: `lib/sfs/amendment-llm-prompt.ts` now produces IDs on `h3.paragraph` (TOC-compatible)

## Prerequisites

- [ ] Amendment heading ID migration script has been run (`scripts/migrate-amendment-heading-ids.ts`) — patches existing HTML
- [ ] Linkification backfill complete — so re-ingested docs get links too
- [ ] Story 2.30 (unified rendering) ideally done first so all amendments render through shared components

## Tasks

- [ ] Create batch processing script using Anthropic Batch API
- [ ] Process in batches (e.g., 500/batch) with progress tracking
- [ ] Validate each result with `validateLlmOutput()`
- [ ] Upsert html_content, markdown_content, json_content, full_text to LegalDocument
- [ ] Run linkification backfill on re-ingested documents
- [ ] Spot-check 20 random amendments visually

## Estimate

~$1,200 API cost. Script development: 1 session.
