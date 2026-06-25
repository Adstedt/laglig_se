# Innehållsbrief — Ordbok (index)

- **Route:** /ordbok
- **Cluster / template:** sidor-hub / index-landing
- **Sökintention:** informational + navigational
- **Ordmål:** ~400

## Nyckelord

- **Primärt:** ordbok lagefterlevnad
- **Sekundärt:** begrepp lagbevakning, compliance ordlista, juridiska termer företag
- **Long-tail:**
  - "vad betyder laglista"
  - "vad är lagbevakning"
  - "begrepp inom lagefterlevnad förklarade"
  - "ordlista arbetsmiljö och miljö"
  - "vad är en kravpunkt"
  - "compliance termer på svenska"
  - "vad betyder egenkontroll"
  - "förklaring av branschvanliga begrepp"

## SEO-meta

- **Meta-titel (<=60 tecken):** Ordbok — begrepp inom lagefterlevnad & laglistor
- **Meta-beskrivning (~155 tecken):** Ordbok som förklarar begrepp inom lagefterlevnad, lagbevakning och laglistor på enkel svenska. Slå upp termen — se sedan hur den fungerar i Laglig.se.
- **H1:** Ordbok: begrepp inom lagefterlevnad

## Produktvinkel (hook)

Ordboken förklarar de begrepp som dyker upp när man arbetar med laglistor och lagbevakning — laglista, kravpunkt, egenkontroll, revisionsrapport — i klarspråk, och länkar vidare till hur varje sak fungerar i Laglig.se.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 + kort introtext + ev. sökfält/alfabetisk filter
   - Eyebrow: "Ordbok"
2. **DefinitionBox — Vad är den här ordboken?**
   - H3: Klarspråk, inte juridisk rådgivning; länkar till katalog och funktioner.
   - Renderas i DefinitionBox högst upp.
3. **FeatureGrid — Begrepp A–Ö** (kortgrid med uppslagsorden; primärt innehåll)
   - H3: Varje kort = term + kort definition + länk till termsidan.
4. **FeatureGrid — Populära uppslag**
   - H3: Laglista, lagbevakning, egenkontroll, kravpunkt, revisionsrapport.
5. **OrgCheckCta** — mid-page: "Se begreppen tillämpade på er verksamhet"
6. **CatalogLawList — Centrala författningar som begreppen rör**
7. **FaqAccordion**
8. **CtaBlock + RelatedPagesGrid**

## Kataloglänkar (CatalogLawList)

- Arbetsmiljölag (SFS 1977:1160) — källan till många arbetsmiljöbegrepp.
- Systematiskt arbetsmiljöarbete (AFS 2023:1) — definierar SAM.
- Miljöbalk (SFS 1998:808) — bakgrund till miljöbegrepp.
- Förordning om verksamhetsutövares egenkontroll (SFS 1998:901) — definierar egenkontroll.
- Dataskyddsförordningen GDPR (32016R0679) — dataskyddsbegrepp.

## FAQ (3-5)

- **Vad är skillnaden mellan ordboken och kunskapsbanken?**
  - Ordboken är korta uppslag/definitioner; kunskapsbanken är guider/fördjupning. Länk till /kunskapsbank.
- **Är definitionerna juridiskt bindande?**
  - Nej — de är pedagogiska förklaringar; gällande författningstext finns i katalogen.
- **Vad betyder laglista?**
  - Kort definition + länk till /ordbok/laglista och /omraden/lagefterlevnad.
- **Hittar jag branschspecifika begrepp?**
  - Ja där de finns; annars länk till relevant /branscher- eller /omraden-sida.

## Interna länkar (relatedPages)

- /ordbok/laglista
- /kunskapsbank
- /omraden/lagefterlevnad
- /funktioner/lagkatalog

## Bildmaterial

- **Skärmdumpar:** (Låg prioritet på indexnivån.) Ev. en termsida med definition + länk till funktion; wrap i ScreenshotFrame.
- **Personbild (prompt):** (Utelämnas — ren referenssida; ingen personbild behövs.)

## Källor (grundning)

- riksdagen.se / SFS och EUR-Lex för legaldefinitioner; Arbetsmiljöverket (AFS) för arbetsmiljötermer.
- Laglig egen produkt för produktnära begrepp (kravpunkt, revisionsrapport).

## Anmärkningar

- Kanonisk: /ordbok är listsida; varje term (/ordbok/{term}) är egen canonical. Risk för tunn överlapp mot /omraden — ordbokstermen ska vara KORT definition + länk, inte en omfattande områdestext. /ordbok/laglista finns redan; flagga att termsidorna inte får kannibalisera /omraden eller /funktioner — länka istället.
