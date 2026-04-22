# Next Steps

## Immediate Actions

1. **Architect** (`/architect`) reviews this PRD's sections 4 (Technical Constraints) and the Pre-Story Decisions list; produces architecture addendum at `docs/architecture/epic-21-lagefterlevnadskontroll.md`.
2. **PO** (`/po`) runs the `pm-checklist` against this PRD + the brief + architecture addendum; flags alignment issues.
3. **`*shard-prd`** (me or PO): shards this PRD into `docs/prd/epic-21-lagefterlevnadskontroll.md` + support shards as needed, integrating into the existing `docs/prd/` structure.
4. **SM** (`/sm`) drafts Stories 21.1 → 21.14 one at a time in `docs/stories/`, per existing convention.
5. **Dev** (`/dev`) implements story-by-story with QA gates (`/qa`) between.

## Open Items to Track Through to GA

- Customer validation: 2–3 KMA-samordnare interviews before GA to verify the scope-selection UX, findings taxonomy, and PDF tone.
- Marketing-claim legal review: "tamper-evident" is defensible with SHA-256 + immutable ActivityLog; ensure no overclaiming to "tamper-proof" or "blockchain-anchored".
- Pricing-tier configuration: Phases 1–3 ship in SMB tier (~10 kSEK/år); Phases 4+ remain premium tier (~50 kSEK/år). Sales packaging deferred.
