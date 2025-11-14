# Epic 4: Dynamic Onboarding & Personalized Law Lists (DETAILED)

**Goal:** Create conversion engine that transforms homepage visitors into trial users through streaming law list generation.

**Value Delivered:** Visitors instantly see personalized law list without account creation + seamless trial signup converts interest into subscriptions.

---

## Story 4.1: Build Dynamic Onboarding Widget (Homepage)

**As a** visitor,
**I want** to enter my org-number on the homepage and see my personalized law list,
**so that** I can evaluate Laglig.se before signing up.

**Acceptance Criteria:**

1. Homepage includes prominent onboarding widget (hero section)
2. Widget headline: "Se vilka lagar som gäller för ditt företag"
3. Input field for Swedish org-number (10 digits, format: XXXXXX-XXXX)
4. Client-side validation: 10 digits, valid format
5. "Generera min laglista" CTA button (primary style)
6. Clicking CTA triggers API call, shows loading state
7. Loading animation: Streaming text "Hämtar företagsinfo...", "Analyserar bransch...", "Väljer relevanta lagar..."
8. Widget mobile-responsive
9. Privacy note: "Vi hämtar endast publik info från Bolagsverket"

---

## Story 4.2: Integrate Bolagsverket API for Company Data

**As a** system,
**I want** to fetch company data from Bolagsverket based on org-number,
**so that** I can personalize the law list without manual input.

**Acceptance Criteria:**

1. API endpoint created: `POST /api/onboarding/fetch-company`
2. Request body: `{ orgNumber: string }`
3. Integration with Bolagsverket API (or alternative Swedish company registry)
4. Fetch: company name, address, SNI code, legal form (AB, HB, etc.), employee count (if available)
5. Response format: `{ name, address, sniCode, legalForm, employeeCount }`
6. Error handling: Invalid org-number, company not found, API timeout
7. Fallback: If Bolagsverket API unavailable, prompt user to enter industry manually
8. Rate limiting: Max 100 requests/hour per IP
9. Logging: Successful fetches, errors to Sentry
10. Test with 10 real org-numbers (verify data accuracy)

## Story 4.2b: Implement Dynamic Contextual Questioning Flow

**As a** visitor,
**I want** to answer 3-5 contextual questions about my business during onboarding,
**so that** the AI can generate a highly accurate and comprehensive law list.

**Acceptance Criteria:**

1. After Bolagsverket data fetch, AI determines first question based on SNI code and employee count
2. Question selection logic implemented with GPT-4 or rule-based decision tree:
   - **Always ask:** "Hur många anställda har ni?" (if not in Bolagsverket data)
   - **Industry-triggered questions:** Based on SNI code
     - Restaurang (SNI 56.x): "Serverar ni alkohol?", "Har ni uteservering?", "Anställer ni personer under 18 år?"
     - Bygg (SNI 41-43): "Arbetar ni med farliga ämnen?", "Har ni underentreprenörer?", "Arbetar ni på höjd?"
     - E-handel (SNI 47.91): "Säljer ni till privatpersoner eller företag?", "Säljer ni till andra EU-länder?"
     - Vårdgivare (SNI 86-88): "Privat eller kommunal vårdgivare?", "Hanterar ni patientjournaler?"
   - **Employee-count-triggered questions:**
     - 1-9 employees: "Har ni kollektivavtal?"
     - 10-24 employees: "Har ni skyddsombud?" (required by law)
     - 25+ employees: "Har ni skyddskommitté?" (required by law)
   - **Follow-up questions:** Based on previous answers
     - If "Ja" to alcohol: "Vilken typ av serveringstillstånd?"
     - If "Ja" to subcontractors: "Kontrollerar ni deras F-skatt?"
3. Question UI displays:
   - Progress indicator: "Fråga 2 av ~4"
   - Contextual intro: "Eftersom ni har 12 anställda:"
   - Question text (large, clear Swedish)
   - Answer options (radio buttons or large buttons)
   - Educational tooltip: "💡 Med 10+ anställda krävs skyddsombud enligt Arbetsmiljölagen"
4. Laws stream into list as questions are answered (progressive value demonstration)
5. Each answer adds 3-8 new laws to streaming list with reason tags: "Gäller eftersom ni serverar alkohol"
6. Hard limit: Maximum 5 questions, then force to Phase 1 completion
7. User can go back to previous question, answers preserved, law list regenerates
8. "Hoppa över" option available with warning: "Vi kanske missar relevanta lagar"
9. "Vet inte" answer option includes law with "⚠️ Kan gälla dig - kontrollera" tag
10. Answers stored in `CompanyContext` object for downstream use (AI chat, notifications, analytics)
11. Session storage preserves partial progress (24-hour expiry) if user closes browser
12. Mobile-responsive question UI (large touch targets)
13. Question-answer flow completes in <2 minutes (target: avg 3-4 questions × 30 seconds each)
14. Test with 10 different industries: Verify questions are relevant and law lists accurate

**Technical Notes:**

- Question selection can be rule-based initially (if/then logic), GPT-4 as enhancement later
- Each question adds to streaming law generation, not batch at end
- Educational tooltips position Laglig.se as educator, not just tool

---

---

## Story 4.3: Implement Two-Phase AI-Powered Law List Generation

**As a** visitor,
**I want** the system to generate a comprehensive personalized law list in two phases,
**so that** I see value quickly (Phase 1) and get complete coverage after signup (Phase 2).

**Acceptance Criteria:**

**Phase 1 (Pre-Signup - High-Priority Laws):**

1. API endpoint created: `POST /api/onboarding/generate-law-list-phase1`
2. Request body: `{ sniCode, legalForm, employeeCount, companyName, contextualAnswers }`
3. Backend retrieves industry starter pack (from Epic 2) based on SNI code
4. GPT-4 prompt: "Given [company data + contextual answers], select 15-30 HIGHEST-PRIORITY laws, prioritize by: (1) change frequency, (2) fine risk, (3) business-criticality, (4) industry-specificity"
5. AI returns ranked law list with contextual commentary per law
6. Commentary format: "Gäller eftersom ni har 12 anställda" or "Gäller eftersom ni serverar alkohol"
7. Response format: `{ phase: 1, totalEstimated: 68, laws: [{ law_id, title, sfs_number, commentary, priority, category }] }`
8. Generation time <3 minutes (including streaming during question answering)
9. Laws categorized: Grundläggande, Arbetsmiljö, Branschspecifika (Phase 1 focuses on these 3)
10. Fallback: If SNI code not in starter packs, use general "SMB starter pack"

**Phase 2 (Post-Signup - Comprehensive Coverage):**

11. API endpoint created: `POST /api/onboarding/generate-law-list-phase2`
12. Triggered automatically after account creation, runs as background job
13. Request body: `{ userId, workspaceId, phase1LawIds, contextualAnswers }`
14. GPT-4 prompt: "Given [company data], generate REMAINING 45-65 laws for comprehensive 60-80 total coverage. Exclude Phase 1 laws. Include: nice-to-know laws, tangential regulations, environmental laws, specialized contexts."
15. Categories added: GDPR & Data, Ekonomi, Miljö, Övrigt
16. Generation time <60 seconds for 45-65 laws
17. Laws stream into user's workspace in real-time (background process, non-blocking)
18. Progress tracking: Database stores `phase2_generation_status` (pending/in_progress/complete)
19. Frontend polls: `GET /api/onboarding/phase2-status/{workspaceId}` returns `{ progress: 45/68, complete: false }`
20. Upon completion: Database marks `phase2_generation_status = complete`, sends completion event
21. Error handling: If Phase 2 fails, retry up to 3 times, then notify user "Vi slutför din laglista, det kan ta några minuter till"

**Testing:**

22. Test Phase 1 with 15 different industries (manual review: >95% relevant for immediate compliance)
23. Test Phase 2 with same industries (manual review: comprehensive coverage, minimal duplication)
24. Verify Phase 1 + Phase 2 totals 60-80 laws per industry
25. Compare generated lists against Notisum's industry lists (coverage parity check)

**Technical Notes:**

- Phase 1 laws prioritized for "conversion value" - show user we understand their business
- Phase 2 adds breadth for Notisum parity (users expect comprehensive coverage)
- contextualAnswers from Story 4.2b dramatically improve accuracy vs. Bolagsverket-only
- Background job for Phase 2 uses job queue (BullMQ or similar) for reliability

---

---

## Story 4.4: Build Streaming Law List UI

**As a** visitor,
**I want** to watch my law list generate in real-time,
**so that** I experience the "magic" of AI personalization.

**Acceptance Criteria:**

1. After submitting org-number, law list streams onto page
2. Streaming animation: Laws appear one-by-one, card-by-card
3. Each law card displays: title, SFS number, category badge, AI commentary (1-2 sentences)
4. Cards have subtle fade-in animation
5. Progress indicator: "12/20 lagar valda..."
6. Streaming uses Vercel AI SDK or Server-Sent Events (SSE)
7. Once complete, show: "Din personliga laglista är klar! ✅"
8. Call-to-action: "Spara och fortsätt" button (triggers signup)
9. Law cards interactive: Click to expand full details
10. Mobile-responsive card layout (1 column mobile, 2-3 desktop)

---

## Story 4.4b: Build Post-Signup Phase 2 Completion UI

**As a** new user,
**I want** to see my law list complete in the background after signup,
**so that** I have comprehensive 60-80 law coverage without waiting.

**Acceptance Criteria:**

**Dashboard Progress Indicator:**

1. After signup, user lands on Dashboard with 15-30 Phase 1 laws visible immediately
2. Progress bar displayed at top of Dashboard:
   - "Kompletterar din laglista... 23/68 lagar"
   - Animated progress bar fills as laws generate
   - Estimated time remaining: "~45 sekunder kvar"
   - Dismissible: Small [X] button hides bar, but generation continues in background
3. Progress bar color: Primary brand color with subtle animation (shimmer or pulse)
4. Mobile-responsive: Full-width on mobile, partial-width on desktop

**Real-Time Law Streaming:**

5. New laws from Phase 2 appear with fade-in animation as they're generated
6. Each new law card tagged with "✨ NY GENERERAD" badge (disappears after 3 seconds)
7. Laws auto-organize into categories as they populate:
   - Grundläggande (23) - already populated from Phase 1
   - Arbetsmiljö (12) - populates as generated
   - Branschspecifika (8) - populates as generated
   - GDPR & Data (5) - populates as generated
   - Ekonomi (8) - populates as generated
   - Miljö (3) - populates as generated
   - Övrigt (2) - populates as generated
8. Category counts update in real-time: "Arbetsmiljö (8)" → "Arbetsmiljö (9)" → "Arbetsmiljö (12)"
9. Smooth transitions: No jarring reordering, laws append to bottom of each category

**User Interaction During Generation:**

10. User can interact with Dashboard during Phase 2 generation (NOT blocked)
11. User can click law cards to view details (opens in new tab/modal, doesn't interrupt generation)
12. User can set notification preferences while generation runs
13. User can start AI chat while generation runs (Phase 1 laws already available as context)
14. If user navigates away from Dashboard, generation continues in background
15. Progress bar reappears if user returns to Dashboard before completion

**Completion Experience:**

16. When Phase 2 completes, show toast notification (top-right or center):
    - "✅ Klar! 68 lagar i din lista är nu kompletta och aktiverade för ändringsbevakning"
    - Auto-dismisses after 8 seconds
    - Subtle confetti animation (optional, can be disabled in user settings)
17. Progress bar transitions to success state: "✅ Din laglista är komplett med 68 lagar"
18. Success banner auto-dismisses after 10 seconds or on manual close
19. Database updates: workspace.phase2_generation_status = 'complete'
20. Analytics event tracked: `phase2_generation_complete` with duration and law count

**Error Handling:**

21. If Phase 2 generation fails (API error, timeout):
    - Progress bar shows: "⏸️ Kompletterar din laglista, tar lite längre tid än förväntat..."
    - Retry mechanism: Automatic retry up to 3 times with exponential backoff
    - If all retries fail: "Vi slutför din laglista snart. Du får ett mejl när det är klart."
22. User can continue using app with Phase 1 laws while Phase 2 retries
23. Email sent when Phase 2 eventually completes: "Din laglista med 68 lagar är nu klar!"

**Frontend Polling:**

24. Dashboard polls `GET /api/onboarding/phase2-status/{workspaceId}` every 2 seconds during generation
25. Response format: `{ progress: 45, total: 68, complete: false, newLaws: [{law_id, title, ...}] }`
26. Polling stops when `complete: true` or user navigates away (resumes on return)
27. Efficient polling: Only fetch new laws since last poll (not full list every time)

**Testing:**

28. Test with slow network: Verify UI doesn't break, progress bar shows accurately
29. Test browser close during Phase 2: Verify generation continues server-side, resumes UI on return
30. Test with Phase 2 failure: Verify retry logic works, user isn't blocked

**Performance:**

31. Phase 2 generation target: <60 seconds for 45-65 laws
32. Dashboard remains responsive (<100ms interactions) during background generation
33. Category reorganization uses CSS transitions (smooth, not jarring)

**Technical Notes:**

- Background job uses job queue (BullMQ) for reliability
- Frontend uses Server-Sent Events (SSE) or polling for real-time updates
- Laws cached in client state to avoid refetching
- Optimistic UI: Show laws immediately as they're generated, not batched

---

## Story 4.5: Implement Trial Signup Flow

**As a** visitor,
**I want** to sign up for a free trial after seeing my law list,
**so that** I can save it and access full features.

**Acceptance Criteria:**

1. Clicking "Spara och fortsätt" opens signup modal
2. Signup form fields: Email, Password, Company name (pre-filled from Bolagsverket)
3. Password complexity validation (min 8 chars, 1 number, 1 special char, 1 uppercase)
4. Password breach check via HaveIBeenPwned API
5. Checkbox: "I agree to Terms of Service and Privacy Policy"
6. "Start 14-dagars gratis provperiod" CTA
7. Credit card NOT required for trial (changed from original requirement - architect decision)
8. Account created → Email verification sent (6-digit code)
9. User redirected to email verification page
10. Generated law list automatically saved to user's workspace
11. Error handling: Email already exists, weak password, API errors

**Note:** Original requirement (FR21) specified credit card upfront, but architect may reconsider to reduce signup friction. Recommend A/B testing.

---

## Story 4.6: Build Email Verification Flow

**As a** new user,
**I want** to verify my email with a 6-digit code,
**so that** the system confirms my email is valid.

**Acceptance Criteria:**

1. After signup, 6-digit verification code sent via email (Resend or SendGrid)
2. Email template includes: code, company name, "Verify your email" CTA
3. Verification page displays: "Check your email for a 6-digit code"
4. Input field for 6-digit code
5. Client-side validation: Exactly 6 digits
6. Submit code → Backend validates → Account marked as verified
7. Redirect to Dashboard on success
8. Error handling: Invalid code, expired code (30-minute expiry)
9. "Resend code" option (max 3 resends per hour)
10. Email sent from no-reply@laglig.se with branded template

---

## Story 4.7: Create Welcome Email Sequence (Trial Nurturing)

**As a** product owner,
**I want** to send automated emails during the trial period,
**so that** I increase trial-to-paid conversion.

**Acceptance Criteria:**

1. Email automation set up with Resend/SendGrid/Loops
2. **Day 1 (Welcome):** "Welcome to Laglig.se! Here's your law list." + feature overview
3. **Day 3 (Feature tips):** "5 ways to get the most from Laglig.se" (AI chat, drag-and-drop, change monitoring teaser)
4. **Day 7 (Engagement check):** "How's it going? Need help?" + link to support
5. **Day 12 (Conversion push):** "Your trial ends in 2 days - Upgrade now!" + pricing, testimonials, urgency
6. Emails track open rates, click rates (UTM parameters)
7. Unsubscribe link in every email
8. A/B testing capability (subject lines, CTAs)
9. Email content in Swedish
10. Templates use React Email for easy editing

---

## Story 4.8: Implement Free Trial Expiration Logic

**As a** system,
**I want** to automatically expire free trials after 14 days,
**so that** users must upgrade to continue using the product.

**Acceptance Criteria:**

1. User accounts have `trial_ends_at` field (set to signup_date + 14 days)
2. Daily cron job checks for expired trials (runs 00:00 UTC)
3. Expired trial users: Access blocked, workspace set to "paused" status
4. Paused workspace shows banner: "Your trial has ended. Upgrade to continue."
5. User can click "Upgrade" → Redirects to billing page (Epic 5)
6. Data preserved for 30 days after trial expiration (Epic 5 soft-delete)
7. Email sent on day 14: "Your trial has ended" + upgrade CTA
8. Expired users cannot login (redirect to upgrade page)
9. Analytics tracking: Trial → Paid conversion rate (target >25%)

---

## Story 4.9: Add Personalized Law List Management

**As a** user,
**I want** to customize my law list (add/remove laws, create multiple lists),
**so that** I track only relevant compliance requirements.

**Acceptance Criteria:**

1. Law List page displays all laws in user's list
2. Each law card shows: title, category, priority, status (from Kanban Epic 6)
3. "Add Law" button opens search modal (search all 10,000+ laws)
4. User can add laws manually from search results
5. "Remove Law" button (with confirmation) removes law from list
6. User can create multiple law lists: "Main List", "Construction-Specific", "GDPR Focus"
7. List switcher dropdown in navigation
8. Drag-and-drop to reorder laws (priority)
9. Export law list as PDF or CSV
10. Law list scoped to workspace (multi-tenancy in Epic 5)

---

## Story 4.10: Implement Onboarding Progress Tracking

**As a** product owner,
**I want** to track onboarding funnel metrics,
**so that** I can optimize conversion rates.

**Acceptance Criteria:**

1. Analytics events tracked:
   - Onboarding widget viewed
   - Org-number submitted
   - Law list generated successfully
   - Signup modal opened
   - Account created
   - Email verified
   - First login to Dashboard
2. Funnel visualization in analytics dashboard
3. Conversion rates calculated: Widget view → List generated, List generated → Signup, Signup → Verified, Verified → First login
4. Tracking includes: timestamp, user_id, session_id, referral source
5. A/B testing support: Track variant ID for widget CTAs
6. Goal: >40% widget view → signup, >80% signup → verified
7. Weekly report emailed to founder

---

**Epic 4 Complete: 10 stories, 3-4 weeks estimated**

---
