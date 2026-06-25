# Innehallsbrief — AI-sammanfattningar

- **Route:** /funktioner/ai-sammanfattningar
- **Cluster / template:** funktioner / FeaturePageTemplate
- **Sokintention:** commercial
- **Ordmal:** ~1000

## Nyckelord

- **Primart:** AI-sammanfattning av lagtext
- **Sekundart:** lagtext pa klarsprak, forsta lagtext, vad betyder lagen
- **Long-tail:**
  - "forklara lagtext pa enkel svenska"
  - "vad betyder paragrafen i klartext"
  - "sammanfatta foreskrift AFS"
  - "hur paverkar lagen mitt foretag"
  - "lagtext for icke-jurister"
  - "forsta miljobalken enkelt"
  - "AI som forklarar lagar"
  - "tolka lagkrav i verksamheten"
  - "snabb oversikt over ny lagstiftning"
  - "lagtext sammanfattning exempel"

## SEO-meta

- **Meta-titel (<=60 tecken):** AI-sammanfattningar av lagtext — lagar pa klarsprak
- **Meta-beskrivning (~155 tecken):** Las lagtext pa vanlig svenska. Laglig.se sammanfattar varje lag, forordning och foreskrift och svarar pa hur den paverkar er. Testa med ert organisationsnummer.
- **H1:** AI-sammanfattningar: lagtext pa vanlig svenska

## Produktvinkel (hook)

Paragraftext ar skriven for jurister, men besluten fattas av KMA-, miljo- och kvalitetsansvariga. Laglig.se sammanfattar varje forfattning i katalogen pa klarsprak och svarar pa fragan som faktiskt betyder nagot — "hur paverkar detta oss?" — sa att hela teamet kan agera utan att forst tyda lagsvenska.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 + hook + OrgCheck
   - Eyebrow: "Funktion · AI-sammanfattningar"
2. **DefinitionBox — Vad ar en AI-sammanfattning av lagtext?**
   - H3: Klarsprakssammanfattning kontra originaltext (originalet alltid en knapptryckning bort)
   - H3: Manniska i loopen — sammanfattningen ar ett arbetsstod, inte juridisk radgivning
   - Renderas i DefinitionBox hogst upp
3. **SplitFeature — "Hur paverkar detta oss?" pa varje lag** (skarmdump: lagdetalj med sammanfattning + verksamhetsfalt)
   - H3: Fran abstrakt krav till konkret atgard i er kontext
4. **ProcessSteps — Sa skapas en sammanfattning**
   - H3: Forfattning ur katalogen → klarsprakssammanfattning → ert verksamhetssvar
   - H3: Alltid lankad till gallande originaltext for kontroll
5. **FeatureGrid — Vad sammanfattningarna ger**
   - H3: Snabb onboarding av nya kollegor
   - H3: Underlag for ledningens genomgang
   - H3: Stod nar en lag andras (koppling till lagandringar)
6. **OrgCheckCta** — mid-page: "Se AI-sammanfattningar for lagarna som gäller er"
7. **CatalogLawList — Exempel pa forfattningar med sammanfattning** (lankar in i katalogen)
8. **ProofBlock — Sa haller vi sammanfattningarna trovardiga**
   - H3: Kalla alltid synlig, originaltext ett klick bort, ingen ersattning for juridisk bedomning
9. **FaqAccordion**
10. **CtaBlock + RelatedPagesGrid**

## Kataloglankar (CatalogLawList)

- Arbetsmiljolag (SFS 1977:1160) — ramlag som ofta behover oversattas till praktik.
- Systematiskt arbetsmiljoarbete (AFS 2023:1) — foreskrift med manga krav att bryta ned.
- Miljobalk (SFS 1998:808) — omfattande balk dar klarsprak gor stor skillnad.
- Forordning om verksamhetsutovares egenkontroll (SFS 1998:901) — kopplar krav till handling.
- Dataskyddsforordningen GDPR (32016R0679) — EU-text som ofta upplevs svartolkad.
- Diskrimineringslag (SFS 2008:567) — krav pa aktiva atgarder.
- Arbetstidslag (SFS 1982:673) — detaljreglering om vila och overtid.
- Lag om skydd mot olyckor (SFS 2003:778) — systematiskt brandskyddsarbete.

## FAQ (3-5)

- **Kan jag lita pa en AI-sammanfattning av en lag?**
  - Sammanfattningen ar ett arbetsstod for att forsta och prioritera; gallande originaltext ar alltid lankad och ska vara kallan vid tveksamhet. Det ersatter inte juridisk radgivning. Var rak och arlig om granserna.
- **Far jag se den riktiga lagtexten ocksa?**
  - Ja — varje sammanfattning lankar till forfattningen i katalogen och vidare till kallan (riksdagen/EUR-Lex).
- **Vad menas med "hur paverkar detta oss"?**
  - Ett verksamhetsfalt dar kravet kopplas till er kontext; kan fyllas i/justeras av er. Lank till /funktioner/laglista.
- **Sammanfattas aven foreskrifter och EU-forordningar?**
  - Ja, hela katalogen: SFS, AFS m.fl. och EU-ratt.
- **Uppdateras sammanfattningen nar lagen andras?**
  - Sammanfattningen foljer forfattningen; vid andring flaggas det via lagbevakningen. Lank till /funktioner/lagandringar.

## Interna lankar (relatedPages)

- /funktioner/lagkatalog
- /funktioner/laglista
- /funktioner/kravpunkter
- /funktioner/lagandringar

## Bildmaterial

- **Skarmdumpar:** Lagdetaljvy med klarsprakssammanfattning + "Hur paverkar detta oss?"-falt; vy som visar sammanfattning sida vid sida med lank till originaltext. Wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A quality manager reading a plain-language law summary on a tablet while briefing a colleague in a Swedish workshop office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."

## Kallor (grundning)

- riksdagen.se / SFS och EUR-Lex som originalkallor som sammanfattningarna lankar till.
- Arbetsmiljoverket (AFS) for foreskriftsexempel.
- Sprakradet/klarsprak som princip for tonen (ej som faktakalla i texten).
- Laglig egen katalog for omfang.

## Anmarkningar

- Undvik overclaims: sammanfattning = arbetsstod, ej juridisk radgivning; originaltext alltid kallan. Halls isar fran /funktioner/lagkatalog (sjalva forfattningsbestandet) — denna sida agar "begripligheten". Ingen overlapp med /funktioner/ai-agent (konversation/atgardsforslag); lank dit om relevant.
