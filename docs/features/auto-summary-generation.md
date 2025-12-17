# Feature: Auto-Generated Legal Summaries

**Status:** Future (Post-Ingestion Pipeline)
**Priority:** High (Core Value Proposition)
**Dependencies:** Myndighetsföreskrifter ingestion, LLM infrastructure
**Created:** 2025-12-15

---

## Overview

This document outlines the strategy for automatically generating two types of compliance summaries for legal documents:

1. **Generic Summaries** - "Så här påverkas vi" (How this affects us) - applicable to any business
2. **Personalized Summaries** - Customer-specific commentary based on their business profile

This feature is inspired by Notisum's approach but extends it with AI-powered personalization.

---

## Research Findings (from Notisum Analysis)

### Dataset Analyzed

- Source: `data/notisum-amnesfokus/laglistor-all-combined.csv`
- 657 documents across 9 law lists
- 425 documents with compliance summaries

### Two Text Types Identified

| Field                  | Purpose                    | Perspective              | Avg Length |
| ---------------------- | -------------------------- | ------------------------ | ---------- |
| **Notisum Comment**    | Expert context, background | Third-person descriptive | ~800 chars |
| **Så här påverkas vi** | Compliance actions         | First-person imperative  | ~550 chars |

### Summary Statistics by Document Type

| Type           | Count | Avg Length | Style                                   |
| -------------- | ----- | ---------- | --------------------------------------- |
| SFS Laws       | 273   | 499 chars  | Broader scope, principles               |
| Föreskrifter   | 131   | 720 chars  | Technical detail, specific requirements |
| EU Regulations | 21    | ~600 chars | Cross-reference heavy                   |

---

## Summary Structure Patterns

### Pattern A: Scope + Actions (60% of summaries)

```
[Title/Abbreviation]
[Scope: "Denna lag/föreskrift berör..."]
[Action list with "Vi ska..." statements]
```

### Pattern B: Pure Imperative (25% of summaries)

```
[Title]
Vi ska [action 1].
Vi ska [action 2].
Vi ska [action 3].
```

### Pattern C: Descriptive + Implications (15% of summaries)

```
[Context about who is affected]
[What the regulation covers]
[Implications: "Det innebär att vi..."]
```

---

## Linguistic Analysis

### Opening Phrases Distribution

| Opening                       | Count | Usage                      |
| ----------------------------- | ----- | -------------------------- |
| "Vi ska..."                   | 90    | Direct action start        |
| "Denna lag berör..."          | 55    | Scope-first (laws)         |
| "Dessa föreskrifter berör..." | 31    | Scope-first (föreskrifter) |
| "Lagen reglerar..."           | 27    | Law description            |
| "När..." / "Om..."            | 35    | Conditional applicability  |

### Top Action Verbs (after "Vi ska")

| Verb        | Count | English   | Use Case                         |
| ----------- | ----- | --------- | -------------------------------- |
| ha          | 67    | have      | Documentation, systems, policies |
| se till     | 32    | ensure    | Oversight responsibilities       |
| säkerställa | 6     | guarantee | Compliance assurance             |
| lämna       | 9     | submit    | Reporting obligations            |
| följa       | 7     | follow    | Rule adherence                   |
| anmäla      | 6     | notify    | Incident reporting               |
| uppfylla    | 6     | fulfill   | Requirement completion           |
| vidta       | 6     | take      | Measures, actions                |
| genomföra   | 6     | implement | Process execution                |
| förebygga   | 5     | prevent   | Risk mitigation                  |

### Formatting Patterns

- **83.5%** contain obligation language (ska/måste/skall)
- **24.5%** use bullet point lists
- **4.2%** use numbered lists

---

## Implementation: Generic Summaries

### Prompt Template: SFS Laws

```markdown
Du är en svensk compliance-expert. Generera en praktisk sammanfattning för företag.

DOKUMENT: {law_title}
SFS: {sfs_number}
INNEHÅLL: {law_text_excerpt}

INSTRUKTIONER:

1. Börja med vanlig förkortning i fetstil om sådan finns (t.ex. "LAS", "AML", "GDPR")
2. En mening: "Denna lag berör [vilka som påverkas]"
3. En mening: Kort beskrivning av lagens omfattning
4. Punktlista med 3-6 konkreta "Vi ska..."-skyldigheter
   - Använd aktiva verb: ha, säkerställa, följa, anmäla, lämna, uppfylla
   - Fokusera på VAD man ska göra, inte juridisk teori
5. Avsluta med eventuella viktiga tröskelvärden eller undantag

LÄNGD: 300-600 tecken
TON: Direkt, praktisk, compliance-fokuserad
SPRÅK: Svenska
FORMAT: Ren text med punktlista (använd "- " för punkter)
```

### Prompt Template: Föreskrifter

```markdown
Du är en svensk compliance-expert. Generera en praktisk sammanfattning för företag.

DOKUMENT: {foreskrift_title}
BETECKNING: {designation} (t.ex. AFS 2023:1)
UTFÄRDANDE MYNDIGHET: {agency_name}
INNEHÅLL: {foreskrift_text_excerpt}
IMPLEMENTERAR: {related_sfs_laws}

INSTRUKTIONER:

1. Börja med beskrivande titel (t.ex. "Hantering av brandfarliga vätskor")
2. "Dessa föreskrifter berör verksamheter som [specifik aktivitet]."
3. "Vi ska [huvudkrav]:"
   - Punktlista med 4-8 specifika skyldigheter
   - Inkludera dokumentationskrav
   - Inkludera inspektions-/rapporteringskrav
4. Notera eventuella tröskelvärden eller undantag
5. Vid behov, nämn koppling till bakomliggande SFS-lag

LÄNGD: 400-800 tecken
TON: Teknisk men tillgänglig, handlingsorienterad
SPRÅK: Svenska
FORMAT: Ren text med punktlista
```

### Quality Criteria

Generated summaries should:

- [ ] Start with document identifier or common name
- [ ] Include scope statement ("berör...")
- [ ] Have 3-8 "Vi ska" action items
- [ ] Use correct Swedish legal terminology
- [ ] Be scannable (bullet points where appropriate)
- [ ] Stay within length limits
- [ ] Not include legal theory or history
- [ ] Focus on WHAT TO DO, not WHY

---

## Implementation: Personalized Summaries

### Concept

Extend generic summaries with customer-specific context to answer:

- "How does this SPECIFICALLY affect MY business?"
- "What do I ACTUALLY need to do given my situation?"

### Customer Profile Schema

```typescript
interface CustomerProfile {
  // Basic info
  companyName: string
  organizationNumber: string
  industry: string // SNI code or category

  // Size & structure
  employeeCount: number
  hasRemoteWorkers: boolean
  hasMinorEmployees: boolean // Under 18
  operatesInternationally: boolean

  // Physical operations
  physicalLocations: {
    type:
      | 'office'
      | 'warehouse'
      | 'factory'
      | 'retail'
      | 'restaurant'
      | 'construction_site'
    address?: string
  }[]

  // Industry-specific flags
  handlesChemicals: boolean
  handlesFoodProducts: boolean
  handlesPersonalData: boolean
  handlesFinancialServices: boolean
  providesHealthcare: boolean
  operatesVehicles: boolean

  // Certifications & existing compliance
  certifications: ('ISO9001' | 'ISO14001' | 'ISO27001' | 'HACCP' | 'other')[]
  hasComplianceOfficer: boolean

  // Custom notes
  businessDescription: string // Free text from customer
  specificConcerns: string[] // User-added focus areas
}
```

### Personalization Prompt Extension

```markdown
GENERISK SAMMANFATTNING:
{generic_summary}

KUNDPROFIL:

- Företag: {company_name}
- Bransch: {industry}
- Antal anställda: {employee_count}
- Verksamhetstyper: {location_types}
- Hanterar kemikalier: {handles_chemicals}
- Hanterar personuppgifter: {handles_personal_data}
- Hanterar livsmedel: {handles_food}
- Kundspecifik beskrivning: {business_description}

INSTRUKTIONER:
Anpassa den generiska sammanfattningen för denna specifika kund:

1. RELEVANS-BEDÖMNING
   - Är detta dokument relevant för kunden? (Hög/Medium/Låg/Ej tillämplig)
   - Om ej tillämplig, förklara kort varför

2. KUNDSPECIFIKA SKYLDIGHETER
   - Vilka av de generiska skyldigheterna gäller specifikt för denna kund?
   - Finns det specifika tröskelvärden som påverkar kunden? (t.ex. ">50 anställda")
   - Lägg till branschspecifika förtydliganden

3. PRAKTISKA ÅTGÄRDER
   - Lista 2-4 konkreta åtgärder kunden bör vidta
   - Var specifik: "Upprätta rutin för X" istället för "Ha rutiner"

4. VARNINGAR/RISKER
   - Särskilda risker för denna typ av verksamhet
   - Vanliga brister i branschen

FORMAT:

## Relevans för {company_name}: [Hög/Medium/Låg]

### Så här påverkas ni specifikt:

[Anpassad text]

### Era skyldigheter:

- [Specifik skyldighet 1]
- [Specifik skyldighet 2]

### Rekommenderade åtgärder:

1. [Konkret åtgärd]
2. [Konkret åtgärd]

### Observera särskilt:

[Varningar eller branschspecifika risker]
```

### Personalization Examples

#### Example 1: Restaurant (15 employees)

**Generic AFS 2023:1 Summary:**

> Systematiskt arbetsmiljöarbete (SAM)
> Vi ska planera, undersöka, genomföra och följa upp verksamheten...
> Vi ska ha en arbetsmiljöpolicy samt rutiner...

**Personalized Output:**

> ## Relevans för Restaurang AB: Hög
>
> ### Så här påverkas ni specifikt:
>
> Som restaurang med 15 anställda omfattas ni fullt ut av SAM-kraven.
> Restaurangbranschen har särskilda risker kring ergonomi (tunga lyft, stående arbete),
> kemikalier (rengöringsmedel), och psykosocial arbetsmiljö (stress under rusningstid).
>
> ### Era skyldigheter:
>
> - Ha dokumenterad arbetsmiljöpolicy (obligatoriskt vid 10+ anställda)
> - Genomföra årlig SAM-uppföljning
> - Utse skyddsombud (obligatoriskt vid 5+ anställda)
> - Riskbedöma köksarbete specifikt (heta ytor, halkrisk, tunga lyft)
>
> ### Rekommenderade åtgärder:
>
> 1. Upprätta checklista för daglig köksriskbedömning
> 2. Dokumentera rutin för hantering av stressiga arbetspass
> 3. Säkerställ ergonomisk utrustning för diskpersonal
>
> ### Observera särskilt:
>
> Restaurangbranschen har hög frekvens av arbetsolyckor relaterade till halkning och brännskador.
> Arbetsmiljöverket genomför regelbundna inspektioner i branschen.

#### Example 2: IT-konsultbolag (8 employees, remote)

**Personalized Output:**

> ## Relevans för TechConsult AB: Medium
>
> ### Så här påverkas ni specifikt:
>
> Som IT-konsultbolag med 8 anställda och distansarbete har ni begränsade fysiska
> arbetsmiljörisker men viktiga krav kring organisatorisk och social arbetsmiljö (OSA).
>
> ### Era skyldigheter:
>
> - Ha arbetsmiljöpolicy (kan vara förenklad vid <10 anställda)
> - Riskbedöma distansarbetsplatser
> - Förebygga digital stress och gränslöst arbete
> - Säkerställa ergonomiska hemarbetsplatser
>
> ### Rekommenderade åtgärder:
>
> 1. Skicka ut ergonomi-checklista till alla distansarbetare
> 2. Upprätta policy för arbetstider och tillgänglighet
> 3. Genomför årlig enkät om psykosocial arbetsmiljö
>
> ### Observera särskilt:
>
> Vid distansarbete har arbetsgivaren fortsatt arbetsmiljöansvar.
> Dokumentera att ni erbjudit ergonomisk utrustning för hemarbetsplatsen.

---

## Technical Architecture

### Summary Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE                           │
│  (SFS Laws, Föreskrifter, EU Regulations)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 GENERIC SUMMARY GENERATION                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Extract key  │───▶│ LLM Prompt   │───▶│ Quality      │       │
│  │ sections     │    │ (GPT-4/Claude)│   │ Validation   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE (Supabase)                            │
│  LegalDocument.genericSummary: string                            │
│  LegalDocument.expertComment: string                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PERSONALIZED SUMMARY GENERATION                     │
│  (On-demand or batch per customer)                               │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Customer     │───▶│ LLM Prompt   │───▶│ Cache in     │       │
│  │ Profile      │    │ + Generic    │    │ CustomerDoc  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema Extension

```prisma
model LegalDocument {
  // ... existing fields

  // Generic summaries (generated once, shared)
  genericSummary    String?   @db.Text  // "Så här påverkas vi"
  expertComment     String?   @db.Text  // Background/context
  summaryGeneratedAt DateTime?
  summaryModel      String?   // "gpt-4o", "claude-sonnet-4-20250514"

  // Quality tracking
  summaryQualityScore Float?  // 0-1, from validation
  summaryReviewedBy   String? // Admin who approved
}

model CustomerDocumentSummary {
  id              String   @id @default(uuid())
  customerId      String
  documentId      String

  // Personalized content
  relevanceLevel  String   // "high", "medium", "low", "not_applicable"
  personalizedSummary String @db.Text
  specificObligations String[]
  recommendedActions  String[]
  warnings           String[]

  // Generation metadata
  generatedAt     DateTime @default(now())
  promptVersion   String   // Track prompt iterations
  modelUsed       String

  // Cache invalidation
  customerProfileHash String // Regenerate if profile changes

  customer        Customer @relation(fields: [customerId], references: [id])
  document        LegalDocument @relation(fields: [documentId], references: [id])

  @@unique([customerId, documentId])
  @@index([customerId])
}
```

### Cost Estimation

| Operation               | Model       | Est. Tokens | Cost/Doc | Volume                   | Monthly Cost    |
| ----------------------- | ----------- | ----------- | -------- | ------------------------ | --------------- |
| Generic Summary         | GPT-4o      | ~2000       | $0.02    | 15,000 docs              | $300 (one-time) |
| Personalized            | GPT-4o-mini | ~1500       | $0.001   | 100 customers × 500 docs | $50/month       |
| Re-generation (updates) | GPT-4o      | ~2000       | $0.02    | ~100/month               | $2/month        |

---

## Quality Assurance

### Automated Validation Rules

```typescript
interface SummaryValidation {
  // Structure checks
  hasTitle: boolean // Starts with identifier
  hasScopeStatement: boolean // Contains "berör"
  hasActionItems: boolean // Contains "Vi ska"
  actionItemCount: number // Should be 3-8

  // Length checks
  charCount: number // 300-800 target
  isWithinLimits: boolean

  // Content checks
  usesFirstPersonPlural: boolean // "Vi" not "man" or "företaget"
  hasObligationLanguage: boolean // ska/måste/skall
  noLegalJargon: boolean // Avoid "rekvisit", "stadgande" etc.

  // Quality score (0-1)
  overallScore: number
}
```

### Human Review Queue

For summaries with quality score < 0.7:

1. Flag for manual review
2. Present side-by-side: source text + generated summary
3. Allow editing before approval
4. Feed corrections back to improve prompts

---

## Rollout Plan

### Phase 1: Generic Summaries (with main ingestion)

- [ ] Implement prompt templates
- [ ] Add summary fields to LegalDocument schema
- [ ] Generate summaries during ingestion pipeline
- [ ] Basic quality validation
- [ ] Admin review UI

### Phase 2: Summary Display

- [ ] Show summaries on document detail pages
- [ ] Add to search results preview
- [ ] Include in law list views

### Phase 3: Customer Profiles

- [ ] Design customer profile schema
- [ ] Build profile collection UI (onboarding flow)
- [ ] Store profiles in database

### Phase 4: Personalized Summaries

- [ ] Implement personalization prompt
- [ ] Build generation pipeline
- [ ] Caching and invalidation logic
- [ ] Customer dashboard showing personalized relevance

### Phase 5: Optimization

- [ ] A/B test prompt variations
- [ ] Collect user feedback on summary quality
- [ ] Fine-tune or switch models based on performance
- [ ] Consider fine-tuning on Notisum examples

---

## Open Questions

1. **Regeneration triggers:** When should personalized summaries be regenerated?
   - Customer profile changes?
   - Document updates?
   - Periodic refresh?

2. **Relevance scoring:** Should we pre-compute relevance scores for all customer-document pairs, or generate on-demand?

3. **Multi-language:** Should summaries be available in English for international companies operating in Sweden?

4. **Feedback loop:** How do we collect user feedback on summary quality to improve prompts?

5. **Legal disclaimer:** What disclaimers are needed to clarify these are AI-generated summaries, not legal advice?

---

## References

- Analysis source: `data/notisum-amnesfokus/laglistor-all-combined.csv`
- Notisum product: https://www.notisum.se
- Related epic: `docs/stories/backlog/epic-myndighetsforeskrifter.md`
