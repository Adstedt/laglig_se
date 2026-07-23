# Laglig.se Landing Page — AI Frontend Generation Prompt

> Copy the prompt below into v0, Lovable, or similar AI frontend tools.
> For best results, generate **section by section** rather than the entire page at once.
> All generated code requires human review, testing, and refinement before production use.

---

## Master Prompt

```
You are building the landing page for Laglig.se — a Swedish compliance operations platform that monitors SFS laws (10,000+), agency regulations (AFS, BFS, SKVFS, MSBFS, etc.), and EU directives (GDPR, CBAM, NIS2, etc.), tracks amendments across all sources, and delivers personalized consequence analysis to businesses. This is NOT an "AI wrapper" — it is a premium, standalone compliance platform. Never use the word "AI" in any user-facing copy.

## Tech Stack (MUST follow exactly)

- Next.js 16 (App Router) with TypeScript
- React 19
- Tailwind CSS 3.4+
- shadcn/ui components (Radix UI primitives + Tailwind)
- Lucide React icons
- All components must use `"use client"` only when interactivity requires it
- Import paths use `@/components/`, `@/lib/`, etc.
- File naming: PascalCase for components, camelCase for utils/hooks

## Design System (MUST match exactly)

### Color Palette (CSS custom properties, HSL format)
These are the ONLY colors to use. Do NOT introduce new colors.

```css
--background: 40 20% 98%;        /* Warm off-white page base */
--foreground: 30 10% 10%;        /* Warm dark text */
--primary: 30 15% 12%;           /* Warm dark — CTAs, buttons, headings */
--primary-foreground: 40 20% 98%; /* Light text on primary bg */
--secondary: 40 15% 95%;
--muted: 40 12% 94%;             /* Badge fills, subtle backgrounds */
--muted-foreground: 30 8% 45%;
--border: 35 10% 88%;            /* Card borders, dividers */
--destructive: 0 84.2% 60.2%;   /* Error states only */

/* Section backgrounds */
--section-warm: 45 30% 96%;      /* Beige — problem section, alternating */
--section-sage: 140 25% 95%;     /* Sage green — audit section */
--section-cream: 35 40% 97%;     /* Cream — platform overview */
```

Accent colors (Tailwind classes only):
- Emerald (emerald-400/500/600): success states, check icons, trust signals
- Amber (amber-50 through amber-900): warm accents, highlights, notification elements

### Typography
- Display/Headlines: font-family "Safiro", weight 500. Use CSS class `.font-safiro`
- Body text: font-family "Google Sans Flex", variable weight 100-900
- Brand tagline "Coolt med koll.": Safiro, text-6xl md:text-7xl lg:text-8xl
- H1: Safiro, text-4xl md:text-5xl lg:text-6xl
- H2: Safiro, text-3xl md:text-4xl
- H3: Google Sans Flex weight 600, text-xl md:text-2xl
- Body: Google Sans Flex weight 400, text-base, leading-relaxed
- Witty/personality lines: Google Sans Flex weight 500 italic, text-lg

### Spacing
- Section padding: py-16 md:py-24 lg:py-32
- Max content width: max-w-7xl mx-auto px-4 md:px-6
- Card padding: p-6 md:p-8
- Grid gaps: gap-8 md:gap-12 lg:gap-16
- Element spacing within sections: space-y-8 md:space-y-12

### Visual Elevation — Grain Texture
Add a subtle noise/grain texture overlay to hero, CTA, and product preview backgrounds:
```css
.grain-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.04;
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 1;
}
```

### Gradient Compositions (existing warm colors)
- Hero product card glow: radial-gradient with from-amber-200/40 via-orange-100/20 to-rose-100/30
- CTA section: bg-primary base with radial white overlays at 30-40% opacity + grain
- Pillar card visual frames: subtle from-amber-100/60 to-transparent gradient border
- Section transitions: soft gradient fades, no hard color breaks between sections

## Brand Voice (ALL copy must be in Swedish)

- **Tagline:** "Coolt med koll."
- **Tone:** Confident expertise + Swedish wit + zero corporate fluff
- **NEVER** say "AI", "AI-driven", or "machine learning" in any user-facing text. Describe behaviors and outcomes instead: "Laglig analyserar", "automatiskt", "bevakat"
- **Be specific** in examples: use real regulation names (AFS 2025:2, GDPR, Arbetsmiljölagen), real-sounding employee names, concrete numbers
- **One witty/clever line per section maximum.** Rest is clear, substantive, trustworthy.
- **Never joke about fines, legal risk, or consequences** — that is the visitor's real fear
- **Swedish wordplay** where natural: "koll/roll", "krav/brav", "lag/dag"

## Page Structure — Build These Sections In Order

### 1. NAVBAR (sticky)
- Left: Laglig.se logo text (font-safiro, text-xl, font-medium)
- Center: "Produkt" · "Priser" · "Resurser" — smooth-scroll anchor links, text-sm font-medium text-muted-foreground hover:text-foreground
- Right: "Logga in" ghost button + "Kom igång gratis" primary pill button (rounded-full bg-primary text-primary-foreground)
- On scroll: add subtle backdrop-blur-sm bg-background/80 border-b
- Mobile: logo + hamburger → Sheet drawer with same links. Add sticky bottom bar with "Kom igång gratis" CTA, h-14 bg-background border-t shadow-lg, always visible on mobile only

### 2. HERO SECTION
Two-column layout: left 55%, right 45%. Stacks vertically on mobile (text first).

**Left column:**
- Eyebrow badge: small rounded pill with subtle amber gradient border, text "Plattformen för svensk lagefterlevnad", text-sm
- H1: "Coolt med koll." — font-safiro, text-6xl md:text-7xl lg:text-8xl, tracking-tight
- Subtitle: "Ert företags hela regellandskap — bevakat, analyserat, hanterat. Medan ni fokuserar på det ni faktiskt startade företaget för." — text-lg md:text-xl text-muted-foreground, max-w-lg
- Org-number input group: Input with placeholder "Ange ert org-nummer" (text-base, h-12, rounded-lg) + "Kom igång gratis" primary button (h-12, rounded-lg, px-6). On one row on desktop, stacked on mobile.
- Sub-text below input: "3 steg · 2 minuter · Inget kort krävs" — text-sm text-muted-foreground
- Three trust signals in a row: ✓ Ingen bindning · ✓ GDPR-säkrad · ✓ Data i Sverige — text-sm, check icons in text-emerald-500

**Right column:**
- Product preview card floating with warm radial gradient glow behind it + grain overlay
- The card itself: bg-card rounded-xl border shadow-xl p-6
  - Header: "Laglig · Konsekvensanalys" in text-xs font-medium text-muted-foreground, with a thin border-b pb-3 mb-4
  - Title: "AFS 2025:2 — Systematiskt arbetsmiljöarbete" in font-medium text-base
  - Section: "Påverkar er verksamhet:" in text-sm font-medium mt-4 mb-2
  - Three bullet items with amber-500 squares (■): "3 anställda behöver uppdaterad utbildning", "Deadline: 1 juni 2025", "2 uppgifter skapade automatiskt" — text-sm text-muted-foreground
  - Two employee rows: "Lisa Andersson · Utbildning krävs" and "Erik Holm · Certifikat löper ut" — text-sm, with subtle bg-muted/50 rounded-md px-3 py-2 each
  - Two buttons at bottom: "Visa uppgifter" (ghost/outlined small) + "Läs analysen" (ghost/outlined small)
- Card should have entrance animation: fade-up 600ms ease-out with slight scale 0.95→1, 200ms delay after page load
- DO NOT use chatbot-style bubbles, robot emojis, or anything that looks like a chat interface

### 3. PROBLEM SECTION
Background: bg-[hsl(var(--section-warm))] with grain overlay

- H2: "100+ regeländringar per år." — font-safiro
- Witty subtitle: "Vem i ert team har det som hobby?" — text-lg italic text-muted-foreground
- Three source cards in a row (grid grid-cols-1 md:grid-cols-3 gap-6):
  - Card 1: "SFS" title, "10 000+ författningar" subtitle, "~50 ändringar/år" stat — with Scale icon from Lucide
  - Card 2: "Föreskrifter" title, "AFS, BFS, SKVFS, MSBFS..." subtitle, "~30 ändringar/år" — with Building icon
  - Card 3: "EU-lagstiftning" title, "GDPR, CBAM, NIS2..." subtitle, "~20 ändringar/år" — with Globe icon
  - Each card: bg-card rounded-xl border p-6, icon in bg-primary/10 rounded-full p-3 text-primary
- Bridge text below cards: "Tänk om någon redan hade koll. Och berättade vad det betyder för just er." — text-center text-lg md:text-xl font-medium mt-12

### 4. PLATFORM OVERVIEW SECTION
Background: bg-[hsl(var(--section-cream))]

- H2: "SFS. Föreskrifter. EU-direktiv." — font-safiro
- Subtitle: "Vi har koll. Ni har ro." — text-xl text-muted-foreground
- Visual: Three source badges at top flowing down into a central "Laglig" block, then branching out to 4 capability labels
  - Source badges: rounded pills with icons (Scale, Building, Globe) + source name
  - Central block: larger card with "Laglig" in font-safiro + "Bevakar · Analyserar · Agerar" subtitle. Use bg-primary text-primary-foreground, rounded-xl, py-4 px-8
  - Lines connecting sources to center and center to outputs (use CSS borders/pseudo-elements or simple SVG lines)
  - Four output labels below: "Regellandskap", "Konsekvensanalys", "Uppgifter", "Spårbarhet" — in small rounded cards

### 5. PILLAR DEEP-DIVE SECTIONS (4 sections, alternating layout)
Each pillar alternates text-left/visual-right, then text-right/visual-left.

**Pillar pattern (repeat 4 times):**
- Two-column layout: 50/50 split, stacks on mobile (text always first)
- Text side:
  - Small label/badge with pillar number or icon
  - H3 headline (see specific copy below) — font-semibold text-xl md:text-2xl
  - Description paragraph — text-muted-foreground
  - 3-4 feature bullets with small Lucide icons inline
  - Inline testimonial block: bg-muted/30 rounded-lg p-4, italic quote, "— Name, Title" attribution in text-sm
  - Micro-CTA button below: rounded-lg variant
- Visual side:
  - Product screenshot or mock UI in a ProductPreviewCard frame (bg-card rounded-xl border shadow-lg overflow-hidden)
  - Warm gradient glow behind the card + grain overlay
  - Should look like a real piece of the app, not a generic illustration

**Pillar 1 — Hela regellandskapet:**
- H3: "Allt på ett ställe. Äntligen."
- Description: "SFS, föreskrifter och EU-direktiv — samlat och bevakat."
- Visual: Show three columns of regulations merging into one unified list view
- Micro-CTA: "Se vilka lagar som gäller ert företag"
- Section bg: default (white)

**Pillar 2 — Personlig konsekvensanalys:**
- H3: "Inte 'en lag ändrades.' Utan 'det här behöver ni göra.'"
- Description: "Varje ändring analyserad utifrån just er verksamhet, era anställda, era skyldigheter."
- Visual: Side-by-side comparison — left shows raw amendment text (muted, dense), right shows clean assessment with employee names and action items (clear, structured)
- Micro-CTA: "Prova med ert org-nummer"
- Section bg: bg-[hsl(var(--section-warm))]

**Pillar 3 — Från ändring till åtgärd:**
- H3: "Lagen ändras kl 08:00. Kl 08:02 har Lisa sin uppgift."
- Description: "Ändringar blir uppgifter med ansvarig och deadline. Automatiskt."
- Visual: Mock Kanban board with three columns (Att göra, Pågår, Klart). Show 3-4 task cards with employee names, deadlines, and priority badges. Use amber for high priority, emerald for done.
- Micro-CTA: "Se hur det fungerar"
- Section bg: default (white)

**Pillar 4 — Komplett spårbarhet:**
- H3: "När revisorn frågar 'hur gör ni?' — ni ler."
- Description: "Allt dokumenterat, tidsstämplat, redo för revision."
- Visual: Mock audit trail / activity log — timestamped entries showing who did what: "Lisa Andersson slutförde uppgift: Uppdatera riskbedömning · 14:32", "Erik Holm laddade upp: Certifikat truckkörning · 09:15" etc. Use a clean timeline layout with avatars/initials, timestamps, and action descriptions.
- Micro-CTA: "Bygg ert compliance-arkiv"
- Section bg: bg-[hsl(var(--section-sage))]

### 6. SOCIAL PROOF SECTION
- H2: "Företag som har koll" — font-safiro, text-center
- Three testimonial cards in a row (grid-cols-1 md:grid-cols-3):
  - Each card: bg-card rounded-xl border p-6 md:p-8
  - Leading metric badge: large text-3xl font-bold in text-primary (e.g., "200k", "10h", "100%")
  - Metric label: text-sm text-muted-foreground (e.g., "sparad i böter", "sparade per månad", "compliance i audit")
  - Quote: text-base italic mt-4, the testimonial text in Swedish
  - Attribution: "— Name, Title, Company" text-sm text-muted-foreground mt-4
- Use these testimonials:
  1. Metric: "200k" / "sparad i böter" — "Vi fick varning om en ändring i arbetsmiljölagen tre månader i förväg. Det hade lätt blivit en sanktionsavgift." — Erik Bergström, Produktionschef, Nordic Manufacturing
  2. Metric: "10h" / "sparade per månad" — "Från tio timmars lagbevakning i månaden till praktiskt taget noll. Frågor som brukade ta dagar får vi svar på direkt." — Anna Lindberg, VD, TechStart AB
  3. Metric: "100%" / "compliance i audit" — "HR-modulen flaggade att fyra truckcertifikat höll på att löpa ut. Det hade vi aldrig fångat själva." — Marcus Johansson, HR-chef, Bygg & Montage

### 7. PRICING SECTION
- H2: "Enkel prissättning. Inga överraskningar." — font-safiro, text-center
- Toggle switch: "Månadsvis" / "Årsvis — spara 17%" using shadcn Switch component, centered
- Three pricing cards (grid-cols-1 md:grid-cols-3 gap-6 md:gap-8):
  - **Solo** (399 kr/mån or 332 kr/mån yearly): "För enskilda företagare". 1 användare, Personlig laglista, 100 frågor/månad, Ändringsnotiser, E-postsupport. CTA: "Välj Solo" outlined button.
  - **Team** (899 kr/mån or 749 kr/mån yearly): "För växande team". POPULAR badge (bg-primary text-primary-foreground rounded-full text-xs px-3 py-1). Up to 10 användare, Allt i Solo, HR-modul, Automatiska uppgifter, Obegränsad chat, PDF/Excel-export. CTA: "Kom igång" primary button. This card has ring-2 ring-primary to stand out.
  - **Enterprise** (Kontakta oss): "För stora organisationer". Obegränsat antal användare, Allt i Team, API-integration, SSO (Azure AD/Google), SLA 99.9%, Dedikerad support. CTA: "Kontakta oss" outlined button.
- Trust badges below: centered row of "Ingen bindningstid" · "GDPR-compliant" · "Data lagras i Sverige" with check icons

### 8. FAQ SECTION
- H2: "Vanliga frågor" — font-safiro, text-center
- Use shadcn Accordion component, max-w-3xl mx-auto
- 5 questions with answers (write in clear Swedish, add one cheeky line at end of each answer):
  1. "Hur lång tid tar det att komma igång?" — Under 3 minuter. Ange org-nummer, vi analyserar er verksamhet, klart. "Snabbare än att hitta ert nuvarande Excel-ark."
  2. "Vilka lagar täcker ni?" — 10 000+ SFS-författningar, föreskrifter från alla myndigheter (AFS, BFS, SKVFS...), EU-direktiv och förordningar. Daglig uppdatering. "Om det finns i svensk lag, har vi koll."
  3. "Kan jag testa gratis?" — Ja, 14 dagar helt gratis. Inget kort krävs. Ingen bindning. "Det enda ni riskerar är att börja sova bättre."
  4. "Är mina data säkra?" — TLS 1.3, all data lagras i Sverige, GDPR-compliant, regelbundna säkerhetsgranskningar. "Säkrare än ert nuvarande Excel-ark."
  5. "Vad skiljer er konsekvensanalys från vanliga notiser?" — De flesta tjänster skickar en generisk notis: 'en lag ändrades.' Vi analyserar ändringen utifrån just er verksamhet och berättar exakt vilka anställda som påverkas och vad ni behöver göra. "Skillnaden mellan att bli informerad och att bli hjälpt."

### 9. FINAL CTA SECTION
- Background: bg-primary with text-primary-foreground
- Add warm radial gradient overlays (white at 30-40% opacity) + grain overlay for texture
- Floating blur circles: 2-3 div elements with bg-white/10 blur-3xl rounded-full, absolute positioned, for ambient depth
- H2: "Compliance ska inte vara ert problem. Det ska vara ert försprång." — font-safiro text-3xl md:text-4xl text-center
- Subtitle: "Ert företags personliga laglista väntar. På 2 minuter vet ni exakt vad som gäller." — text-lg text-primary-foreground/80 text-center
- Org-number input (hero variant but inverted colors): white/light input on dark bg + white CTA button "Skapa er laglista nu"
- Trust line: "Gratis i 14 dagar · Ingen bindning · Inget kort" — text-sm text-primary-foreground/60 text-center

### 10. FOOTER
- bg-muted/30 border-t
- 4-column grid (stacks on mobile):
  - Col 1: Laglig.se logo + "Plattformen för svensk lagefterlevnad" tagline text-sm text-muted-foreground. Then: "Coolt med koll." in font-safiro text-sm mt-4
  - Col 2: "Meny" heading + links: Så fungerar det, Priser, Om oss, Kontakt
  - Col 3: "Juridiskt" heading + links: Integritetspolicy, Användarvillkor, Ansvarsfriskrivning
  - Col 4: "Nyhetsbrev" heading + email input + subscribe button ("Prenumerera")
- Bottom bar: "© 2026 Laglig.se" + legal disclaimer "Laglig.se tillhandahåller juridisk information. Detta är inte juridisk rådgivning." text-xs text-muted-foreground

## Animation Requirements

All animations MUST respect `prefers-reduced-motion: reduce`.

- Hero entrance: tagline fades up (opacity 0→1, translateY 20px→0, 600ms ease-out). Product card follows with 200ms delay + scale 0.95→1.
- Section reveal: each section fades up when entering viewport (IntersectionObserver, triggered once). 400ms ease-out.
- Product preview card hover: box-shadow opacity increases 0.1→0.2 + translateY(-2px). 200ms ease.
- Pillar entrance: staggered fade-up within each pillar (title → description → bullets → testimonial → CTA, 100ms stagger). Visual fades in simultaneously.
- Pricing toggle: prices animate with smooth transition (200ms).
- FAQ accordion: height transition 300ms ease-in-out (shadcn default).
- ONLY use CSS transform and opacity for animations. No JavaScript-driven layout animations. Add will-change: transform on animated elements.

## Accessibility Requirements

- WCAG 2.1 Level AA compliance
- All interactive elements: visible focus ring (ring-2 ring-primary ring-offset-2)
- Semantic HTML: <nav>, <main>, <section aria-label="...">, proper heading hierarchy (single H1, then H2→H3)
- Org-number input: visible label or aria-label, error messages via aria-describedby
- All product screenshots/mock UIs: descriptive alt text
- Decorative elements (gradients, grain, blur circles): aria-hidden="true"
- Full keyboard navigation: logical tab order following visual flow
- Touch targets: minimum 44x44px on mobile

## Responsive Behavior

- Mobile-first approach
- Hero: stacks vertically, text above product card, org-number input full width
- Problem cards: stack vertically on mobile
- Pillar sections: stack vertically, text always above visual
- Pricing: stack vertically, Team card first (highlighted) on mobile
- Platform overview funnel: vertical flow instead of horizontal on mobile
- Mobile sticky bottom CTA bar: fixed bottom, h-14, "Kom igång gratis" button, border-t shadow-lg. Only visible on mobile (md:hidden).

## File Structure

Create these files:
- `components/features/landing/hero-section.tsx`
- `components/features/landing/problem-section.tsx`
- `components/features/landing/platform-overview-section.tsx`
- `components/features/landing/pillar-section.tsx` (reusable, accepts props for content + layout direction)
- `components/features/landing/social-proof-section.tsx`
- `components/features/landing/pricing-section.tsx`
- `components/features/landing/faq-section.tsx`
- `components/features/landing/cta-section.tsx`
- `components/features/landing/org-number-input.tsx` (reusable input + CTA component)
- `components/features/landing/product-preview-card.tsx`
- `components/features/landing/inline-testimonial.tsx`
- `components/features/landing/grain-overlay.tsx`
- `components/shared/navigation/navbar.tsx` (update existing)
- `components/shared/navigation/footer.tsx` (update existing)
- `app/page.tsx` (compose all sections)

Do NOT modify any files in `app/(workspace)/`, `app/api/`, `lib/`, or `components/features/dashboard/`.

## Constraints

- Do NOT add any new npm dependencies beyond what already exists (shadcn/ui, Lucide, Tailwind)
- Do NOT use generic stock-style illustrations, abstract blobs, or decorative SVG art
- Do NOT use chatbot-style UI, robot emojis, or speech bubbles anywhere
- Do NOT mention "AI", "machine learning", "neural network", or any technology buzzwords in user-facing copy
- All copy must be in Swedish
- All mock data should use realistic Swedish names, real regulation names (AFS, SFS, GDPR), and plausible numbers
```

---

## How to Use This Prompt

### Recommended approach: Section by section

For best results with v0 or Lovable, break this into individual requests:

1. **First prompt:** Provide the full "Tech Stack", "Design System", and "Brand Voice" sections as context, then request **Section 1 (Navbar) + Section 2 (Hero)** only.
2. **Second prompt:** Keep the context, add the generated code, then request **Section 3 (Problem) + Section 4 (Platform Overview)**.
3. **Third prompt:** Request **all 4 Pillar sections** using the reusable PillarSection component.
4. **Fourth prompt:** Request **Social Proof + Pricing + FAQ**.
5. **Fifth prompt:** Request **Final CTA + Footer**.
6. **Final prompt:** Request `app/page.tsx` that composes all sections.

### Why this structure works

- The **preamble** (tech stack, design system, brand voice) gives the AI complete context without ambiguity
- **Section-specific instructions** are detailed enough to produce accurate output but not so rigid that the AI can't make good design decisions within the constraints
- **Constraints and anti-patterns** prevent the most common failure modes (generic illustrations, AI buzzwords, chatbot aesthetics)
- **File structure** is defined upfront so generated code matches the existing codebase conventions

### After generation

All AI-generated code will require:
- **Human review** of visual quality, spacing, and responsive behavior
- **Copy refinement** — the Swedish copy should be reviewed by a native speaker for tone and wit
- **Component integration** — connecting OrgNumberInput to the actual Bolagsverket API / onboarding flow
- **Screenshot/visual replacement** — swapping mock UI for real product screenshots or embedded components
- **Performance testing** — Lighthouse audit, Core Web Vitals check
- **Accessibility audit** — axe-core scan + manual keyboard/screen reader testing
