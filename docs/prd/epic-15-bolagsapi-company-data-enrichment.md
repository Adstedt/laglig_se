# Epic 15: BolagsAPI Integration & Company Data Enrichment

**Goal:** Integrate BolagsAPI to automatically fetch and populate company data during onboarding, enrich the CompanyProfile with authoritative signals from Bolagsverket/SCB, build an SNI reference data system, and improve the compliance agent's company context.

**Delivers:** BolagsAPI client service, onboarding auto-fill (org number → API → populate form), SNI code reference system (lookup, search, validation), enriched agent company context

**Requirements covered:** FR2 (onboarding), FR3 (personalization), FR20 (company profiling)

**Estimated stories:** 4

**Note:** Supersedes Story 2.9 (SNI Code Discovery) ACs 6-8 (Bolagsverket integration). Story 2.9's law list mapping (ACs 13-16), discovery UI (ACs 17-22), and analytics (ACs 23-26) remain in backlog as separate future work. Also supersedes Story 4.2 (Bolagsverket API integration) — BolagsAPI replaces direct Bolagsverket access.

---

## Epic Description

### Existing System Context

- **Onboarding flow:** `app/onboarding/_components/company-info-step.tsx` — manual form with 7 fields (name, org number, street address, postal code, city, SNI code, legal form, employee count). All fields typed manually.
- **Workspace creation:** `app/actions/workspace.ts` `createWorkspace()` — reads form data, creates Workspace + CompanyProfile in a transaction.
- **Company profile:** `CompanyProfile` model in Prisma — 20+ fields including company_name, org_number, sni_code, industry_label, employee_count_range, municipality, activity_flags, etc.
- **Agent context:** `lib/agent/system-prompt.ts` `formatCompanyContext()` — formats profile into bullet points injected into `<company_context>` block in system prompt. Currently surfaces: name, org number, SNI, industry, employee range, certifications, compliance maturity, activity flags.
- **Agent tool:** `lib/agent/tools/get-company-context.ts` — returns profile + compliance posture to agent on demand.
- **Validation:** `lib/validation/workspace.ts` `WorkspaceOnboardingSchema` — Zod schema for onboarding form.
- **Profile completeness:** `lib/profile-completeness.ts` — calculates 0-100 score from filled fields.

### Enhancement Details

1. **BolagsAPI client** (`lib/bolagsapi/`) — server-side service with bearer token auth, type-safe response mapping, timeout handling. Uses free tier: `GET /v1/company/{orgnr}` returns company name, org form, address, municipality, SNI codes, tax status, registration date, company size, website, foreign ownership, and more.
2. **Schema migration** — add enrichment fields to CompanyProfile (business_description, tax_status, foreign_owned, fi_regulated, ongoing_procedures, data_source, last_enriched_at).
3. **Onboarding auto-fill** — user enters org number → debounced API call → form fields auto-populated with loading state. Fields remain editable. Graceful fallback to manual input on API failure.
4. **SNI reference data** — seed 1,882 SNI 2025 codes with hierarchy, build lookup/search endpoints, autocomplete component.
5. **Agent context enrichment** — update `formatCompanyContext()` to inject business description, tax status, foreign ownership, FI regulation status.

### Success Criteria

- Org number entry auto-populates company name, address, legal form, SNI, municipality within 2 seconds
- Agent receives richer context (business description, tax status, foreign ownership, FI-regulation)
- Manual form fields remain editable (API data as defaults, not locked)
- Graceful degradation when API is unavailable (fall back to manual input)
- SNI codes searchable by code or Swedish description

---

## Stories

### Story 15.1: Schema Migration & BolagsAPI Client

Add enrichment fields to CompanyProfile, create the BolagsAPI client service with type-safe response mapping, and org number validation via the API.

### Story 15.2: Onboarding Auto-Fill

Wire the BolagsAPI client into the onboarding flow — debounced org number lookup, auto-fill form fields, loading/error states, persist enriched data through workspace creation.

### Story 15.3: SNI Reference Data System

Seed SNI 2025 codes (1,882 entries with hierarchy), build lookup and search API endpoints, create autocomplete component for the onboarding form SNI field.

### Story 15.4: Agent Context Enrichment

Update `formatCompanyContext()` and `get_company_context` tool to surface new enrichment fields, giving the compliance agent authoritative signals for better-tailored advice.

---

## Story Dependencies

```
15.1 (client + schema) ──→ 15.2 (onboarding auto-fill)
15.1 (client + schema) ──→ 15.4 (agent enrichment)
15.3 (SNI system)      ──→ independent, can parallel with 15.1
```

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged — `createWorkspace()` still accepts manual form data
- [x] Database changes are additive only — all new fields are nullable
- [x] UI changes follow existing patterns — same form components, same onboarding wizard structure
- [x] Performance impact is minimal — single API call during onboarding, no impact on existing flows
- [x] Existing `formatCompanyContext()` output is a superset of current output — agent behavior improves, never degrades

## Risk Mitigation

- **Primary Risk:** BolagsAPI unavailability during onboarding
- **Mitigation:** API call is non-blocking; form remains fully functional with manual input. Server-side call with 5s timeout. Loading/error states clearly communicated.
- **Rollback Plan:** New fields are all nullable and additive. Remove API call from onboarding, form reverts to manual-only. No data loss.

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Existing onboarding flow works unchanged when API is unavailable
- [ ] Agent context includes new enrichment signals
- [ ] SNI codes seeded and searchable
- [ ] No regression in existing features
- [ ] Tests cover API client, mapping logic, and graceful degradation
