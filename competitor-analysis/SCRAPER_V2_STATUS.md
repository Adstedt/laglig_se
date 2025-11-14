# Laglistor Scraper V2 - Status och Nästa Steg

## 📊 Nuläge

### ❌ Problem med V1 Scraper

Den första versionen (`laglistor-scraper.ts`) extraherade **fel data**:

**Exempel på dålig output från V1:**

```
Arbetsmiljö: Endast 5 "lagar" extraherade (borde vara 112)

Exempel på vad som extraherades:
- "Antal dokument: 112" (metadata, inte en lag)
- "Senast uppdaterad: 2025-10-19 21:06" (metadata)
- Formulärfält och knappar (inte lagar)
```

**Grundorsak:** Scrapern hittade fel tabell och extraherade metadata istället för faktiska lagposter.

### ✅ V2 Scraper Förbättringar

Den nya versionen (`laglistor-scraper-v2.ts`) har helt omskriven extraheringslogik:

**Vad den gör rätt:**

1. **Identifierar kategorirubriker** - Känner igen "01 ALLMÄNNA REGLER", "02 HR", etc.
2. **Hittar rätt tabellerader** - Söker efter rader med SFS-nummer och långa beskrivningar
3. **Extraherar komplett data:**
   - `sfs` - Primärt SFS-nummer (t.ex. "SFS 2021:890")
   - `beteckning` - Lagtitel från bold/strong text
   - `beskrivning` - Fullständig beskrivning
   - `uppdateringsdatum` - Senaste ändrings-SFS
   - `category` - Vilken kategori lagen tillhör
4. **Filtrerar bort metadata** - Skippar rader som innehåller "Antal dokument"
5. **Genererar tre format:**
   - JSON (strukturerad data)
   - CSV (Excel/Sheets-kompatibel)
   - Markdown (läsbar rapport)

## 🎯 Förväntade Resultat

När V2 scrapern körs korrekt ska den extrahera:

### Arbetsmiljö (listid=72130)

- **~112 lagar** fördelade över kategorier som:
  - 01 ALLMÄNNA REGLER
  - 02 HR-regler
  - 03 Specifika arbetsmiljöregler
  - etc.

### Miljö (listid=72129)

- **~98 lagar** fördelade över miljökategorier

### Övriga 10 laglistor

- Variabelt antal lagar, alla korrekt kategoriserade

## 🔄 Nästa Steg

### Manual Intervention Krävs

V2 scrapern är **REDO ATT KÖRAS** men kräver manuell reCAPTCHA-lösning:

```bash
cd competitor-analysis
npm run scrape-laglistor
```

**När browsern öppnas:**

1. ⏳ Vänta på att användarnamn/lösenord fylls i automatiskt
2. 🤖 **LÖS RECAPTCHA** (kan inte automatiseras)
3. 🖱️ Klicka på "Logga in"
4. ✅ Scrapern fortsätter automatiskt

**Tid:** ~5-10 minuter för alla 12 laglistor (efter login)

## 📁 Output Location

Resultaten kommer sparas i:

```
competitor-analysis/output/laglistor-data/
├── arbetsmiljo.json
├── arbetsmiljo.csv
├── arbetsmiljo.md
├── arbetsmiljo_full.png
├── miljo.json
├── miljo.csv
├── miljo.md
├── miljo_full.png
└── ... (10 fler laglistor)
```

## ✅ Verifiering

Efter körning, kontrollera:

1. **Antal extraherade lagar:**

   ```bash
   # Ska visa ~112 för Arbetsmiljö
   cat output/laglistor-data/arbetsmiljo.json | grep '"sfs":' | wc -l
   ```

2. **Kategorifördelning:**
   - Öppna `.md` filen
   - Kontrollera att kategorier som "01 ALLMÄNNA REGLER" finns
   - Verifiera att lagar är grupperade under rätt kategori

3. **Dataformat:**
   - Varje lag ska ha SFS-nummer (t.ex. "SFS 2021:890")
   - Varje lag ska ha beteckning (t.ex. "Lag (2021:890) om...")
   - Beskrivningar ska vara fullständiga (inte bara "112" eller metadata)

## 🐛 Troubleshooting

**Om färre än 112 lagar extraheras från Arbetsmiljö:**

- Kontrollera att alla kategorier expanderades (kolla screenshot)
- Verifiera att scrolling laddade allt innehåll
- Granska HTML-strukturen manuellt

**Om kategorier saknas:**

- Kategorirubrikerna kanske har annan struktur än förväntat
- Behöver eventuellt justera regex: `/^0\\d\\s+[A-ZÅÄÖ]/`

**Om timeout vid login:**

- Du har 5 minuter på dig att lösa reCAPTCHA
- Om det tar längre tid, öka timeout i `laglistor-scraper-v2.ts` rad 80

## 📝 Tekniska Detaljer

**Huvudsaklig extraheringslogik** (`laglistor-scraper-v2.ts:186-261`):

```typescript
async extractAllLaws(): Promise<LawEntry[]> {
  // 1. Hitta alla tabeller
  const allTables = document.querySelectorAll('table');

  // 2. För varje rad:
  for (const row of rows) {
    // 3. Är det en kategorirubrik?
    if (headerText.match(/^0\d\s+[A-ZÅÄÖ]/)) {
      currentCategory = headerText;
    }

    // 4. Är det en lagpost?
    const hasSFS = secondCellText.match(/SFS\s*\d{4}:\d+/i);
    if (hasSFS && !firstCellText.includes('Antal dokument')) {
      // 5. Extrahera strukturerad data
      results.push({
        category: currentCategory,
        sfs: primarySFS,
        beteckning: titleElement?.textContent,
        beskrivning: fullText.replace(beteckning, '').trim(),
        uppdateringsdatum: updateSFS
      });
    }
  }
}
```

## 🎯 Success Criteria

Scrapern är framgångsrik när:

- ✅ Arbetsmiljö: 112 lagar extraherade
- ✅ Miljö: 98 lagar extraherade
- ✅ Alla lagar har SFS-nummer
- ✅ Alla lagar har beteckning och beskrivning
- ✅ Lagar är korrekt kategoriserade
- ✅ JSON, CSV och Markdown genereras för alla listor
- ✅ Screenshots sparade

---

**Status:** Redo att köras manuellt
**Skapad:** 2025-10-20
**Uppdaterad:** 2025-10-20
