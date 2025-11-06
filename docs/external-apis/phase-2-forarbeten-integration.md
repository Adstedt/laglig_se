# Phase 2: Förarbeten (Preparatory Works) Integration

**Status:** 🟡 POST-MVP PRIORITY FEATURE
**Target:** Phase 2 (Professional/Enterprise tier)
**Timeline:** 3-6 months post-launch
**Strategic Value:** CRITICAL for legal AI quality

---

## Executive Summary

**What:** Integrate Swedish legal preparatory works (förarbeten) to provide contextual depth for understanding WHY laws exist, not just WHAT they say.

**Why:** Dramatically improves RAG quality by giving AI access to:
- Legislative intent and reasoning
- Examples from parliamentary debate
- Committee discussions about edge cases
- Historical context for interpretation

**How:** Parse SFS law footnotes → fetch propositioner, betänkanden, SOU from Riksdagen API → ingest as separate content types → link to laws → include in RAG context.

---

## Legal Context: What Are Förarbeten?

### Swedish Legal Methodology

In Swedish legal practice, understanding a law requires studying its **förarbeten** (preparatory works):

1. **Proposition (prop)** - Government's proposal to Parliament
   - Explains WHY the law is needed
   - Provides examples and reasoning
   - Most important source for interpretation

2. **Utskottsbetänkande (bet)** - Committee report
   - Parliamentary committee's analysis
   - Discussion of proposed amendments
   - Political considerations

3. **Riksdagsskrivelse (rskr)** - Parliamentary communication
   - Formal approval/rejection message
   - Usually brief

4. **SOU (Statens offentliga utredningar)** - Government inquiry
   - Detailed background research
   - International comparisons
   - Expert recommendations

### Example: SFS 2006:545 (Lag om skyddsrum)

**Footnote in law:**
> "Prop. 2005/06:133, bet. 2005/06:FöU9, rskr. 2005/06:295"

**Translation:**
- Government proposed law via **Prop. 2005/06:133**
- Defense Committee analyzed it → **Bet. 2005/06:FöU9**
- Parliament approved → **Rskr. 2005/06:295**

**To understand this law fully, a legal professional would read:**
1. The law text itself (SFS 2006:545)
2. **The proposition** (explains why Sweden needs modern shelter law)
3. The committee report (how Parliament modified the proposal)
4. Any referenced SOU (background research on civil defense)

---

## Impact on RAG Quality

### Without Förarbeten (Current MVP):

```typescript
// RAG context for: "Vad innebär arbetsgivarens rehabiliteringsansvar?"
{
  source: "SFS_LAW",
  text: "3 kap. 2 a § Arbetsgivaren ska aktivt bedriva ett rehabiliteringsarbete..."
}
```

**AI Response:** Generic interpretation of statute language.

### With Förarbeten (Phase 2):

```typescript
// RAG context with legislative intent
{
  sources: [
    {
      type: "SFS_LAW",
      text: "3 kap. 2 a § Arbetsgivaren ska aktivt bedriva..."
    },
    {
      type: "PROPOSITION",
      doc: "Prop. 1976/77:149",
      text: "Med rehabiliteringsansvar avses att arbetsgivaren ska vidta åtgärder i ett tidigt skede när arbetstagaren visar tecken på nedsatt arbetsförmåga. Exempel: Om en anställd är sjukskriven upprepade gånger ska arbetsgivaren inte vänta på att arbetstagaren söker hjälp, utan aktivt erbjuda arbetsanpassning, arbetsprövning eller omplacering..."
    },
    {
      type: "COMMITTEE_REPORT",
      doc: "Bet. 1976/77:AU23",
      text: "Utskottet betonar att rehabiliteringsansvaret gäller ALLA arbetsgivare, även små företag. Dock kan omfattningen anpassas efter företagets storlek och resurser..."
    }
  ]
}
```

**AI Response:** Contextually rich answer with:
- What the law requires (from statute)
- WHY it was introduced (from proposition)
- HOW it should be applied (examples from förarbeten)
- EDGE CASES discussed in Parliament (from committee report)

---

## Implementation Strategy

### Step 1: Parse SFS Footnotes

**Extract förarbeten references from SFS law HTML:**

```typescript
interface ForarbetenRefs {
  proposition?: string       // "Prop. 2005/06:133"
  committee_report?: string  // "Bet. 2005/06:FöU9"
  riksdag_comm?: string      // "Rskr. 2005/06:295"
  sou_references?: string[]  // ["SOU 2004:56", ...]
}

function parseForarbeten(sfsHtml: string): ForarbetenRefs {
  // SFS laws typically have footnotes at the beginning or end
  // Pattern: "Prop. YYYY/YY:NNN, bet. YYYY/YY:XXXNNN, rskr. YYYY/YY:NNN"

  const propMatch = sfsHtml.match(/Prop\.\s+(\d{4}\/\d{2}:\d+)/i)
  const betMatch = sfsHtml.match(/bet\.\s+(\d{4}\/\d{2}:[A-ZÅÄÖa-zåäö]+\d+)/i)
  const rskrMatch = sfsHtml.match(/rskr\.\s+(\d{4}\/\d{2}:\d+)/i)

  // SOU references are often in proposition text: "Enligt SOU 2004:56..."
  const souMatches = Array.from(sfsHtml.matchAll(/SOU\s+(\d{4}:\d+)/gi))

  return {
    proposition: propMatch?.[1],
    committee_report: betMatch?.[1],
    riksdag_comm: rskrMatch?.[1],
    sou_references: souMatches.map(m => `SOU ${m[1]}`)
  }
}
```

**Expected coverage:**
- ~70-80% of SFS laws will have proposition reference
- ~50-60% will have committee report reference
- ~20-30% will have SOU references

### Step 2: Fetch from Riksdagen API

**Riksdagen API provides all document types:**

```typescript
// Fetch proposition
const propId = convertToDocId("Prop. 2005/06:133") // → "prop-200506--133"
const proposition = await fetch(
  `https://data.riksdagen.se/dokument/${propId}.json`
)

// Same API structure as SFS laws
const propData = {
  titel: "Lag om skyddsrum",
  typ: "prop",           // Document type
  rm: "2005/06",         // Parliamentary year
  nummer: "133",
  html: "<full proposition text>",
  text: "plain text version",
  organ: "Försvarsdepartementet",
  datum: "2006-01-12"
}
```

### Step 3: Create New ContentType Enums

```prisma
enum ContentType {
  SFS_LAW
  AD_LABOUR_COURT
  HD_SUPREME_COURT
  HOVR_COURT_APPEAL
  HFD_ADMIN_SUPREME
  MOD_ENVIRONMENT_COURT
  MIG_MIGRATION_COURT
  EU_REGULATION
  EU_DIRECTIVE

  // ADD Phase 2: Förarbeten
  PROPOSITION           // Regeringens proposition
  COMMITTEE_REPORT      // Utskottsbetänkande
  GOVERNMENT_INQUIRY    // SOU (Statens offentliga utredningar)
  DEPARTMENT_SERIES     // Ds (Departementsserien)
  RIKSDAG_MOTION        // Riksdagsmotioner (if needed)
}
```

### Step 4: Link Documents via CrossReference

```typescript
// After ingesting SFS law and parsing its förarbeten
async function linkForarbeten(law: LegalDocument, refs: ForarbetenRefs) {
  // Link to proposition
  if (refs.proposition) {
    const prop = await prisma.legalDocument.findFirst({
      where: {
        content_type: 'PROPOSITION',
        document_number: refs.proposition
      }
    })

    if (prop) {
      await prisma.crossReference.create({
        data: {
          source_document_id: law.id,         // SFS law
          target_document_id: prop.id,        // Proposition
          reference_type: 'HAS_PREPARATORY_WORK',
          context: 'Original legislative proposal'
        }
      })
    }
  }

  // Link to committee report
  if (refs.committee_report) {
    // Similar logic...
  }

  // Link to SOU references
  for (const souRef of refs.sou_references || []) {
    // Similar logic...
  }
}
```

### Step 5: RAG Chunking Strategy for Propositions

**Propositions have clear structure - chunk accordingly:**

```typescript
function chunkProposition(propHtml: string): Chunk[] {
  // Propositions typically structured as:
  // 1. "Sammanfattning" - Executive summary
  // 2. "Ärendet och dess beredning" - Background & process
  // 3. "Bakgrund" - Historical context
  // 4. "Nuvarande ordning" - Current legal state
  // 5. "Överväganden och förslag" - Reasoning & proposal
  // 6. "Författningskommentar" - Article-by-article commentary
  // 7. "Konsekvensanalys" - Impact analysis

  const sections = [
    extractSection(propHtml, /Sammanfattning/i),
    extractSection(propHtml, /Ärendet och dess beredning/i),
    extractSection(propHtml, /Bakgrund/i),
    extractSection(propHtml, /Nuvarande ordning/i),
    extractSection(propHtml, /Överväganden/i),
    extractSection(propHtml, /Författningskommentar/i),
    extractSection(propHtml, /Konsekvensanalys/i)
  ].filter(Boolean)

  return sections.map(section => ({
    text: section.content,
    metadata: {
      section_type: section.type,
      document_type: 'PROPOSITION',
      related_law: "SFS 2006:545",

      // CRITICAL: Weight section types differently in RAG
      weight: section.type === 'Överväganden' ? 1.5 :  // Reasoning most important
              section.type === 'Författningskommentar' ? 1.3 :  // Article commentary
              1.0
    }
  }))
}
```

**Why section weighting matters:**
- "Överväganden" (Reasoning) section has MOST interpretive value
- "Författningskommentar" (Article commentary) explains each section
- "Konsekvensanalys" (Impact analysis) helps understand practical effects

### Step 6: Enhanced RAG Retrieval Logic

```typescript
// When user asks about a law, retrieve multi-source context
async function retrieveLegalContext(
  question: string,
  lawId?: string
): Promise<RAGContext> {

  // 1. Retrieve most relevant law text chunks
  const lawChunks = await vectorSearch(question, {
    filter: { content_type: 'SFS_LAW' },
    limit: 3
  })

  // 2. If specific law identified, get its förarbeten
  if (lawId) {
    const forarbeten = await prisma.crossReference.findMany({
      where: {
        source_document_id: lawId,
        reference_type: 'HAS_PREPARATORY_WORK'
      },
      include: {
        target_document: {
          include: { embeddings: true }
        }
      }
    })

    // 3. Search WITHIN förarbeten for relevant context
    const propChunks = await vectorSearch(question, {
      filter: {
        document_id: { in: forarbeten.map(f => f.target_document_id) },
        content_type: { in: ['PROPOSITION', 'COMMITTEE_REPORT'] }
      },
      limit: 2  // Include 2 most relevant förarbeten chunks
    })

    return {
      lawText: lawChunks,
      preparatoryWorks: propChunks,
      courtCases: []  // Also retrieve if available
    }
  }

  // 4. If no specific law, do general search across all content types
  return await vectorSearch(question, { limit: 5 })
}
```

### Step 7: Updated AI Prompt Template

```typescript
const systemPrompt = `
You are a legal AI assistant helping Swedish business owners understand laws.

When answering questions, use this hierarchy of sources:

1. **LAW TEXT (SFS)** - What the law literally says
   - Binding legal requirements
   - Cite specific sections (e.g., "3 kap. 2 §")

2. **PREPARATORY WORKS (Förarbeten)** - WHY the law exists
   - Legislative intent from propositions
   - Examples from parliamentary debate
   - Use to interpret ambiguous provisions
   - Format: "Enligt propositionen (Prop. YYYY/YY:NNN) var syftet med denna bestämmelse att..."

3. **COURT CASES** - HOW the law is applied in practice
   - Real-world interpretations
   - Binding precedent
   - Use for practical guidance

IMPORTANT:
- Always distinguish between the law itself vs interpretation
- When citing förarbeten, make it clear this is INTERPRETIVE context
- For compliance advice, rely primarily on statute text + court precedent
- Use förarbeten to explain ambiguous situations or historical context
`

const userPrompt = `
Question: ${userQuestion}

Context:

LAW TEXT:
${context.lawText}

LEGISLATIVE INTENT (from preparatory works):
${context.preparatoryWorks}

COURT PRECEDENT:
${context.courtCases}

Provide a comprehensive answer that:
1. States what the law requires (cite specific sections)
2. Explains WHY this requirement exists (from förarbeten if available)
3. Shows HOW it's applied in practice (from court cases if available)
4. Gives actionable advice for the business owner
`
```

---

## Data Volume & Performance

### Estimated Document Counts

| Document Type | Count | Avg Size | Total Storage |
|---------------|-------|----------|---------------|
| **Propositioner** | ~8,000-10,000 | 100 KB | ~800 MB - 1 GB |
| **Betänkanden** | ~15,000-20,000 | 50 KB | ~750 MB - 1 GB |
| **SOU** | ~5,000-7,000 | 150 KB | ~750 MB - 1 GB |
| **Total** | **~30,000** | - | **~2.5-3 GB** |

### RAG Embeddings Impact

- **Chunk count:** ~300,000-500,000 additional chunks (propositions are long)
- **Embedding cost:** $300-500 (OpenAI `text-embedding-3-small`)
- **Vector storage:** ~1.5-2 GB additional (pgvector)

### Ingestion Time

- **Fetch from Riksdagen:** ~10-15 hours at 5 req/sec
- **Parse & chunk:** ~2-3 hours
- **Generate embeddings:** ~5-8 hours
- **Cross-reference linking:** ~1 hour
- **Total:** ~18-27 hours (one-time job)

---

## User Experience Impact

### Law Detail Page: New "Förarbeten" Tab

```typescript
<LawDetailTabs>
  <Tab name="Översikt">Law text, AI summary</Tab>
  <Tab name="AI Sammanfattning">GPT summary</Tab>
  <Tab name="Ändringshistorik">Amendment timeline</Tab>
  <Tab name="Relaterade lagar">Cross-references</Tab>
  <Tab name="Relaterade rättsfall">Court cases</Tab>

  {/* NEW Phase 2 Tab */}
  <Tab name="Förarbeten">
    <h3>Regeringens proposition</h3>
    <Link href="/dokument/prop-200506--133">
      Prop. 2005/06:133 - Lag om skyddsrum
    </Link>
    <div>
      <strong>Varför lagen infördes:</strong>
      <p>Regeringen konstaterade att det svenska skyddsrumssystemet behövde moderniseras...</p>
    </div>

    <h3>Utskottsbetänkande</h3>
    <Link href="/dokument/bet-200506--FöU9">
      Bet. 2005/06:FöU9 - Försvarsutskottets betänkande
    </Link>

    <h3>Utredningar (SOU)</h3>
    <Link href="/dokument/sou-2004--56">
      SOU 2004:56 - Skyddsrum för framtiden
    </Link>
  </Tab>
</LawDetailTabs>
```

### AI Chat: Enhanced Responses

**User:** "Vad innebär arbetsgivarens rehabiliteringsansvar?"

**Phase 1 Response (MVP - without förarbeten):**
> "Enligt Arbetsmiljölagen 3 kap. 2 a § ska arbetsgivaren aktivt bedriva rehabiliteringsarbete. Det innebär att du ska vidta åtgärder för att förebygga och begränsa ohälsa."

**Phase 2 Response (with förarbeten):**
> "Enligt Arbetsmiljölagen 3 kap. 2 a § ska arbetsgivaren aktivt bedriva rehabiliteringsarbete.
>
> **Varför kravet finns:**
> Enligt propositionen (Prop. 1976/77:149) infördes detta krav för att arbetsgivaren är den som först ser tecken på nedsatt arbetsförmåga och har bäst förutsättningar att vidta tidiga åtgärder.
>
> **Vad det innebär i praktik:**
> Regeringen gav följande exempel i propositionen:
> - Om en anställd är sjukskriven upprepade gånger ska du inte vänta passivt
> - Du ska aktivt erbjuda arbetsanpassning, arbetsprövning eller omplacering
> - Kontakta företagshälsovården för stöd i processen
>
> **För små företag:**
> Försvarsutskottet betonade att kravet gäller ALLA arbetsgivare, men omfattningen kan anpassas efter företagets storlek och resurser."

**Qualitative difference:** User gets ACTIONABLE guidance grounded in legislative intent, not just statutory language.

---

## Competitive Positioning

### Notisum (Current Market Leader)

**What they provide:**
- ✅ Full access to propositioner, betänkanden, SOU
- ✅ Chronological navigation by parliamentary year
- ❌ No cross-linking between laws → förarbeten
- ❌ No AI interpretation using förarbeten context
- ❌ Users must manually find relevant förarbeten

**Their UX:** "Here are 10,000 propositions. Good luck finding the right one."

### Laglig.se Phase 2 (Our Advantage)

**What we'll provide:**
- ✅ Automatic cross-linking: Law detail page → its förarbeten (one click)
- ✅ AI chat that USES förarbeten to explain context
- ✅ "Why this law exists" section auto-generated from proposition
- ✅ Highlighted relevant passages in förarbeten (not full 100-page documents)
- ✅ Business-focused interpretation (SMB owners don't need full proposition)

**Our UX:** "Here's why this law exists and what it means for YOUR business."

---

## Pricing Strategy

### Phase 1 (MVP): Freemium

- ✅ SFS laws
- ✅ Court cases
- ✅ AI chat (basic context)
- ✅ Change monitoring

**Target:** SMB owners, startups

### Phase 2 (Professional): SEK 1,500-2,500/month

- ✅ Everything in Freemium
- ✅ **Förarbeten integration** (propositioner, betänkanden, SOU)
- ✅ **Enhanced AI chat** (legislative intent + court precedent)
- ✅ "Why this law exists" section on every law page
- ✅ Advanced legal research tools
- ✅ Export förarbeten citations for compliance reports

**Target:** In-house counsel, compliance officers, HR managers at larger SMEs

### Phase 3 (Enterprise): Custom pricing

- ✅ Everything in Professional
- ✅ API access to all content + förarbeten
- ✅ Custom RAG tuning for industry-specific needs
- ✅ White-label option

**Target:** Large enterprises, law firms, compliance software vendors

---

## Success Metrics

### Engagement Metrics

- **Förarbeten tab click-through rate:** Target >15% of law page visitors
- **AI chat quality scores:** +20-30% improvement in user satisfaction after förarbeten integration
- **Time-to-answer:** Measure if users get answers faster with contextual depth

### Business Metrics

- **Professional tier conversion:** Target 10-15% of Freemium users upgrade for förarbeten access
- **User testimonials:** "Finally I understand WHY this law exists, not just what it says"
- **Retention:** Professional tier users with förarbeten access should have >85% annual retention

---

## Implementation Timeline

### Month 1-2: Infrastructure

- [ ] Parse SFS footnotes to extract förarbeten references
- [ ] Test Riksdagen API for fetching propositioner, betänkanden, SOU
- [ ] Extend Prisma schema with new ContentType enums
- [ ] Build förarbeten ingestion script

### Month 3-4: Data Ingestion

- [ ] Ingest ~30,000 förarbeten documents
- [ ] Generate embeddings for all propositions/betänkanden
- [ ] Create cross-reference links (SFS → prop → bet → SOU)
- [ ] Validate data quality (spot-check 100 random links)

### Month 5: RAG Tuning

- [ ] Update RAG retrieval logic to include förarbeten
- [ ] Implement section weighting (prioritize "Överväganden")
- [ ] Test AI responses with vs without förarbeten context
- [ ] A/B test with beta users

### Month 6: Launch

- [ ] Add "Förarbeten" tab to law detail pages
- [ ] Update AI chat prompt templates
- [ ] Launch Professional tier with förarbeten access
- [ ] Marketing: "Understand WHY laws exist, not just WHAT they say"

---

## Risks & Mitigations

### Risk 1: Data Quality - Missing Förarbeten References

**Issue:** Not all SFS laws have clear footnotes linking to förarbeten.

**Likelihood:** MEDIUM (~20-30% of laws may have unclear/missing references)

**Mitigation:**
1. Fallback: If no footnote, search Riksdagen for propositions mentioning the SFS number
2. Manual curation: For top 1,000 most-viewed laws, manually verify förarbeten links
3. User reporting: "Missing förarbeten? Report it" button

### Risk 2: Proposition Length = Storage Costs

**Issue:** Propositions can be 50-200 pages. 30,000 docs × 100 KB avg = 3 GB storage + embedding costs.

**Impact:** $300-500 one-time embedding cost, ~$30-50/month storage

**Mitigation:**
- Phase 1: Ingest only propositions (most important)
- Phase 2: Add betänkanden if user demand justifies cost
- Selective chunking: Focus on "Överväganden" and "Författningskommentar" sections

### Risk 3: RAG Context Window Limits

**Issue:** Adding förarbeten context increases token count in AI prompts. May hit context limits.

**Mitigation:**
- Implement tiered retrieval:
  1. Always include law text (highest priority)
  2. Include förarbeten only if query is interpretive ("varför", "syftet med", etc.)
  3. Include court cases for precedent queries
- Use GPT-4 Turbo (128K context) or Claude 3.5 Sonnet (200K context)

---

## Alternative: Quick Win for MVP

### "Förarbeten External Links" (Low Effort)

Instead of ingesting full förarbeten, just **link out to Riksdagen.se:**

```typescript
// Parse footnote and create clickable links
<div className="forarbeten-section">
  <h3>Förarbeten (Preparatory Works)</h3>
  <p>
    För att förstå denna lags syfte och tillämpning, läs:
  </p>
  <ul>
    <li>
      <a href="https://data.riksdagen.se/dokument/prop-200506--133" target="_blank">
        Proposition 2005/06:133 - Regeringens förslag
      </a>
    </li>
    <li>
      <a href="https://data.riksdagen.se/dokument/bet-200506--FöU9" target="_blank">
        Betänkande 2005/06:FöU9 - Utskottets yttrande
      </a>
    </li>
  </ul>
</div>
```

**Effort:** 1-2 days
**Value:** Shows users WHERE to find context
**Limitation:** Doesn't improve RAG quality (AI can't access external links)

---

## Recommendation

### Short-term (MVP):
✅ Implement "Förarbeten External Links" quick win (1-2 days)
✅ Focus on SFS + court cases (90% of SMB value)
✅ Defer full förarbeten ingestion to Phase 2

### Phase 2 (Professional Tier):
✅ Full förarbeten integration (propositioner priority)
✅ Enhanced RAG with legislative intent
✅ "Why this law exists" auto-generated sections
✅ Position as premium legal research feature

### Success Criteria for Phase 2:
- Professional tier conversion >10%
- AI chat quality scores +20-30%
- User testimonials about contextual depth
- Retention >85% for Professional tier

---

**Status:** 📋 DOCUMENTED - Ready for Phase 2 planning
**Next:** Validate with beta users post-MVP launch
**Timeline:** Begin implementation 3-6 months after MVP launch
