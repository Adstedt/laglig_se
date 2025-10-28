# Homepage & Onboarding - Complete Specification

**Status:** ✅ COMPLETE
**Last Updated:** 2025-10-28
**Next:** Dashboard/Workspace specification

---

## Table of Contents

1. [Homepage/Landing Page](#homepage-landing-page)
2. [Dynamic Onboarding Widget](#dynamic-onboarding-widget)
3. [Pricing Strategy](#pricing-strategy)
4. [Trial Mechanics](#trial-mechanics)

---

## Homepage/Landing Page

### Hero Section

**Headline:**
```
Vi håller koll på lagarna – du håller koll på affären
AI-driven lagefterlevnad som anpassar sig efter just ditt företag
Compliance utan krångel.
```

**Primary CTA:** "Se din laglista" (triggers embedded onboarding widget below)
**Secondary CTA:** "Utforska funktioner" (scrolls to features section)

**Hero Visual:**
- Animated video of component streaming (can revisit post-MVP)
- Video explainer further down page with illustrations/graphics

---

### Stats Section

**Verifiable Metrics:**
- "10,000+ lagparagrafer indexerade"
- "Uppdateras dagligen från Riksdagen"
- **Post-launch:** "[X] unika laglistor genererade för svenska företag" (real number, add when >10 customers)

**Trust Signals:**
- Customer logos when available (focus on public sector)
- Testimonials post-launch
- Security/compliance badges (GDPR-compliant)

---

### Pain Points Section

**Financial Pain:**
- ❌ Böter upp till 500,000 SEK för arbetsmiljöbrott
- ❌ Juristkostnader: 2,000-5,000 SEK per timme
- ❌ 5-10 timmar/månad i administrativt arbete

**Emotional Pain:**
- 😰 "Håller vi på rätt sida lagen?"
- 😓 "Hinner vi hålla koll på alla ändringar?"
- 😤 "Varför är det så krångligt att hitta rätt information?"

---

### Feature Showcase

**Presentation:** Expandable accordion (Icon + Headline + 2 sentences → Click "Läs mer" for GIF + detailed description)

**Feature Order (prioritized for homepage):**

1. **AI-assistent byggd på RAG-teknologi**
   - Eliminerar hallucinationer, ger endast faktabaserade svar från svenska lagar
   - Särskilt byggd modell med RAG-backbone för korrekta svar ENDAST

2. **Personlig laglista med kontextuella kommentarer**
   - Unik för just ditt företag och bransch
   - AI-genererade kommentarer som förklarar vad lagen betyder för DIG

3. **Ändringsbevakning med notiser**
   - Få besked direkt när relevanta lagar ändras
   - Proaktiv compliance istället för reaktiv

4. **Kanban-arbetsyta**
   - Visuell översikt och uppgiftshantering kopplat till lagar
   - Jira-inspirerad workflow för compliance

5. **HR-modul**
   - Medarbetarhantering med koppling till arbetsmiljö- och anställningslagar
   - Dra medarbetarkort direkt in i AI-chatten

6. **Teamsamarbete**
   - Flera användare, roller och arbetsflöden
   - @mentions, uppgiftstilldelning, kommentarer

---

### Segment Tabs

**Section: "Vem är Laglig.se för?"**

**Tab 1: Små och medelstora företag (10-50 anställda)**
- **Use case:** Restaurangägare som behöver koll på arbetsmiljö, livsmedel, alkohollagen
- **Pain point:** Begränsad tid, ingen egen jurist
- **Value:** AI-assistenten som juridisk rådgivare utan timpris

**Tab 2: ISO-konsulter och kvalitetschefer**
- **Use case:** Konsult som hanterar 10+ kunders ISO-certifieringar samtidigt
- **Pain point:** Hålla koll på regeländringar för flera branscher
- **Value:** Centraliserad ändringsbevakning, mallar för olika branscher

**Tab 3: Offentlig sektor (kommuner, regioner, statliga bolag)**
- **Use case:** Kommun HR-chef med 500+ anställda, måste följa OSL, LOU, arbetsmiljölagar
- **Pain point:** Komplex lagefterlevnad, revisionsansvar
- **Value:** Revision-redo dokumentation, ändringslogg, teamsamarbete

---

### Law Wiki Navigation

**Structure:** E-commerce category pattern with faceted search

**URL Structure:**
```
/lagar - Main hub
/lagar/arbetsmiljo - Category page (e.g., Work Environment)
/lagar/arbetsmiljo/arbetsmiljolagen-1977-1160 - Individual law page
```

**Category Page Elements:**
- H1: "Arbetsmiljölagar för svenska företag"
- Intro text (200-300 words, SEO-rich)
- Faceted filters: By industry, by company size, by relevance
- Law cards (visual preview, click to full page)
- Related categories
- FAQ section (rich snippets)

**Individual Law Page Elements:**
- Full law text (SFS from Riksdagen)
- AI-generated contextual comment (personalized if logged in, generic if not)
- Related laws sidebar
- "Lägg till i min laglista" CTA (requires login)
- Ändringshistorik (change history)
- Breadcrumbs for navigation

**SEO Strategy:** Each page ranks independently → 10,000+ entry points for organic traffic

---

### Navigation

**Top Nav (Sticky):**
- Logo
- Features
- Pricing
- About
- Login
- Sign up (CTA button style)

**Footer:**
- Links: About, Contact, Privacy, Terms, Blog/Resources
- Newsletter signup (optional)
- Social media links

**Legal Disclaimer (Prominent in Footer):**
```
⚖️ Juridisk ansvarsfriskrivning
Laglig.se tillhandahåller AI-stödd information baserad på svenska lagar och förordningar.
Informationen är avsedd som vägledning och ersätter inte professionell juridisk rådgivning.
För specifika juridiska frågor eller tolkning av lagar i enskilda fall, konsulta alltid en behörig jurist.
```

**Also appears:**
- Chat interface (before first AI message)
- Terms of Service page
- Onboarding completion screen

---

---

## Dynamic Onboarding Widget

### Overview

**Purpose:** Convert homepage visitors into trial users through interactive, streaming generation experience

**Placement:** Embedded directly below hero section (mid-screen, above-the-fold on desktop)

**Total Duration:** ~60 seconds from input to preview

**Key Innovation:** Live streaming of law list generation with progress visualization and excitement copy

---

### Step 1: Initial Input Form

**Visual:**
```
┌─────────────────────────────────────────────┐
│  Se din personliga laglista på 60 sekunder  │
│                                             │
│  [Organisationsnummer] _________________    │
│  [Företagets webbplats] _________________   │
│                                             │
│          [Se min laglista →]                │
│                                             │
│  ✓ 14 dagar gratis provperiod              │
│  ✓ Inget betalkort krävs                   │
└─────────────────────────────────────────────┘
```

**Fields:**
- **Org-number:** Format validation (XXXXXX-XXXX), real-time check
- **Website URL:** Optional but recommended, auto-add https:// if missing

**CTA:** "Se min laglista" (action-oriented, personalized)

---

### Step 2: Streaming Generation (The Magic Moment)

**Visual State:**
```
┌─────────────────────────────────────────────┐
│  Skapar din profil...                       │
│                                             │
│  [████████░░░░░░░░░░] 40%                   │
│                                             │
│  ✓ Hämtar företagsdata från Bolagsverket   │
│  → Analyserar din bransch och verksamhet    │
│  ○ Genererar personlig laglista            │
│  ○ Skapar kontextuella kommentarer         │
│                                             │
│  [Live preview area - law cards streaming]  │
└─────────────────────────────────────────────┘
```

**Progress Stages (4 steps, ~15 seconds total):**

**Stage 1: Fetch Company Data (0-25%)**
- Call Bolagsverket API with org-number
- Extract: Company name, industry (SNI code), registration date, size
- Status: "✓ Hämtar företagsdata från Bolagsverket"

**Stage 2: Analyze Business Context (25-50%)**
- If URL provided: Scrape website meta description, key content
- Map SNI code → industry category
- **Dynamic questions appear:**
  ```
  "Vi ser att ni är ett [restaurangföretag]. Serverar ni alkohol?"
  [Ja] [Nej]

  "Hur många anställda har ni?"
  [1-5] [6-20] [21-50] [50+]
  ```
- Status: "→ Analyserar din bransch och verksamhet"

**Stage 3: Generate Law List (50-85%)**
- RAG query: "Swedish laws relevant to [industry] with [employee count]"
- Retrieve 30-50 laws, rank by relevance
- **Law cards stream in (one every 0.5 seconds):**
  ```
  [Law Card Preview]
  ┌────────────────────────────┐
  │ Arbetsmiljölagen (1977:1160) │
  │ Arbetsgivarens ansvar för... │
  │ 🔗 Hög relevans för dig      │
  └────────────────────────────┘
  ```
- Status: "→ Genererar personlig laglista"

**Stage 4: Generate Contextual Comments (85-100%)**
- For each law, generate AI comment: "Som [restaurang med 12 anställda], denna lag innebär att..."
- Status: "→ Skapar kontextuella kommentarer"

**Animation Details:**
- **Progress bar:** Smooth animation, brand color, shows percentage + time remaining
- **Live streaming:** Cards "slide up" into view with fade-in effect
- **After 10 cards:** Show "... och [X] lagar till"

**Excitement Copy (appears at milestones):**
```
[At 50%]: "Wow! Vi hittade redan 23 relevanta lagar för ditt företag"
[At 85%]: "Nästan klart! Lägger till personliga kommentarer..."
[At 100%]: "✓ Färdigt! Din unika laglista är redo"
```

---

### Step 3: Summary & Preview (The Hook)

**Visual:**
```
┌─────────────────────────────────────────────┐
│  ✓ Din laglista är klar!                    │
│                                             │
│  [Company Name]                             │
│  Bransch: Restaurang                        │
│  Anställda: 12                              │
│                                             │
│  📊 Din profil:                             │
│  • 47 relevanta lagar identifierade        │
│  • 12 högprioriterade arbetsmiljökrav      │
│  • 8 lagar ändrade senaste 6 månaderna     │
│                                             │
│  Vi har analyserat din verksamhet och       │
│  identifierat de lagar som är mest kritiska │
│  för just ditt företag.                     │
│                                             │
│  [Preview: 5-10 law cards shown below]      │
│                                             │
│  ... och 42 lagar till                      │
│                                             │
│  [Se hela listan och aktivera AI-verktyg →] │
│                                             │
│  ✓ 14 dagar gratis provperiod              │
└─────────────────────────────────────────────┘
```

**Preview Cards (5-10 shown):**
- Law title + SFS number
- Contextual comment (truncated, "... läs mer")
- Relevance indicator (Hög/Medel)
- Visual: Greyed out/locked appearance (teaser)

---

### Step 4: Trial Gate (Email Capture)

**Modal/Inline Form:**
```
┌─────────────────────────────────────────────┐
│  Slutför registrering                       │
│                                             │
│  [E-post] ___________________________       │
│  [Lösenord] _________________________       │
│  [Företagsnamn] ______________________      │
│                                             │
│  Välj plan:                                 │
│  ○ Basic (399 SEK/mån) - 1 användare        │
│  ● Pro (899 SEK/mån) - 5 användare          │
│  ○ Enterprise (Kontakta oss)                │
│                                             │
│  ✓ 14 dagar gratis provperiod               │
│  ✓ Inget betalkort krävs nu                │
│                                             │
│  [Starta min provperiod →]                  │
│                                             │
│  □ Jag godkänner användarvillkor och        │
│    integritetspolicy                        │
└─────────────────────────────────────────────┘
```

**Fields:**
- Email (validated, confirmation sent)
- Password (min 8 characters, strength indicator)
- Company name (pre-filled from Bolagsverket if available)
- Tier selection (default to Pro for better conversion)

**After Submission:**
- Create account in database
- Store generated law list
- Send to dashboard with full trial access
- Welcome email with getting started guide

---

### Technical Implementation

**Backend Workflow:**

**API Endpoint:** `POST /api/onboarding/generate-profile`
- **Input:** `{ orgNumber, websiteUrl, answers: {...} }`
- **Process:**
  1. Fetch Bolagsverket data
  2. Scrape website URL (if provided)
  3. RAG query for relevant laws
  4. Generate AI contextual comments
- **Output:** Streaming JSON with progress updates

**Streaming:**
- Vercel AI SDK `StreamingTextResponse`
- Stream progress: `{ stage: "analyzing", progress: 40, message: "..." }`
- Stream law cards as generated

**Database:**
- Create temporary profile (pre-signup) with UUID
- Store in session or temp table
- Convert to full account on trial signup
- Associate law list with new user

**Frontend:**

**Components:**
- `OnboardingWidget.tsx` (parent)
- `InputForm.tsx` (Step 1)
- `StreamingGeneration.tsx` (Step 2)
- `PreviewSummary.tsx` (Step 3)
- `TrialGate.tsx` (Step 4)

**Animation Libraries:**
- Framer Motion for card animations
- React Spring for progress bar
- CSS transitions for state changes

**State Management:**
- useState for current step
- Custom useStreaming hook
- React Hook Form for validation

---

### Error Handling

**Error Scenarios:**

1. **Invalid org-number:**
   - Error: "Organisationsnummer hittades inte. Kontrollera formatet (XXXXXX-XXXX)"
   - Fallback: Allow manual company name entry

2. **Website unreachable:**
   - Proceed without website scraping
   - Ask additional questions to compensate

3. **RAG query timeout:**
   - Show generic law list based on industry
   - Message: "Vi skapar en anpassad lista baserat på din bransch"

4. **User abandons mid-generation:**
   - Save progress in localStorage
   - Resume if return within 24 hours

---

### Success Metrics (KPIs)

**Track:**
1. **Widget engagement rate:** % of visitors who start onboarding
2. **Completion rate:** % who reach preview
3. **Trial conversion rate:** % who sign up after preview
4. **Time to preview:** Average seconds from start to preview
5. **Drop-off points:** Where users abandon

**Target Benchmarks:**
- Widget engagement: 15-25%
- Completion rate: 70-80%
- Trial conversion: 30-50%
- Time to preview: 45-60 seconds

---

---

## Pricing Strategy

### Tier Structure

#### **Basic - 399 SEK/mån (3,990 SEK/år)**

**Target:** Solo SMB owners, freelancers, very small companies (1-10 employees)

**Included:**
- ✅ 1 användare
- ✅ AI-assistent (RAG-baserad, hallucineringsfri)
- ✅ Personlig laglista med kontextuella kommentarer
- ✅ Ändringsbevakning med e-postnotiser
- ✅ Kanban-arbetsyta
- ✅ 10,000+ lagar indexerade
- ✅ E-postsupport (svar inom 48h)

**Limitations:**
- ❌ Ingen HR-modul
- ❌ Inget teamsamarbete
- ❌ Begränsad AI-chathistorik (30 dagar)

---

#### **Pro - 899 SEK/mån (8,990 SEK/år)**

**Target:** Growing SMBs, ISO consultants, small HR teams

**Included:**
- ✅ 5 användare
- ✅ Allt i Basic
- ✅ HR-modul (medarbetarhantering)
- ✅ Teamsamarbete (kommentarer, @mentions, uppgiftstilldelning)
- ✅ Obegränsad AI-chathistorik
- ✅ Prioriterad e-postsupport (svar inom 24h)
- ✅ Export-funktioner (PDF, Excel)
- ✅ Anpassade vyer och filter

**Sweet spot:** Best value for most customers

---

#### **Enterprise - Kontakta oss**

**Target:** Large companies (50+ employees), public sector, multi-site organizations

**Included:**
- ✅ Obegränsat antal användare
- ✅ Allt i Pro
- ✅ API-integration (Fortnox, Visma, etc.)
- ✅ Dedikerad onboarding och utbildning
- ✅ SLA-avtal (99.9% uptime)
- ✅ Dedikerad Customer Success Manager
- ✅ Anpassad fakturering (månadsfaktura, årsavtal)
- ✅ SSO (Single Sign-On) via Azure AD/Google Workspace
- ✅ Telefonsupport

**Pricing Strategy:**
- Base: 4,000 SEK/mån (public sector direktupphandling threshold)
- Volume pricing: Negotiated based on users and requirements
- Annual contracts preferred

**Qualification Criteria:**
```
Enterprise är för dig som har:
• 50+ anställda
• Offentlig sektor (kommun, region, statligt bolag)
• Behov av API-integrationer
• Krav på SLA och dedikerad support
```

---

### Annual Payment Discount (17%)

**Pricing Table:**

| Tier | Monthly | Annual | Saving |
|------|---------|--------|--------|
| Basic | 399 SEK/mån | 3,990 SEK/år | 798 SEK (2 månader gratis) |
| Pro | 899 SEK/mån | 8,990 SEK/år | 1,798 SEK (2 månader gratis) |

**Benefits:**
- ✅ Immediate cashflow (~300k SEK upfront in year 1)
- ✅ Lower churn (annual commitment)
- ✅ Customer saves 17% (2 months free)

**Implementation:**
- Toggle on pricing page: [Månadsvis] [Årsvis - Spara 17%]
- Annual customers pay upfront
- Offer annual option at trial-to-paid conversion

---

### Pricing Page Design

**Visual Structure:**
```
┌─────────────────────────────────────────────────────────┐
│              Prissättning som passar ditt företag        │
│                                                          │
│          [Månadsvis]  [Årsvis - Spara 17% ✓]            │
│                                                          │
├──────────────┬──────────────┬──────────────────────────┤
│    Basic     │     Pro      │      Enterprise          │
│  399 SEK/mån │  899 SEK/mån │    Kontakta oss          │
│              │              │                          │
│ Perfekt för  │ Bäst för     │ För större organisationer│
│ små företag  │ växande team │ och offentlig sektor     │
│              │              │                          │
│ ✓ 1 användare│ ✓ 5 användare│ ✓ Obegränsat användare   │
│ ✓ AI-assistent│ ✓ HR-modul  │ ✓ API-integration        │
│ ✓ Laglista   │ ✓ Team-      │ ✓ SLA-avtal              │
│ ✓ Ändrings-  │   samarbete  │ ✓ Dedikerad support      │
│   bevakning  │ ✓ Allt i     │ ✓ Anpassad onboarding    │
│ ✓ Kanban     │   Basic      │ ✓ Allt i Pro             │
│              │              │                          │
│ [Starta 14   │ [Starta 14   │ [Boka demo →]            │
│  dagars gratis│  dagars gratis│                         │
│  provperiod] │  provperiod] │                          │
└──────────────┴──────────────┴──────────────────────────┘

           ✓ 14 dagars gratis provperiod
           ✓ Inget betalkort krävs
           ✓ Avsluta när som helst
```

**Below Pricing Tiers:**
- FAQ section (address common objections)
- Feature comparison table (detailed)
- "Vilken plan passar mig?" guide

---

---

## Trial Mechanics

### Trial Duration: 14 Days

**Rationale:**
- ✅ Sufficient time to explore all features
- ✅ Experience AI chat across multiple use cases
- ✅ Set up HR module and add employees
- ✅ Potentially see law change notifications
- ✅ Invite team members (Pro tier)
- ✅ Industry standard for SaaS trials

---

### Trial Access & Limitations

**Full Feature Access:**
- All tier features unlocked (Basic, Pro, or Enterprise based on selection)
- Complete law list access
- HR module, team collaboration, Kanban workspace
- Full AI chat functionality

**Rate Limit: 100 AI Chat Queries During Trial**

**Implementation:**
- Counter in chat interface: "47/100 frågor kvar i provperioden"
- At 80 queries: "Du har använt 80% av dina provfrågor. Uppgradera för obegränsad åtkomst."
- At 100 queries: Soft block with CTA:
  ```
  Du har nått gränsen för provfrågor (100)

  Fortsätt använda AI-assistenten genom att uppgradera till [Pro-plan]

  [Uppgradera nu] [Fortsätt utan AI-chat]
  ```

**Rationale:** 100 queries = ~7 questions/day = meaningful exploration without abuse. Users over 100 are highly engaged and likely to convert.

---

### Trial Signup (No Credit Card Required)

**Signup Requirements:**
- Email (verified via confirmation link)
- Password (min 8 characters)
- Company name (pre-filled from onboarding)
- Tier selection (Basic or Pro trial)

**Why No Credit Card:**
- ✅ Lower friction = higher trial signups
- ✅ Builds trust (no surprise charges)
- ✅ Conversion via value demonstration + email nurture

**After 14 Days:**
- Trial expires → "expired trial" state
- User can login and view data (read-only)
- Banner: "Din provperiod har gått ut. Uppgradera för att fortsätta använda Laglig.se"
- Cannot use AI chat, edit law lists, or premium features

---

### Trial-to-Paid Conversion Strategy

**Email Nurture Sequence (Automated):**

**Day 1 - Welcome**
- Subject: "Välkommen till Laglig.se! Här är dina första steg"
- Content: Getting started guide, video tour, key features
- CTA: "Utforska din laglista"

**Day 3 - Feature Highlight**
- Subject: "Visste du att AI-assistenten kan svara på specifika lagfrågor?"
- Content: AI chat tutorial, example questions, best practices
- CTA: "Prova AI-assistenten nu"

**Day 7 - Mid-Trial Check-in**
- Subject: "Du har 7 dagar kvar av din provperiod"
- Content: Usage stats (X laws reviewed, Y questions asked), suggest unexplored features
- CTA: "Utforska HR-modulen" (if not used yet)

**Day 10 - Social Proof**
- Subject: "Så här använder andra företag Laglig.se"
- Content: Case study, testimonial, ROI example
- CTA: "Uppgradera till Pro"

**Day 12 - Urgency**
- Subject: "2 dagar kvar av din provperiod - fortsätt med 17% rabatt"
- Content: Annual discount offer, remind of value
- CTA: "Uppgradera nu och spara"

**Day 14 - Expiration**
- Subject: "Din provperiod har gått ut - fortsätt använda Laglig.se"
- Content: Summary of value, easy upgrade CTA
- CTA: "Återaktivera mitt konto"

**Day 16 - Post-Expiration**
- Subject: "Vi saknar dig! Återkom med 10% rabatt på första månaden"
- Content: Limited-time offer
- CTA: "Kom tillbaka till Laglig.se"

**Day 21 - Final Attempt**
- Subject: "Sista chansen att återaktivera ditt konto"
- Content: Data retention notice (deleted after 30 days)
- CTA: "Återaktivera nu"

---

### Pro Tier: Sales Team Lead Routing

**Qualification Criteria for Sales Follow-up:**
- Company size: 20+ employees (from Bolagsverket data)
- Industry: High-value sectors (construction, manufacturing, healthcare)
- Usage: >50 AI queries in first 7 days (high engagement)
- Team: Invited 3+ team members (collaboration signal)

**Sales Action (Day 5 of Trial):**
- CRM notification: "High-value Pro trial: [Company Name]"
- Sales rep sends personalized email:
  ```
  Hej [Name],

  Jag ser att ni utforskar Laglig.se Pro. Kan jag boka 15 minuter
  för att visa er hur vi kan skräddarsy lösningen för [industry]?
  ```
- Offer: Personal demo, answer questions, discuss Enterprise if relevant

**Goal:** Convert high-intent trials to annual contracts via human touch

---

### Enterprise Tier: Demo-First Approach

**No Self-Serve Trial for Enterprise**

**Flow:**
1. User selects "Enterprise" on pricing page
2. Redirect to Calendly: "Boka demo med vårt team"
3. Demo call (30 min):
   - Understand requirements
   - Show product tailored to use case
   - Discuss pricing (base 4,000 SEK/mån + volume)
4. Custom trial environment (if needed):
   - SSO setup
   - Multi-user access
   - 30-day trial (longer for public sector procurement)
5. Sales follow-up and contract negotiation

---

---

## Revenue Impact

### Updated ARR Calculations (with annual discount)

**Assumptions:** 30% of customers choose annual payment

**Basic Tier (150 customers):**
- 105 monthly: 105 × 399 × 12 = 502,740 SEK
- 45 annual: 45 × 3,990 = 179,550 SEK
- **Subtotal: 682,290 SEK**

**Pro Tier (50 customers):**
- 35 monthly: 35 × 899 × 12 = 377,580 SEK
- 15 annual: 15 × 8,990 = 134,850 SEK
- **Subtotal: 512,430 SEK**

**Enterprise (60 organizations @ 4,000 SEK/mån):**
- Mostly annual: 60 × 48,000 = 2,880,000 SEK

**Fortnox (500 customers @ 375 SEK/mån net):**
- 500 × 375 × 12 = 2,250,000 SEK

**Total ARR: ~6.3M SEK** (conservative, midpoint to 18-month 10M target)

**Annual Payment Benefits:**
- Improved cashflow: ~300k SEK upfront in year 1
- Lower churn (annual commitment)
- Customer saves 17% (2 months free)

---

---

## Next Steps

### Remaining Features to Specify

1. **Dashboard/Workspace** - Main authenticated user interface
2. **AI Chat Interface** - Drag-and-drop, component streaming, RAG integration
3. **Law Pages** - 10k+ SEO content structure
4. **HR Module** - Employee management workflow
5. **Change Monitoring System** - Notification engine
6. **User/Team Management** - Roles, permissions, billing

### Implementation Priority

**Phase 1 (Week 1-4):**
- Homepage structure
- Law pages (basic rendering)
- Onboarding widget backend

**Phase 2 (Week 5-8):**
- Onboarding widget frontend (streaming)
- Dashboard/Workspace
- Trial signup flow

**Phase 3 (Week 9-12):**
- AI Chat interface
- Change monitoring
- HR module

**Phase 4 (Week 13-16):**
- User/team management
- Billing integration (Stripe)
- Email nurture sequences

---

**Status:** Ready for PRD handoff to Product Manager/Developer agent
