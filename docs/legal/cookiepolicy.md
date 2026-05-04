---
status: DRAFT — pending review by Swedish counsel before publishing
last-updated: 2026-04-30
target-route: /cookiepolicy
---

# Cookiepolicy

> **DRAFT — får ej publiceras innan juridisk granskning.** Den faktiska cookielistan i avsnitt 4 måste verifieras mot prod-bygget. Kör en cookie-scan (t.ex. Cookiebot, OneTrust eller manuell DevTools-genomgång) på laglig.se innan publicering. Cookiebanner-implementationen måste blockera kategori 2–4 tills samtycke ges.

**Senast uppdaterad:** [FYLL I — datum vid publicering]

Denna cookiepolicy beskriver hur Laglig.se använder cookies och liknande tekniker på laglig.se ("Tjänsten"). Policyn ska läsas tillsammans med vår [Integritetspolicy](/integritetspolicy).

## 1. Vad är cookies?

En cookie är en liten textfil som sparas på din enhet när du besöker en webbplats. Cookies används bland annat för att webbplatsen ska fungera, för att komma ihåg dina inställningar och för att samla statistik om hur webbplatsen används.

Vi använder även liknande tekniker som **localStorage**, **sessionStorage** och **pixlar** (sammantaget "cookies" i denna policy).

## 2. Rättslig grund för cookies

Enligt 6 kap. 18 § lagen (2022:482) om elektronisk kommunikation (LEK) krävs samtycke för cookies som inte är strikt nödvändiga för att tillhandahålla en tjänst som du uttryckligen begärt.

- **Strikt nödvändiga cookies** (kategori 1): kräver inte samtycke.
- **Övriga cookies** (kategori 2–4): kräver ditt samtycke. Du kan när som helst återkalla samtycket via cookieinställningarna i sidfoten.

## 3. Cookiekategorier

### Kategori 1 — Strikt nödvändiga
Krävs för att Tjänsten ska fungera (inloggning, säkerhet, sessionshantering). Kan inte stängas av.

### Kategori 2 — Funktionella
Möjliggör utökad funktionalitet och personalisering, t.ex. att komma ihåg språk eller layoutval. Aktiveras endast med samtycke.

### Kategori 3 — Statistik / analys
Hjälper oss förstå hur Tjänsten används så att vi kan förbättra den. Aktiveras endast med samtycke.

### Kategori 4 — Marknadsföring
Används för att mäta effekten av marknadsföring och visa relevanta annonser. Aktiveras endast med samtycke.

## 4. Cookies vi använder

> **[FYLL I — verifiera nedan mot faktisk produktion innan publicering. Kör en cookie-scan.]**

### Strikt nödvändiga (kategori 1)

| Namn | Leverantör | Syfte | Lagringstid |
| --- | --- | --- | --- |
| `next-auth.session-token` | Laglig.se | Inloggningssession | Session / 30 dagar |
| `next-auth.csrf-token` | Laglig.se | Skydd mot CSRF-angrepp | Session |
| `next-auth.callback-url` | Laglig.se | Hanterar omdirigering efter inloggning | Session |
| `cookieconsent` | Laglig.se | Sparar dina cookieinställningar | 12 månader |
| `__cf_bm` | Cloudflare / Vercel | Bot-skydd | 30 minuter |

### Funktionella (kategori 2)

| Namn | Leverantör | Syfte | Lagringstid |
| --- | --- | --- | --- |
| `theme` | Laglig.se | Kommer ihåg ljust/mörkt läge | 12 månader |
| `sidebar-state` | Laglig.se | Sparar om sidopanelen är öppen | 12 månader |

### Statistik / analys (kategori 3)

| Namn | Leverantör | Syfte | Lagringstid |
| --- | --- | --- | --- |
| `_ga` | Google (Google Analytics 4) | Skiljer åt unika besökare | 24 månader |
| `_ga_<container-id>` | Google (Google Analytics 4) | Sparar sessionsstatus och håller reda på besök | 24 månader |

> Google Search Console använder en metatagg eller DNS-verifiering — sätter inga cookies hos besökaren och listas därför inte i denna tabell, men finns med i [underbiträdesförteckningen](/underbitraden).

### Marknadsföring (kategori 4)

| Namn | Leverantör | Syfte | Lagringstid |
| --- | --- | --- | --- |
| `_gcl_au` | Google (Google Ads) | Konverteringslänkning för Google Ads | 90 dagar |
| `IDE` | Google (DoubleClick) | Annonsmätning och remarketing via Google Ads | 13 månader |
| `_fbp` | Meta (Meta Ads / Facebook Pixel) | Identifierar webbläsaren för annonsleverans | 90 dagar |
| `fr` | Meta | Annonsleverans och relevansmätning | 90 dagar |
| `li_sugr` | LinkedIn (Insight Tag) | Browser-identifiering för konverteringsmätning | 3 månader |
| `lidc` | LinkedIn | Routing av datacenter-trafik | 24 timmar |
| `bcookie`, `bscookie` | LinkedIn | Browser-ID för annonsering och säkerhet | 12 månader |
| `UserMatchHistory` | LinkedIn | Synkronisering av annons-ID | 30 dagar |

## 5. Hur du hanterar dina cookieinställningar

- **Vid första besök:** välj inställningar i cookiebannerns dialog.
- **Senare:** klicka på "Cookieinställningar" i sidfoten.
- **I webbläsaren:** du kan blockera eller radera cookies via webbläsarens inställningar. Notera att Tjänsten kan fungera sämre om strikt nödvändiga cookies blockeras.

Mer information om hur du hanterar cookies i din webbläsare:

- [Chrome](https://support.google.com/chrome/answer/95647)
- [Safari](https://support.apple.com/sv-se/guide/safari/sfri11471/mac)
- [Firefox](https://support.mozilla.org/sv/kb/cookies-information-webbplatser-lagrar-pa-din-dator)
- [Edge](https://support.microsoft.com/sv-se/microsoft-edge)

## 6. Tredjepartscookies och dataöverföring

Vissa cookies sätts av tredjepartsleverantörer (t.ex. analysverktyg). Dessa leverantörer kan överföra data utanför EU/EES. Se vår [Integritetspolicy](/integritetspolicy) avsnitt 7 för information om skyddsåtgärder.

## 7. Ändringar i policyn

Vi kan komma att uppdatera denna policy. Aktuell version finns alltid på laglig.se/cookiepolicy.

## 8. Kontakt

Frågor om cookies: dev@laglig.se

---

> **Granskningsanteckningar (tas bort innan publicering):**
> - **Kritiskt:** kör cookie-scan i prod innan publicering. Listan ovan är spekulativ för Cloudflare/Vercel-cookies som kanske inte sätts.
> - Beslut: vilken analysleverantör? PostHog (mer features, EU-region möjlig), Plausible (lättviktig, EU-baserad, ingen samtyckesfråga om man konfigurerar rätt), Vercel Analytics (enkelt). Påverkar kategori 3-listan och i vissa fall samtyckeskravet.
> - Cookiebanner måste implementeras med "deny by default" för kategori 2–4. Kontrollera att Vercel Analytics och Sentry replay/session-tracking inte triggar utan samtycke om aktiverat.
