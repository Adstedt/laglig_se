# Innehållsbrief — AI-sammanfattningar

- **Route:** /funktioner/ai-sammanfattningar
- **Cluster / template:** funktioner / FeaturePageTemplate
- **Sökintention:** commercial
- **Ordmål:** ~1000

## Nyckelord

- **Primärt:** AI-sammanfattning av lagtext
- **Sekundärt:** lagtext på klarspråk, förstå lagtext, vad betyder lagen
- **Long-tail:**
  - "förklara lagtext på enkel svenska"
  - "vad betyder paragrafen i klartext"
  - "sammanfatta föreskrift AFS"
  - "hur påverkar lagen mitt företag"
  - "lagtext för icke-jurister"
  - "förstå miljöbalken enkelt"
  - "AI som förklarar lagar"
  - "tolka lagkrav i verksamheten"
  - "snabb översikt över ny lagstiftning"
  - "lagtext sammanfattning exempel"

## SEO-meta

- **Meta-titel (<=60 tecken):** AI-sammanfattningar av lagtext — lagar på klarspråk
- **Meta-beskrivning (~155 tecken):** Läs lagtext på vanlig svenska. Laglig.se sammanfattar varje lag, förordning och föreskrift och svarar på hur den påverkar er. Testa med ert organisationsnummer.
- **H1:** AI-sammanfattningar: lagtext på vanlig svenska

## Produktvinkel (hook)

Paragraftext är skriven för jurister, men besluten fattas av KMA-, miljö- och kvalitetsansvariga. Laglig.se sammanfattar varje författning i katalogen på klarspråk och svarar på frågan som faktiskt betyder något — "hur påverkar detta oss?" — så att hela teamet kan agera utan att först tyda lagsvenska.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 + hook + OrgCheck
   - Eyebrow: "Funktion · AI-sammanfattningar"
2. **DefinitionBox — Vad är en AI-sammanfattning av lagtext?**
   - H3: Klarspråkssammanfattning kontra originaltext (originalet alltid en knapptryckning bort)
   - H3: Människa i loopen — sammanfattningen är ett arbetsstöd, inte juridisk rådgivning
   - Renderas i DefinitionBox högst upp
3. **SplitFeature — "Hur påverkar detta oss?" på varje lag** (skärmdump: lagdetalj med sammanfattning + verksamhetsfält)
   - H3: Från abstrakt krav till konkret åtgärd i er kontext
4. **ProcessSteps — Så skapas en sammanfattning**
   - H3: Författning ur katalogen → klarspråkssammanfattning → ert verksamhetssvar
   - H3: Alltid länkad till gällande originaltext för kontroll
5. **FeatureGrid — Vad sammanfattningarna ger**
   - H3: Snabb onboarding av nya kollegor
   - H3: Underlag för ledningens genomgång
   - H3: Stöd när en lag ändras (koppling till lagändringar)
6. **OrgCheckCta** — mid-page: "Se AI-sammanfattningar för lagarna som gäller er"
7. **CatalogLawList — Exempel på författningar med sammanfattning** (länkar in i katalogen)
8. **ProofBlock — Så håller vi sammanfattningarna trovärdiga**
   - H3: Källa alltid synlig, originaltext ett klick bort, ingen ersättning för juridisk bedömning
9. **FaqAccordion**
10. **CtaBlock + RelatedPagesGrid**

## Kataloglänkar (CatalogLawList)

- Arbetsmiljölag (SFS 1977:1160) — ramlag som ofta behöver översättas till praktik.
- Systematiskt arbetsmiljöarbete (AFS 2023:1) — föreskrift med många krav att bryta ned.
- Miljöbalk (SFS 1998:808) — omfattande balk där klarspråk gör stor skillnad.
- Förordning om verksamhetsutövares egenkontroll (SFS 1998:901) — kopplar krav till handling.
- Dataskyddsförordningen GDPR (32016R0679) — EU-text som ofta upplevs svårtolkad.
- Diskrimineringslag (SFS 2008:567) — krav på aktiva åtgärder.
- Arbetstidslag (SFS 1982:673) — detaljreglering om vila och övertid.
- Lag om skydd mot olyckor (SFS 2003:778) — systematiskt brandskyddsarbete.

## FAQ (3-5)

- **Kan jag lita på en AI-sammanfattning av en lag?**
  - Sammanfattningen är ett arbetsstöd för att förstå och prioritera; gällande originaltext är alltid länkad och ska vara källan vid tveksamhet. Det ersätter inte juridisk rådgivning. Var rak och ärlig om gränserna.
- **Får jag se den riktiga lagtexten också?**
  - Ja — varje sammanfattning länkar till författningen i katalogen och vidare till källan (riksdagen/EUR-Lex).
- **Vad menas med "hur påverkar detta oss"?**
  - Ett verksamhetsfält där kravet kopplas till er kontext; kan fyllas i/justeras av er. Länk till /funktioner/laglista.
- **Sammanfattas även föreskrifter och EU-förordningar?**
  - Ja, hela katalogen: SFS, AFS m.fl. och EU-rätt.
- **Uppdateras sammanfattningen när lagen ändras?**
  - Sammanfattningen följer författningen; vid ändring flaggas det via lagbevakningen. Länk till /funktioner/lagandringar.

## Interna länkar (relatedPages)

- /funktioner/lagkatalog
- /funktioner/laglista
- /funktioner/kravpunkter
- /funktioner/lagandringar

## Bildmaterial

- **Skärmdumpar:** Lagdetaljvy med klarspråkssammanfattning + "Hur påverkar detta oss?"-fält; vy som visar sammanfattning sida vid sida med länk till originaltext. Wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A quality manager reading a plain-language law summary on a tablet while briefing a colleague in a Swedish workshop office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."

## Källor (grundning)

- riksdagen.se / SFS och EUR-Lex som originalkällor som sammanfattningarna länkar till.
- Arbetsmiljöverket (AFS) för föreskriftsexempel.
- Språkrådet/klarspråk som princip för tonen (ej som faktakälla i texten).
- Laglig egen katalog för omfång.

## Anmärkningar

- Undvik overclaims: sammanfattning = arbetsstöd, ej juridisk rådgivning; originaltext alltid källan. Hålls isär från /funktioner/lagkatalog (själva författningsbeståndet) — denna sida äger "begripligheten". Ingen överlapp med /funktioner/ai-agent (konversation/åtgärdsförslag); länk dit om relevant.
