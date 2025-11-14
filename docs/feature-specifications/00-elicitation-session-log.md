# Elicitation Session Log - Homepage & Onboarding

**Date:** 2025-10-28
**Agent:** Mary (Business Analyst)
**Duration:** ~2 hours
**Method:** Structured Q&A elicitation with iterative refinement

---

## Session Overview

This document captures the complete elicitation conversation where we defined the Homepage/Landing Page, Dynamic Onboarding Widget, Pricing Strategy, and Trial Mechanics in detail.

**Starting Context:**

- Project Brief completed (docs/brief.md)
- 8 MVP features identified
- Ready to define features/pages in detail for PRD creation

**Goal:** Create comprehensive specifications for all features/pages before PRD creation

---

## Part 1: Initial Feature Selection

**Mary's Question:** Which feature/page would you like to start with?

**Options Presented:**

1. Homepage/Landing page
2. Dynamic Onboarding Flow
3. Dashboard/Workspace
4. AI Chat Interface
5. Law Pages
6. HR Module
7. Change Monitoring System
8. User/Team Management
9. All of the above

**Your Answer:** **1** (Homepage/Landing page)

---

## Part 2: Homepage Elicitation - Q&A Session

### Section 1: Hero Section

**Mary's Questions:**

**Q1: Hero Message & Value Proposition**

- What's the primary headline?
- What's the subheadline?
- Should we lead with problem or solution?
- Do we mention "free legal content + paid AI tools" upfront?

**Your Answer:**

- Headline: "Vi håller koll på lagarna – du håller koll på affären. Compliance utan krångel."
- No mention of free legal content for now

**Q2: Hero CTA**

- Primary CTA button text?
- Where does it lead?
- Secondary CTA?
- Should onboarding START directly on homepage?

**Your Answer:**

- Primary: "Se din laglista" (prompts onboarding with org-number + url + dynamic questionnaire)
- Secondary: "Våra verktyg" (list of features)
- Yes, onboarding should start directly on homepage to lower barrier

**Q3: Hero Visual**

- Screenshot, animated demo, video explainer, or illustration?

**Your Answer:**

- Animated video of component streaming (can revisit later)
- Video explainer further down page with illustrations/graphics

---

### Section 2: Social Proof & Trust

**Q4: Trust Signals**

- Customer logos, testimonials, stats, security badges?

**Your Answer:**

- Show customer list when available (focus on public sector)
- Testimonials post-launch
- Stats: 100,000+ laws indexed, X unique lists generated (inflate initially)

**Mary's Feedback/Suggestion:**

- ⚠️ Warning about inflating numbers - could backfire
- Suggested authentic alternatives:
  - "10,000+ lagparagrafer indexerade" (verifiable)
  - "Uppdateras dagligen från Riksdagen" (process claim)
  - Wait for real customer numbers before showing "lists generated"

**Your Response:**

- Agreed - it's not amount of laws, but "unique lists generated" for customers
- If we don't have many customers, number will be small (acknowledged risk)

---

### Section 3: Problem/Solution Presentation

**Q5: How to present the problem?**

- Pain point section, story-driven, statistics, or skip?

**Your Answer:**

- Pain-point section with wide appeal
- Statistics focused on cost of mistakes (fines, lawyer fees, administrative burden)

**Mary's Suggestion:**

- Add emotional pain points alongside financial:
  - Financial: Fines, lawyer costs, admin time
  - Emotional: Uncertainty, overwhelm, frustration

**Your Response:**

- Good, add that

**Q6: How to present the solution?**

- Feature list, "How it works" process, interactive demo, or comparison?

**Your Answer:**

- Feature list + How it works + How our tech gives you control and peace of mind

---

### Section 4: Feature Showcase

**Q7: Which features to highlight?**

**Your Answer:**

- Personalized lawlist, unique for your business (with contextual comments)
- Change monitoring with notifications
- Kanban workspace to review compliance and assign tasks
- AI chatbot trained on laws and your company, RAG-based only with full guardrails (no hallucinations)
- HR-module
- Team collaboration

**Mary's Suggestion:**

- Reorder to lead with AI chatbot (most unique differentiator)
- Emphasize RAG backbone that eliminates hallucinations

**Your Response:**

- Ok, change that
- AI-bot needs to be highlighted as specially built model using RAG backbone to eliminate hallucinations and give correct answers ONLY

**Q8: How to present each feature?**

- Screenshot + description, GIF/video, icon + text, or interactive?

**Your Answer (initially):** Icon + Headline + description for now

**Mary's Suggestion:**

- Option A: Expandable accordion (click to see GIF + details)
- Option B: Hover state with preview

**Your Response:**

- Option A (expandable accordion)

---

### Section 5: Segment-Specific Messaging

**Q9: Address different user segments?**

- Separate sections, tabs, or unified message?

**Your Answer:**

- Add segment tabs yes

**Mary's Suggestion:**

- Tab 1: SMB (10-50 employees)
- Tab 2: ISO consultants
- Tab 3: Public sector (kommuner, regioner)
- Each tab shows specific use cases

**Your Response:**

- Agreed

---

### Section 6: Free vs. Paid Clarity

**Q10: How to communicate freemium model?**

**Your Answer:**

- Pricing on homepage, 1 week free trial

**Mary's Clarification Questions:**

- Full pricing table or summary?
- Show all 3 tiers?
- What are tier names and prices?

**Your Answer:**

- All tiers: Basic/Pro/Enterprise
- Enterprise for large businesses or public sector, price negotiated
- Basic around 399, Pro around 899
- Can discuss onboarding flow and other suggestions in detail

**Mary's Suggestion:**

- [Hero]: "1 vecka gratis – ingen bindningstid"
- [Mid-page]: Pricing summary
- [Footer]: Link to full pricing page

**Your Response:**

- "Add your other suggestions on this matter" (led to detailed pricing discussion later)

---

### Section 7: Onboarding Integration

**Q11: Does onboarding START on homepage?**

**Mary's Options:**

- Option A: Embedded widget on homepage
- Option B: CTA leads to dedicated /onboarding page

**Your Answer (detailed):**

- **Widget placement:** Embedded feel directly under hero message, mid-screen
- **User flow:** Input info → streaming generation of profile/list
- **Animations:** Good animations to look "alive" while working (profile setup, lawlist generation, DB storage)
- **Progress visualization:** Progress bar showing "the magic"
- **Summary at end:** Number of relevant laws, business summary based on URL scraping + interview questions
- **Goal:** Give user sensation that we really know them by now
- **Trial gate:** Show partial preview (5-10 law cards), push for trial

**Mary's Detailed Follow-up:**

- Specified 4-stage streaming process (0-25%, 25-50%, 50-85%, 85-100%)
- Excitement copy at milestones
- Law cards streaming in one-by-one
- Dynamic questions during Stage 2
- Preview format with summary stats

**Your Response:**

- Confirmed this approach

---

### Section 8: Navigation & Footer

**Q12: Navigation structure**

**Your Answer:**

- Top nav: Logo, Features, Pricing, About, Login, Sign up
- Sticky nav
- Browse laws: Built like "wiki" with category pages (e-commerce style), search/filtering, facets based on tags

**Mary's Enhancement:**

- Law wiki URL structure: `/lagar/[category]/[law-name]`
- Category pages with faceted filtering
- Individual law pages with full text + AI comments
- SEO strategy: 10k+ entry points

**Your Response:**

- Awesome, this is what I want yes

**Q13: Footer content**

**Your Answer:**

- Looks good

**Mary's Addition:**

- Strong legal disclaimer in footer and Terms of Service

**Your Response:**

- Add strong legal disclaimer in footer and ToS when we get there

---

## Part 3: Mary's Strategic Analysis & Refinement

After collecting your answers, Mary provided strategic feedback:

### ✅ Strong Decisions Affirmed:

1. Swedish headline "Vi håller koll på lagarna – du håller koll på affären"
2. "Se din laglista" CTA with embedded onboarding
3. Triple approach: Features + How it works + Tech trust
4. Embedded onboarding widget (called it "GOLD")
5. Wiki structure for law browsing (SEO goldmine)

### 💡 Suggestions Made:

**Q1 Enhancement:**

- Add secondary line: "AI-driven lagefterlevnad som anpassar sig efter just ditt företag"
- **Your response:** Agree, add that

**Q2 Secondary CTA:**

- Change "Våra verktyg" to "Utforska funktioner" (more dynamic)
- **Your response:** Utforska funktioner

**Q4 Stats Warning:**

- Don't inflate numbers, use verifiable metrics
- **Your response:** Acknowledged - "unique lists generated" depends on real customers

**Q5 Emotional Pain:**

- Add emotional alongside financial pain points
- **Your response:** Good, add that

**Q7 Feature Order:**

- Lead with AI chatbot (most differentiated)
- **Your response:** Ok, change that. Emphasize RAG backbone.

**Q8 Interactivity:**

- Add expandable accordion for features
- **Your response:** Option A

**Q9 Segment Tabs:**

- Add subtle segment navigation
- **Your response:** Add this yes

**Q10 Pricing Detail:**

- Led to comprehensive pricing discussion (see below)

**Q11 Onboarding UX:**

- Detailed 4-stage streaming specification
- Preview mechanics (5-10 cards shown)
- Trial gate strategy
- **Your response:** Confirmed approach

**Q12 Law Wiki:**

- E-commerce category pattern, URL structure, faceted filtering
- **Your response:** Awesome, this is what I want yes

**Q13 Legal Disclaimer:**

- Prominent footer disclaimer
- **Your response:** Add strong disclaimer in footer and ToS

---

## Part 4: Pricing Deep Dive (Q10 Follow-up)

### Initial Context

Mary asked 5 clarifying questions about pricing strategy:

**Q10.1: Trial Duration**

- Mary: Is 1 week enough? Suggested 14 days for better exploration
- **Your answer:** "Lets go 14 days, you are right"

**Q10.2: Trial Limitations**

- Mary: Full access or gated? Suggested rate-limit to prevent abuse
- **Your answer:** "Full access but rate-limit chat to 100 queries during trial. If someone is over 100, they are likely hooked and will stay as paying member."

**Q10.3: Trial-to-Paid Conversion**

- Mary: Credit card required? Auto-convert or manual?
- **Your answer:** "No card for signup, prompt signup after 14 days, ensure good nurturing automations around this. For pro tiers, leads could be logged for our salesteam to contact."

**Q10.4: Enterprise Tier**

- Mary: Qualification criteria? Pricing strategy?
- **Your answer:** "Show typical 'enterprise' tier, 50+ employees, suited for government use, etc. We can polish this post MVP as first sales cycle will be outreach by sales team most likely."

**Q10.5: Annual Payment Discount**

- Mary: Offer upfront payment discount for cashflow?
- **Your answer:** "Add yearly 17% discount for upfront payments"

### Mary's Consolidated Pricing Strategy

Based on your answers, Mary created:

**Tier Structure:**

- Basic: 399 SEK/mån (3,990 SEK/år with 17% discount)
- Pro: 899 SEK/mån (8,990 SEK/år with 17% discount)
- Enterprise: Custom (base 4,000 SEK/mån for public sector)

**Trial Mechanics:**

- 14 days (changed from 1 week)
- 100 AI query limit
- No credit card required
- Full feature access
- Manual conversion after expiration

**Email Nurture:**

- 7-email sequence over 21 days
- Day 1: Welcome
- Day 3: Feature highlight
- Day 7: Mid-trial check-in
- Day 10: Social proof
- Day 12: Urgency + annual discount
- Day 14: Expiration
- Day 16: Win-back offer
- Day 21: Final attempt

**Sales Team Routing:**

- Pro tier trials with high engagement → CRM notification
- Sales rep reaches out Day 5 for personalized demo
- Goal: Convert to annual contracts

**Enterprise Approach:**

- No self-serve trial
- Demo-first (Calendly booking)
- Custom trial environment if needed (30 days)
- Sales-led negotiation

---

## Part 5: Onboarding Widget Deep Dive (Q11 Detailed Spec)

Based on your Q11 answer about embedded widget, Mary created comprehensive specification:

### Your Vision (Summary):

- Widget embedded under hero, mid-screen
- User inputs org-number + URL
- Streaming generation with good animations
- Progress bar showing "the magic"
- Summary at end with stats
- Preview 5-10 law cards
- Trial gate to access full list

### Mary's Detailed Specification:

**Step 1: Input Form**

- Org-number field (validation)
- Website URL (optional)
- CTA: "Se min laglista"

**Step 2: Streaming Generation (4 stages)**

**Stage 1 (0-25%): Fetch Company Data**

- Call Bolagsverket API
- Extract company name, industry, size
- Status: "✓ Hämtar företagsdata från Bolagsverket"

**Stage 2 (25-50%): Analyze Context**

- Scrape website if URL provided
- Map industry to category
- **Dynamic questions appear:**
  - "Serverar ni alkohol?" [Ja] [Nej]
  - "Hur många anställda?" [1-5] [6-20] [21-50] [50+]
- Status: "→ Analyserar din bransch och verksamhet"

**Stage 3 (50-85%): Generate Law List**

- RAG query for relevant laws
- Stream law cards in one-by-one (every 0.5 seconds)
- Show first 10 cards, then "... och X lagar till"
- Status: "→ Genererar personlig laglista"

**Stage 4 (85-100%): Generate Comments**

- AI creates contextual comments for each law
- Status: "→ Skapar kontextuella kommentarer"

**Excitement Copy:**

- At 50%: "Wow! Vi hittade redan 23 relevanta lagar för ditt företag"
- At 85%: "Nästan klart! Lägger till personliga kommentarer..."
- At 100%: "✓ Färdigt! Din unika laglista är redo"

**Step 3: Summary & Preview**

- Company profile summary
- Stats: "47 relevanta lagar, 12 högprioriterade, 8 ändrade senaste 6 månader"
- Preview 5-10 law cards (greyed out/locked)
- "... och 42 lagar till"
- CTA: "Se hela listan och aktivera AI-verktyg"

**Step 4: Trial Gate**

- Email + Password + Company name
- Tier selection (Basic/Pro/Enterprise)
- Checkbox: Accept terms
- CTA: "Starta min provperiod"
- Creates account, stores law list, sends to dashboard

### Technical Details Mary Added:

- API endpoint: `POST /api/onboarding/generate-profile`
- Vercel AI SDK streaming
- React component structure
- Animation libraries (Framer Motion, React Spring)
- Error handling (invalid org-number, website unreachable, timeout)
- Success metrics (engagement rate, completion rate, conversion rate)

---

## Part 6: Your Final Responses to Refinements

After Mary presented all suggestions and detailed specs, you provided final confirmations:

**Q1:** "I agree, add that" (secondary headline)
**Q2:** "Utforska funktioner" (secondary CTA)
**Q4:** Acknowledged stats concern (unique lists depends on customers)
**Q5:** "Good, add that" (emotional pain points)
**Q7:** "Ok, change that" + emphasized RAG backbone
**Q8:** "Option A" (expandable accordion)
**Q9:** "Add this yes" (segment tabs)
**Q10:** Detailed pricing answers (covered above)
**Q11:** Confirmed embedded widget approach with detailed UX
**Q12:** "Awesome, this is what I want yes" (law wiki structure)
**Q13:** "Add strong legal disclaimer in footer and ToS"

---

## Part 7: Key Design Principles Established

Through the elicitation, these principles emerged:

### UX Principles:

1. **Lower barriers aggressively** - Onboarding on homepage, no credit card
2. **Show the magic** - Streaming generation creates excitement
3. **Personalization signals trust** - "We know your business" feeling
4. **Preview before commitment** - 5-10 law cards visible before signup
5. **Visual, intuitive workflows** - Kanban, drag-and-drop, streaming

### Business Principles:

1. **14 days for exploration** - Long enough to experience value
2. **Rate limits prevent abuse** - 100 queries = engaged users
3. **No credit card = trust** - Conversion via value demonstration
4. **Annual discount = cashflow** - 17% discount drives upfront payment
5. **Human touch for high-value** - Sales team for Pro/Enterprise

### Technical Principles:

1. **RAG-only responses** - Zero hallucination tolerance
2. **Streaming everything** - Progress, cards, components
3. **Vercel AI SDK** - Built-in streaming, component support
4. **E-commerce patterns** - Faceted search, category pages for laws
5. **SEO-first** - 10k+ law pages = 10k+ entry points

### Brand Principles:

1. **Swedish, approachable** - "Coolt med koll" personality
2. **Clear about AI** - RAG backbone, no hallucinations
3. **Transparent disclaimers** - Not legal advice, visible everywhere
4. **Authentic metrics** - No inflated numbers
5. **Focus on peace of mind** - "Insurance with negligible cost"

---

## Part 8: Decisions That Changed During Discussion

### Changed From → Changed To:

1. **Trial duration:** 7 days → 14 days
   - Reason: More time needed to experience all features

2. **Trial AI access:** Unlimited → 100 queries
   - Reason: Prevents abuse, 100+ signals high engagement

3. **Stats strategy:** Inflate numbers → Use verifiable metrics only
   - Reason: Swedish business culture values authenticity

4. **Feature order:** Law list first → AI chatbot first
   - Reason: Lead with most differentiated feature

5. **Feature presentation:** Icon + text → Expandable accordion
   - Reason: Show interactivity without cluttering

6. **Pricing visibility:** Summary → Full table with all tiers
   - Reason: Transparency builds trust

7. **Secondary CTA:** "Våra verktyg" → "Utforska funktioner"
   - Reason: More action-oriented, invites curiosity

8. **Onboarding questions:** Static form → Dynamic questions during streaming
   - Reason: More engaging, feels conversational

9. **Public sector market:** 60 organizations → 600 organizations (from Brief update)
   - Reason: Larger addressable market than initially estimated

10. **Team structure:** Solo founder → Small team with dedicated public sector sales
    - Reason: Public sector requires dedicated sales effort

---

## Part 9: Open Questions Answered During Session

From the Brief's "Open Questions" section, we answered several:

**Q: What's the optimal AI chat context window?**

- Answer: Standard ChatGPT-style workflow (from Brief update)

**Q: How do we handle multi-law interactions?**

- Answer: Contextual summary, but always work with individual cards (from Brief update)

**Q: What's the onboarding flow for non-technical users?**

- Answer: Tutorial mode post-MVP after validation (from Brief update)

**Q: How granular should change monitoring be?**

- Answer: Every official amendment triggers notification (from Brief update)

**Q: Should HR module include payroll integration?**

- Answer: Pay levels only, no payroll management (from Brief update)

**Q: PostgreSQL pgvector vs. Pinecone?**

- Answer: Evaluate after MVP (from Brief update)

**Q: How do we handle real-time change detection?**

- Answer: Use Riksdagen API per official documentation (from Brief update)

**Q: Should we offer annual upfront payment discount?**

- Answer: Yes, 17% discount (2 months free) (answered in this session)

---

## Part 10: What Gets Specified Next

**Remaining 6 features to elicit:**

1. **Dashboard/Workspace** - Where users land after onboarding
2. **AI Chat Interface** - Drag-and-drop, component streaming, RAG integration
3. **Law Pages** - 10k+ SEO content structure and rendering
4. **HR Module** - Employee management workflow
5. **Change Monitoring System** - Notification engine and retention mechanics
6. **User/Team Management** - Roles, permissions, billing integration

**Recommended order:**

- Dashboard first (logical flow after onboarding)
- Then Chat (most complex, needs deep UX work)
- Then supporting features (Law Pages, HR, Change Monitoring, User Management)

**Estimated time:** 1-2 hours per feature using same structured Q&A approach

---

## How to Use This Log Tomorrow

### Quick Review (5 minutes):

1. Read "Session Overview" and "Part 10" to remember where we stopped
2. Scan "Part 9" to see what questions were answered
3. Review "Part 7" for key principles established

### Deep Review (20 minutes):

1. Read through all Q&A in Parts 2-6
2. Review your specific answers and Mary's refinements
3. Check "Decisions That Changed" to understand evolution

### Continue Elicitation:

1. Activate Mary: `/analyst`
2. Say: "Continue feature specifications - let's define Dashboard/Workspace next"
3. Mary will use same structured approach:
   - Present context
   - Ask systematic questions
   - Provide strategic feedback
   - Refine based on your responses
   - Document everything

### Reference During PRD Creation:

- This log shows WHY decisions were made, not just WHAT
- Use to explain rationale to team
- Reference when design/dev questions arise
- Cite specific Q&A when validating with customers

---

## Summary Stats

- **Questions asked by Mary:** ~25 major questions (13 homepage + 5 pricing + 7 onboarding details)
- **Decisions made:** ~40 specific design/business decisions
- **Suggestions provided by Mary:** ~15 strategic recommendations
- **Changes made based on feedback:** 10 decisions evolved during discussion
- **Final specification length:** 18,000+ words (01-homepage-and-onboarding.md)
- **Time invested:** ~2 hours of detailed elicitation
- **Clarity achieved:** Ready for PRD creation with minimal ambiguity

---

**This elicitation session established the foundation for Laglig.se's conversion funnel. The homepage and onboarding flow are now comprehensively defined and ready for implementation.**

---

**Next session: Dashboard/Workspace specification** 📊

**Agent:** Mary (Business Analyst)
**Date:** 2025-10-28
