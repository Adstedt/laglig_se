# Innehållsbrief — Kunskapsbank (hub)

- **Route:** /kunskapsbank
- **Cluster / template:** sidor-hub / index-landing
- **Sökintention:** navigational + informational
- **Ordmål:** ~500

## Nyckelord

- **Primärt:** kunskapsbank lagefterlevnad
- **Sekundärt:** guider lagbevakning, lär dig laglista, compliance kunskap
- **Long-tail:**
  - "hur fungerar en laglista"
  - "kom igång med lagefterlevnad"
  - "guide lagbevakning för företag"
  - "vad är lagefterlevnadskontroll"
  - "checklista systematiskt arbetsmiljöarbete"
  - "lär dig om miljöbalken enkelt"
  - "lagar och föreskrifter förklarade"
  - "kunskapsbank arbetsmiljö och miljö"

## SEO-meta

- **Meta-titel (<=60 tecken):** Kunskapsbank — guider om lagefterlevnad & laglistor
- **Meta-beskrivning (~155 tecken):** Samlade guider om laglistor, lagbevakning och lagefterlevnad. Förstå kraven, områdena och begreppen — och hur ni gör i praktiken. Testa med ert organisationsnummer.
- **H1:** Kunskapsbank: lär dig lagefterlevnad från grunden

## Produktvinkel (hook)

Kunskapsbanken samlar allt vi vet om laglistor, lagbevakning och lagefterlevnad på ett ställe — från begrepp till bransch — så att du först förstår kravet och sedan ser hur Laglig.se löser det i praktiken.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 + hook + OrgCheck
   - Eyebrow: "Kunskapsbank"
   - Kort introtext: vad du hittar här och vem den är för (KMA-, miljö-, kvalitets- och säkerhetsansvariga).
2. **DefinitionBox — Vad är Laglig.ses kunskapsbank?**
   - H3: Skillnaden mot katalogen — här förklaras kraven, i katalogen finns själva författningarna.
   - Renderas i DefinitionBox högst upp.
3. **FeatureGrid — Lär dig per område** (kortgrid in i /omraden)
   - H3: Arbetsmiljö, miljö, brandskydd, GDPR, ledningssystem (ISO).
   - H3: Länkar till de mest besökta områdessidorna.
4. **FeatureGrid — Guider per bransch** (kortgrid in i /branscher)
   - H3: Verkstad, lantbruk, livsmedel, åkeri, BRF m.fl.
5. **FeatureGrid — Så fungerar produkten** (kortgrid in i /funktioner)
   - H3: Laglista, lagbevakning, revisionsrapport, AI-agent.
6. **OrgCheckCta** — mid-page: "Se vilka lagar som gäller just er verksamhet"
7. **CatalogLawList — Mest sökta författningarna** (länkar in i katalogen)
8. **FaqAccordion**
9. **CtaBlock + RelatedPagesGrid**

## Kataloglänkar (CatalogLawList)

- Arbetsmiljölag (SFS 1977:1160) — ramlagen för hela arbetsmiljöområdet.
- Systematiskt arbetsmiljöarbete (AFS 2023:1) — central föreskrift för SAM.
- Miljöbalk (SFS 1998:808) — grunden för miljöområdet.
- Förordning om verksamhetsutövares egenkontroll (SFS 1998:901) — egenkontroll i praktiken.
- Dataskyddsförordningen GDPR (32016R0679) — dataskydd för alla företag.
- Lag om skydd mot olyckor (SFS 2003:778) — systematiskt brandskyddsarbete.
- Plan- och bygglag (SFS 2010:900) — bygg och förvaltning.

## FAQ (3-5)

- **Vad är skillnaden mellan kunskapsbanken och lagkatalogen?**
  - Kunskapsbanken förklarar begrepp, områden och arbetssätt; katalogen är själva beståndet av författningar. Länk till /funktioner/lagkatalog.
- **Var börjar jag om jag är ny på lagefterlevnad?**
  - Börja med områdessidorna (t.ex. /omraden/lagefterlevnad och /omraden/arbetsmiljo), gå sedan till din bransch.
- **Är innehållet juridisk rådgivning?**
  - Nej — det är arbetsstöd och pedagogik. Gällande originaltext finns alltid länkad i katalogen.
- **Hur hittar jag det som gäller just mitt företag?**
  - Gör organisationsnummerkollen så visas relevanta områden och lagar.

## Interna länkar (relatedPages)

- /omraden/lagefterlevnad
- /omraden/arbetsmiljo
- /funktioner/lagkatalog
- /ordbok
- /blogg

## Bildmaterial

- **Skärmdumpar:** Översiktsvy av katalogen + en områdesvy; wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A compliance coordinator browsing learning guides on a laptop at a shared desk in a Swedish office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."

## Källor (grundning)

- riksdagen.se / SFS, Arbetsmiljöverket (AFS), Boverket, MSB, IMY, EUR-Lex som ursprungskällor.
- Laglig egen katalog och områdes-/funktionssidor för struktur.

## Anmärkningar

- KANONISKT BESLUT (flaggas): /kunskapsbank överlappar /omraden. Rekommendation: /kunskapsbank är en HUB som aggregerar och länkar till /omraden, /branscher och /funktioner — den ska INTE duplicera områdestexterna. Låt varje områdessida vara canonical för sitt ämne; kunskapsbanken rankar på navigerande/paraply-queries ("kunskapsbank lagefterlevnad"). Undvik tunn duplicerad brödtext.
