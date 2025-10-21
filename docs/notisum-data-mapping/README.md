# Notisum Data Source Mapping

**Purpose:** Factual documentation of data types, document structures, and source identification

**Status:** Work in progress - systematically reviewing each section

**Screenshots:** All reference screenshots are stored in `./screenshots/` folder

---

## Document Types Analyzed

### Regelsamling → Svensk lagstiftning
1. [Lagar och förordningar (SFS)](./01-lagar-och-forordningar.md) ✅ Documented
2. Ändringar i lagboken - _Pending_ (likely same data as #1, different view)
3. Senaste ändringar - _Pending_ (likely same data as #1, different view)
4. Upphävda - _Pending_ (likely same data as #1, different view)
5. Ikraftträdanden - _Pending_ (likely same data as #1, different view)

### Regelsamling → Svensk lagstiftning → Förarbeten regering
1. [Propositioner (Government Bills)](./06-propositioner.md) ✅ Documented
2. Kommittédirektiv - ⚠️ External link only (https://www.regeringen.se/rattsliga-dokument/kommittedirektiv/)
3. [Statens offentliga utredningar (SOU)](./07-sou.md) ⚠️ Documented (external link only)
4. [Förordningsmotiv (Ordinance Explanations)](./08-forordningsmotiv.md) ⚠️ Documented (sparse data, many dead links)
5. [Departementsserien (Ds)](./09-departementsserien.md) ⚠️ Documented (external link only)
6. Lagrådet - ⚠️ External link only (https://www.lagradet.se/yttranden/)

### Regelsamling → Svensk lagstiftning → Förarbeten riksdag
**Note:** ALL parliamentary preparatory works are external links only to riksdagen.se
1. Motioner - ⚠️ External link only (https://www.riksdagen.se/sv/sok/?avd=dokument&doktyp=mot)
2. Framställanden och redogörelser - ⚠️ External link only (https://www.riksdagen.se/sv/sok/?avd=dokument&doktyp=frsrdg)
3. Betänkanden - ⚠️ External link only (https://www.riksdagen.se/sv/dokument-och-lagar/Utskottens-dokument/Betankanden/)
4. Yttranden - ⚠️ External link only (https://www.riksdagen.se/sv/dokument-och-lagar/Utskottens-dokument/Yttranden/)
5. Protokoll - ⚠️ External link only (https://www.riksdagen.se/sv/sok/?avd=dokument&doktyp=uprotokoll)
6. Skrivelser - ⚠️ External link only (https://www.riksdagen.se/sv/sok/?avd=dokument&doktyp=rskr)

### Regelsamling → Europalagstiftning
1. [Förordningar (EU Regulations)](./02-eu-forordningar.md) ✅ Documented
2. [Direktiv (EU Directives)](./03-eu-direktiv.md) ✅ Documented
3. [Alla rättsakter (All EU Legal Acts)](./04-eu-alla-rattsakter.md) ✅ Documented
4. [EU-domstolen (EU Court Case Law)](./05-eu-domstolen.md) ✅ Documented
5. Other EU document types - _Pending_ (likely same pattern)

### Regelsamling → Rättsfall (Swedish Court Case Law)
1. [Högsta domstolen (Supreme Court - NJA)](./10-rattsfall-hogsta-domstolen.md) ✅ Documented
2. [Hovrätterna (Courts of Appeal - RH)](./11-rattsfall-hovratterna.md) ✅ Documented
3. [Högsta förvaltningsdomstolen (Supreme Administrative Court - HFD/RÅ)](./12-rattsfall-hogsta-forvaltningsdomstolen.md) ✅ Documented
4. [Arbetsdomstolen (Labour Court - AD)](./13-rattsfall-arbetsdomstolen.md) ⚠️ Documented (broken - empty pages)
5. [Patent- och marknadsdomstolen (MD)](./14-rattsfall-patent-marknadsdomstolen.md) ✅ Documented (historical only, closed 2016)
6. [Mark- och miljööverdomstolen (MÖD)](./15-rattsfall-mark-miljooverdomstolen.md) ✅ Documented
7. [Migrationsöverdomstolen (MIG)](./16-rattsfall-migrationsoverdomstolen.md) ✅ Documented
8. [Justitieombudsmannen (JO)](./17-rattsfall-justitieombudsmannen.md) ⚠️ Documented (limited content, broken links)
9. [Justitiekanslern (JK)](./18-rattsfall-justitiekanslern.md) ⚠️ Documented (outdated - ends 2014, broken links)

### Standardlaglistor
- Arbetsmiljö - _Pending_
- Miljö - _Pending_
- Other lists - _Pending_

### Other Sections
- Ämnesfokus - _Pending_
- Bevakning - _Pending_
