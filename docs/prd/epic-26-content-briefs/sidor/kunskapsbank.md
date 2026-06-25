# Innehallsbrief — Kunskapsbank (hub)

- **Route:** /kunskapsbank
- **Cluster / template:** sidor-hub / index-landing
- **Sokintention:** navigational + informational
- **Ordmal:** ~500

## Nyckelord

- **Primart:** kunskapsbank lagefterlevnad
- **Sekundart:** guider lagbevakning, lar dig laglista, compliance kunskap
- **Long-tail:**
  - "hur fungerar en laglista"
  - "kom igang med lagefterlevnad"
  - "guide lagbevakning for foretag"
  - "vad ar lagefterlevnadskontroll"
  - "checklista systematiskt arbetsmiljoarbete"
  - "lar dig om miljobalken enkelt"
  - "lagar och foreskrifter forklarade"
  - "kunskapsbank arbetsmiljo och miljo"

## SEO-meta

- **Meta-titel (<=60 tecken):** Kunskapsbank — guider om lagefterlevnad & laglistor
- **Meta-beskrivning (~155 tecken):** Samlade guider om laglistor, lagbevakning och lagefterlevnad. Forsta kraven, omradena och begreppen — och hur ni gor i praktiken. Testa med ert organisationsnummer.
- **H1:** Kunskapsbank: lar dig lagefterlevnad fran grunden

## Produktvinkel (hook)

Kunskapsbanken samlar allt vi vet om laglistor, lagbevakning och lagefterlevnad pa ett stalle — fran begrepp till bransch — sa att du forst forstar kravet och sedan ser hur Laglig.se loser det i praktiken.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 + hook + OrgCheck
   - Eyebrow: "Kunskapsbank"
   - Kort introtext: vad du hittar har och vem den ar for (KMA-, miljo-, kvalitets- och saerhetsansvariga).
2. **DefinitionBox — Vad ar Laglig.ses kunskapsbank?**
   - H3: Skillnaden mot katalogen — har forklaras kraven, i katalogen finns sjalva forfattningarna.
   - Renderas i DefinitionBox hogst upp.
3. **FeatureGrid — Lar dig per omrade** (kortgrid in i /omraden)
   - H3: Arbetsmiljo, miljo, brandskydd, GDPR, ledningssystem (ISO).
   - H3: Lankar till de mest besokta omradessidorna.
4. **FeatureGrid — Guider per bransch** (kortgrid in i /branscher)
   - H3: Verkstad, lantbruk, livsmedel, akeri, BRF m.fl.
5. **FeatureGrid — Sa fungerar produkten** (kortgrid in i /funktioner)
   - H3: Laglista, lagbevakning, revisionsrapport, AI-agent.
6. **OrgCheckCta** — mid-page: "Se vilka lagar som gäller just er verksamhet"
7. **CatalogLawList — Mest sokta forfattningarna** (lankar in i katalogen)
8. **FaqAccordion**
9. **CtaBlock + RelatedPagesGrid**

## Kataloglankar (CatalogLawList)

- Arbetsmiljolag (SFS 1977:1160) — ramlagen for hela arbetsmiljoomradet.
- Systematiskt arbetsmiljoarbete (AFS 2023:1) — central foreskrift for SAM.
- Miljobalk (SFS 1998:808) — grunden for miljoomradet.
- Forordning om verksamhetsutovares egenkontroll (SFS 1998:901) — egenkontroll i praktiken.
- Dataskyddsforordningen GDPR (32016R0679) — dataskydd for alla foretag.
- Lag om skydd mot olyckor (SFS 2003:778) — systematiskt brandskyddsarbete.
- Plan- och bygglag (SFS 2010:900) — bygg och forvaltning.

## FAQ (3-5)

- **Vad ar skillnaden mellan kunskapsbanken och lagkatalogen?**
  - Kunskapsbanken forklarar begrepp, omraden och arbetssatt; katalogen ar sjalva bestandet av forfattningar. Lank till /funktioner/lagkatalog.
- **Var borjar jag om jag ar ny pa lagefterlevnad?**
  - Borja med omradessidorna (t.ex. /omraden/lagefterlevnad och /omraden/arbetsmiljo), ga sedan till din bransch.
- **Ar innehallet juridisk radgivning?**
  - Nej — det ar arbetsstod och pedagogik. Gallande originaltext finns alltid lankad i katalogen.
- **Hur hittar jag det som gäller just mitt foretag?**
  - Gor organisationsnummerkollen sa visas relevanta omraden och lagar.

## Interna lankar (relatedPages)

- /omraden/lagefterlevnad
- /omraden/arbetsmiljo
- /funktioner/lagkatalog
- /ordbok
- /blogg

## Bildmaterial

- **Skarmdumpar:** Oversiktsvy av katalogen + en omradesvy; wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A compliance coordinator browsing learning guides on a laptop at a shared desk in a Swedish office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."

## Kallor (grundning)

- riksdagen.se / SFS, Arbetsmiljoverket (AFS), Boverket, MSB, IMY, EUR-Lex som ursprungskallor.
- Laglig egen katalog och omrades-/funktionssidor for struktur.

## Anmarkningar

- KANONISKT BESLUT (flaggas): /kunskapsbank overlappar /omraden. Rekommendation: /kunskapsbank ar en HUB som aggregerar och lankar till /omraden, /branscher och /funktioner — den ska INTE duplicera omradestexterna. Lat varje omradessida vara canonical for sitt amne; kunskapsbanken rankar pa navigerande/paraply-queries ("kunskapsbank lagefterlevnad"). Undvik tunn duplicerad brodtext.
