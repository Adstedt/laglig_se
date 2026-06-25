# Innehållsbrief — Aktivitetslogg & spårbarhet
- **Route:** /funktioner/aktivitetslogg
- **Cluster / template:** funktioner / FeaturePageTemplate
- **Sökintention:** commercial
- **Ordmål:** ~1000

## Nyckelord
- **Primärt:** aktivitetslogg lagefterlevnad
- **Sekundärt:** spårbarhet compliance, händelselogg laglista, vem gjorde vad när
- **Long-tail:**
  - "spårbarhet i lagefterlevnadsarbetet"
  - "logg över ändringar laglista"
  - "vem ändrade en bedömning"
  - "historik över lagefterlevnadskontroll"
  - "dokumentera beslut compliance"
  - "audit trail svenska"
  - "visa underlag för revision"
  - "spårbarhet egenkontroll miljöbalken"
  - "historik kravpunkt bedömning"

## SEO-meta
- **Meta-titel (<=60 tecken):** Aktivitetslogg & spårbarhet | Laglig.se
- **Meta-beskrivning (~155 tecken):** Se vem som gjort vad och när i laglistan. Full spårbarhet på bedömningar och ändringar — tryggt inför revision. Testa med ditt organisationsnummer.
- **H1:** Aktivitetslogg och full spårbarhet i laglistan

## Produktvinkel (hook)
Laglig.se loggar händelser i laglistan — när en bedömning ändras, ett krav tilldelas eller ett dokument bifogas — så att du alltid kan visa vad som gjorts och av vem. Det ger trygghet inför revision och vid lagändringar utan att någon behöver föra protokoll vid sidan om.

## Sidstruktur (H2/H3)
1. **Visa vad som faktiskt gjorts** — MarketingHero
   - H1 + hook: spårbarhet utan extra protokoll
   - OrgCheck-CTA i hero
2. **Vad är en aktivitetslogg i en laglista?** — DefinitionBox
   - Definition: tidsstämplad historik över händelser (bedömningar, tilldelningar, ändringar)
   - Skillnad mot fri anteckning: automatisk, kronologisk, spårbar
3. **Så ger loggen spårbarhet — steg för steg** — ProcessSteps
   - Ni arbetar som vanligt i laglistan
   - Händelser registreras automatiskt med tid och användare
   - Vid revision öppnar ni historiken och visar underlaget
4. **Historik där du behöver den** — SplitFeature (skärmdump: historik på en kravpunkt/bedömning)
   - Per kravpunkt och per kontrollcykel
   - Vad som ändrades och när
5. **Trygghet inför revision** — FeatureGrid
   - Underlag för intern och extern revision
   - Kopplar ihop med avslutad kontrollcykel och signerad revisionsrapport (PDF)
   - Stöder ansvarsskyldighet och egenkontroll
6. **Lagar där spårbarhet och dokumentation krävs** — CatalogLawList
7. **Testa på din egen verksamhet** — OrgCheckCta (mid-page)
8. **Vanliga frågor** — FaqAccordion
9. **Relaterade funktioner** — RelatedPagesGrid

## Kataloglänkar (CatalogLawList)
- Dataskyddsförordningen GDPR (EU 2016/679) — ansvarsskyldighet (accountability) förutsätter att man kan visa vad som gjorts.
- Förordning om verksamhetsutövares egenkontroll (SFS 1998:901) — löpande och dokumenterad egenkontroll.
- Miljöbalken (SFS 1998:808) — verksamhetsutövaren ska kunna visa hur efterlevnaden säkerställs.
- Arbetsmiljölagen (SFS 1977:1160) — systematiskt arbetsmiljöarbete ska kunna följas upp och visas.
- Systematiskt arbetsmiljöarbete (AFS [bekräfta nummer i katalogen]) — uppföljning och dokumentation av åtgärder.
- Bokföringslagen (SFS 1999:1078) — krav på bevarande och spårbarhet av räkenskapsinformation.

## FAQ (3-5, formulerade som riktiga sökfrågor)
- **Vad loggas i aktivitetsloggen?** Beskriv typhändelser: ändrad bedömning, tilldelad ansvarig, bifogat dokument, avslutad cykel — med tid och användare.
- **Kan jag se historiken för en enskild bedömning?** Ja — historik per kravpunkt och kontrollcykel.
- **Är loggen ett juridiskt bevis?** Förklara: ger god spårbarhet och stödjer revision/ansvarsskyldighet, men är ingen kryptografiskt signerad/tamper-proof logg; revisionsrapporten är signerad och exporteras som PDF.
- **Hjälper det mig inför en revision?** Ja — visa direkt vad som gjorts utan separata protokoll.

## Interna länkar (relatedPages)
- /funktioner/kontroller
- /funktioner/kravpunkter
- /funktioner/ansvar-samarbete
- /funktioner/lagandringar
- /funktioner/filer

## Bildmaterial
- **Skärmdumpar:** historikvy på en bedömning (ScreenshotFrame); aktivitetslogg med tidsstämplade händelser; koppling till avslutad kontrollcykel.
- **Personbild (prompt):** "Photorealistic editorial photograph. An auditor and a company representative reviewing a compliance history on a laptop together at a meeting table in a Swedish office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."

## Källor (grundning)
- EUR-Lex / IMY för GDPR ansvarsskyldighet.
- riksdagen.se/SFS för miljöbalken, förordning 1998:901, arbetsmiljölagen, bokföringslagen.
- Arbetsmiljöverket — bekräfta aktuellt föreskriftsnummer för systematiskt arbetsmiljöarbete efter 2025 års regelreform.
- Laglig.se katalog.

## Anmärkningar
Undvik formuleringar som "tamper-proof", "kryptografiskt signerad" eller "SHA-256" — spårbarhet och signerad revisionsrapport (PDF) är produktsanningen. Funktionssida; ingen kannibalisering. Avgränsa mot /funktioner/kontroller (kontroller = själva cykeln; denna sida = historiken/loggen runt den).
