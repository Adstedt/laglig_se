# Notisum Change Notification Analysis

**Date:** 2025-11-03
**Source:** Live Notisum account signup and law change notifications
**Analyzed by:** Mary (Business Analyst)

---

## Email Examples Received

### Email 1: Arbetsmiljö (Work Environment Law)

- **Subject:** "Notisums laglistor - Ändring i laglistan 'Arbetsmiljö'"
- **Law Changed:** Lag (1991:1047) om sjuklön (Sick Pay Act)
- **Update Info:** SFS 2025:938
- **Latest Amendment:** SFS 2025:938 om ändring i lagen (1991:1047) om sjuklön, ändr: 26 §
- **Effective Date:** December 1, 2025
- **Change Summary:** Ändrad hänvisning till socialförsäkringsbalken i fråga om Försäkringskassans handläggning av ärenden enligt 10, 11, 13, 14, 16 och 20 §§ samt 24 § andra stycket och 27 § andra stycket.

### Email 2: Hälsa och sjukvård Sverige (Health and Healthcare Sweden)

- **Subject:** "Notisums laglistor - Ändring i laglistan 'Hälsa och sjukvård Sverige'"
- **Multiple Laws Changed:**
  1. **Lag (2009:366) om handel med läkemedel** - SFS 2025:923
     - Latest: SFS 2025:923, ändr: 2 kap. 6 §
     - Also: SFS 2025:922, ändr: 2 kap. 6 §
  2. **Offentlighets- och sekretesslag (2009:400)** - SFS 2025:941
     - Latest: SFS 2025:941, ändr: 28 kap. 4 §
     - Also: SFS 2025:934, ändr: ny 10 kap. 15 a §, rubr: närmast före 10 kap. 15 a §
     - **Full change text provided:** Long paragraph explaining insurance companies can request information about physical/legal persons...
     - Effective Date: December 1, 2025
  3. **Socialförsäkringsbalk (2010:110)** - SFS 2025:937
     - Latest: SFS 2025:937, ändr: 110 kap. 14, 20, 29, 31, 32, 33 §§, 115 kap. 4 §, rubr: närmast före 110 kap. 31, 33 §§; nya 110 kap. 31 a, 31 b, 31 c, 31 d §§, rubr: närmast före 31 a, 31 b, 31 c, 31 d §§

### Email 3: Arbetsmiljö för ett tjänsteföretag (Work Environment for a Service Company)

- **Subject:** "Notisums laglistor - Ändring i laglistan 'Arbetsmiljö för ett tjänsteföretag'"
- **Law Changed:** Same as Email 1 - Lag (1991:1047) om sjuklön
- **Same details as Email 1**

---

## Email Structure Analysis

### Header

```
Från: noreply@notisum.se
Till: Alexander Adstedt
Datum: mån 2025-11-03 09:19
```

### Body Structure

1. **Greeting:** "Hej"
2. **Context Statement:** "I din bevakade laglista med namnet '[List Name]' finns ändringar att hantera."
3. **Action Prompt:** "Du har följande ändringar att kvittera"
4. **Section Header:** "Svensk Författningssamling, SFS"
5. **Law Entry:**
   - **Law Title with Link:** e.g., "Lag (1991:1047) om sjuklön"
   - **Update Info:** "har nu uppdateringsinformationen SFS 2025:938"
6. **Subsection:** "Senaste ändring" or "Senaste ändringar" (if multiple)
7. **Amendment Details:**
   - **SFS Link:** e.g., "SFS 2025:938"
   - **Description:** "Lag (2025:938) om ändring i lagen (1991:1047) om sjuklön"
   - **Changed Sections:** "ändr: 26 §"
8. **Change Text Box (sometimes):**
   - Grey box with full text of what changed
   - "Ikraftträdande [date]"
9. **CTA:** "Gå till www.notisum.se för att logga in och granska dessa ändringar."
10. **Footer:**
    - "Meddelandet är automatiskt skickat av tjänsten Notisum."
    - "Avbeställare är noreply@notisum.se"
    - Company info: "Notisum AB | Box 4229, 203 13 MALMÖ"
    - Contact: "Tel: +46 8-622 14 10 | support@notisum.se | www.notisum.se"

---

## Key Observations

### ✅ What Works Well

1. **Multiple Law Lists Tracked**
   - Each list has its own name ("Arbetsmiljö", "Hälsa och sjukvård Sverige", etc.)
   - Shows user can organize laws by topic/business area
   - Personalized subject line with list name

2. **Clear Law Identification**
   - Law number (1991:1047)
   - Law title (om sjuklön)
   - SFS amendment number (2025:938)
   - Specific sections changed (ändr: 26 §)

3. **Multiple Link Types**
   - Link to law page on Notisum
   - Link to official PDF from Riksdagen
   - Gives users choice of detail level

4. **Structured Information Hierarchy**
   - Law → Amendment → Sections → Change text → Effective date
   - Easy to scan

5. **Effective Date Provided**
   - "Ikraftträdande 1 december 2025"
   - Users know when to comply

6. **Professional Tone**
   - Clear, direct Swedish
   - No marketing fluff
   - Focuses on actionable information

### ❌ Weaknesses / Opportunities for Laglig.se

1. **NO Plain Language Summary**
   - ❌ Just shows legal text verbatim
   - ❌ No "What this means for you" explanation
   - ❌ No AI-generated summary
   - **Opportunity:** Laglig.se can add plain Swedish summaries

2. **NO Business Impact Assessment**
   - ❌ Doesn't explain "Why this matters to your business"
   - ❌ No risk level (High/Medium/Low)
   - ❌ No "Action required" vs "FYI only"
   - **Opportunity:** Laglig.se can add business context

3. **NO Contextual Explanation**
   - ❌ Doesn't explain what § 26 does in the law
   - ❌ No background on why the change was made
   - ❌ No link to government proposition explaining reasoning
   - **Opportunity:** Laglig.se can provide context

4. **Generic Call-to-Action**
   - ❌ "Go log in and review" - very passive
   - ❌ No specific next steps
   - ❌ No urgency indication
   - **Opportunity:** Laglig.se can suggest specific actions

5. **NO Visual Diff**
   - ❌ Shows full new text in grey box
   - ❌ No before/after comparison
   - ❌ No GitHub-style diff highlighting
   - **Opportunity:** Laglig.se can show visual diffs (PRD Story 8.5)

6. **NO Priority Indication**
   - ❌ All changes treated equally
   - ❌ No way to know if this is critical or minor
   - **Opportunity:** Laglig.se can add priority levels

7. **NO Acknowledgment Workflow in Email**
   - ❌ Must go to website to "kvittera" (acknowledge)
   - ❌ No inline "Mark as reviewed" button
   - **Opportunity:** Laglig.se could add email buttons (future)

8. **NO Related Changes**
   - ❌ Doesn't show if this change affects other laws in your list
   - ❌ No "Also changed" section for related laws
   - **Opportunity:** Laglig.se can show cross-impacts

9. **Technical Language Only**
   - Uses terms like "ändr:", "rubr:", "nya §§"
   - Assumes user understands legal notation
   - **Opportunity:** Laglig.se can explain notation

10. **NO Personalization Beyond List Name**
    - ❌ Doesn't reference user's industry
    - ❌ Doesn't highlight sections relevant to user's role
    - **Opportunity:** Laglig.se can personalize by SNI/role

---

## Email Metadata

### Sender

- **From:** noreply@notisum.se
- **Reply-to:** noreply@notisum.se (can't reply)
- **No personal account manager mentioned**

### Timing

- **Sent:** Monday 2025-11-03 09:19 (morning)
- **All three emails sent same time** (batch job)
- Likely daily morning digest

### Security Warning

- Outlook warning: "Om meddelandet inte visas som det ska kan du klicka här för att visa det i en webbläsare."
- Note about auto-download blocked for security

---

## Change Detection Depth Analysis

### What Notisum Tracks

- ✅ New SFS amendments
- ✅ Section changes (which § changed)
- ✅ Multiple amendments per law (shows all recent)
- ✅ Section additions ("nya 110 kap. 31 a")
- ✅ Section heading changes ("rubr: närmast före...")
- ✅ Effective dates

### What Notisum Shows

- Full text of changed paragraphs (sometimes)
- SFS number of amending law
- Link to official PDF
- List of all sections affected

### Granularity

- **Good:** Shows specific section numbers
- **Good:** Shows if new sections added
- **Missing:** No before/after comparison
- **Missing:** No explanation of impact

---

## User Workflow Implied

1. **User receives email** (morning, daily batch?)
2. **Scans subject** - Which law list was affected?
3. **Opens email** - Sees law name and SFS number
4. **Reads change summary** - Which sections changed
5. **Optional:** Reads full change text in grey box
6. **Clicks link** to Notisum or official PDF
7. **Must log in to Notisum** to "kvittera" (acknowledge)
8. **Repeat for each law changed**

**Pain points in workflow:**

- Must leave email to acknowledge
- No way to see if change is urgent
- No guidance on what to do about change
- Legal text is dense and technical

---

## Competitive Differentiation Opportunities for Laglig.se

### 1. AI-Powered Plain Language Summaries (HIGH IMPACT)

**Notisum:** Shows raw legal text only
**Laglig.se:** Add AI summary at top:

```
📋 Summary: This change updates references to Försäkringskassan's
handling procedures in sections 10, 11, 13, 14, 16, and 20.

💼 Impact for your business: Low - Administrative reference update,
no action required unless you handle sick pay claims directly.

⏰ Effective: December 1, 2025
```

### 2. Business Context & Action Guidance (HIGH IMPACT)

**Notisum:** No context
**Laglig.se:** Add impact assessment:

```
🎯 What this means for restaurants:
- If you process sick pay claims, note the updated Försäkringskassan references
- No changes to how you report sick leave to employees
- No immediate action required

✅ Recommended action: Review sick pay procedures before Dec 1
```

### 3. Priority Levels (MEDIUM IMPACT)

**Notisum:** All changes equal
**Laglig.se:** Add visual priority:

```
🔴 HIGH PRIORITY - Action required by Dec 1
🟡 MEDIUM - Review recommended
🟢 LOW - FYI only (reference update)
```

### 4. Visual Diffs (MEDIUM IMPACT)

**Notisum:** Full text in grey box
**Laglig.se:** GitHub-style diff (as in PRD Story 8.5):

```
- Ändrad hänvisning till socialförsäkringsbalken i fråga om
- Försäkringskassans handläggning av ärenden enligt 10, 11, 13...
+ Ändrad hänvisning till socialförsäkringsbalken i fråga om
+ Försäkringskassans handläggning av ärenden enligt 10, 11, 13,
+ 14, 16 och 20 §§...
```

### 5. Related Changes (MEDIUM IMPACT)

**Notisum:** Each law isolated
**Laglig.se:** Show connections:

```
🔗 This change also affects:
- Lag (2009:366) om handel med läkemedel (in your list)
- 2 other laws in your industry
```

### 6. Inline Acknowledgment (LOW IMPACT, POST-MVP)

**Notisum:** Must go to website
**Laglig.se:** Email button (future):

```
[Mark as Reviewed] [View Details] [Ask AI About This]
```

### 7. Smart Grouping (MEDIUM IMPACT)

**Notisum:** Separate email per list
**Laglig.se:** Could group:

```
📧 Daily Digest - 3 laws changed across 2 lists
HIGH PRIORITY (1) | MEDIUM (1) | LOW (1)
```

### 8. Contextual Help (HIGH IMPACT)

**Notisum:** Assumes legal knowledge
**Laglig.se:** Explain notation:

```
📖 "ändr: 26 §" means section 26 was modified
📖 "nya §§" means new sections were added
📖 "rubr:" means heading was changed
```

---

## Technical Implementation Notes

### Email Format

- **HTML email** (not plain text)
- **Responsive design** (works on mobile based on structure)
- **Links use query params:** `?id=19911047`
- **PDF links:** Direct to Riksdagen PDF

### Data Sources Confirmed

- Notisum monitors Riksdagen API for SFS updates
- Pulls official PDFs from Riksdagen
- Stores "uppdateringsinformationen" metadata

### Change Detection Logic Inferred

1. Daily check of Riksdagen API for new SFS entries
2. Match SFS numbers to laws in user's lists
3. Extract changed sections from SFS metadata
4. Generate email per law list
5. Send batch in morning (09:19 in this example)

---

## Epic 8 PRD Validation

These emails **validate** several PRD Epic 8 assumptions:

### ✅ Validated

- **FR8:** Daily monitoring of law changes via Riksdagen API ✅
- **FR9:** Email notifications when laws in user's list change ✅
- **FR11:** "Changes" tab with "Mark as reviewed" workflow ✅ (Notisum has "kvittera")
- **FR24:** Individual law pages show change history ✅
- **FR38:** Display effective dates and source document links ✅

### 🆕 New Insights for PRD

- **Multiple law lists per user** - Notisum supports this, we should too
- **Batch notifications** - Send morning digest, not real-time per change
- **Section-level granularity** - Show which § changed, not just "law updated"
- **Official PDF links** - Provide link to Riksdagen PDF source
- **"Senaste ändringar" (plural)** - Show multiple recent amendments, not just latest

---

## Recommendations for Laglig.se Epic 8

### Must-Have (Core Parity)

1. ✅ Daily Riksdagen API monitoring
2. ✅ Email notifications per law list
3. ✅ Section-level change detection (which § changed)
4. ✅ Effective date display
5. ✅ Link to official source (Riksdagen PDF)
6. ✅ Acknowledgment workflow ("kvittera" / mark as reviewed)

### Differentiation (Competitive Advantage)

1. 🚀 **AI plain language summaries** (GPT-4 generated)
2. 🚀 **Business impact assessment** (High/Medium/Low priority)
3. 🚀 **Action guidance** ("Review by Dec 1", "No action needed", etc.)
4. 🚀 **Visual diffs** (GitHub-style before/after)
5. 🚀 **Contextual help** (Explain legal notation)
6. 🚀 **Related changes** (Show cross-impacts)
7. 🚀 **Industry-specific framing** (Tailor language to user's SNI)

### Post-MVP Enhancements

8. 📧 Inline email buttons (mark as reviewed without login)
9. 📧 Smart grouping (single digest with priority sorting)
10. 🔔 Slack/Teams integration (FR mentioned but post-MVP)

---

## Sample Laglig.se Email (Concept)

```
Subject: 🔔 Arbetsmiljö - 1 ny lagändring att granska

Hej Alexander,

En lag i din lista "Arbetsmiljö" har ändrats och träder i kraft 1 december 2025.

────────────────────────────────────────

🟢 LAG UPPDATERAD (Låg prioritet)

Lag (1991:1047) om sjuklön
Ändring: SFS 2025:938

📋 Sammanfattning på svenska:
Denna ändring uppdaterar hänvisningar till Försäkringskassans
handläggningsprocedurer i § 26. Det är en administrativ uppdatering
som inte påverkar hur du rapporterar sjukfrånvaro för dina anställda.

💼 Påverkan för ditt företag (Restaurang):
Ingen åtgärd krävs. Detta är en teknisk referensuppdatering mellan
myndigheter. Dina rutiner för sjuklön fortsätter som vanligt.

🔍 Vad ändrades:
§ 26 - Uppdaterade referenser till socialförsäkringsbalken

📅 Träder i kraft: 1 december 2025

[Visa fullständiga ändringar] [Fråga AI om detta] [Markera som granskad]

────────────────────────────────────────

📖 Förklaring: "ändr: 26 §" betyder att paragraf 26 har modifierats.

Officiella källor:
• Riksdagen PDF: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/...
• Fullständig lag: https://laglig.se/lagar/1991-1047

Hälsningar,
Laglig.se

PS: Du har inga fler ändringar att granska. Bra jobbat! 👍
```

---

## Conclusion

Notisum's change notifications are **functional but basic**. They provide accurate technical information but lack:

- Plain language explanations
- Business context
- Priority indication
- Action guidance
- Visual improvements (diffs)

**Laglig.se has significant differentiation opportunity** by adding AI-powered summaries, business impact assessments, and better UX while maintaining the same technical accuracy.

The email structure and timing (morning batch digest) should be replicated, but the content should be enhanced with the features outlined above.

---

## Files Created

- This analysis document

## Next Steps

1. ✅ Validate Epic 8 stories against these findings
2. ✅ Update Story 8.2 (email notifications) to include Notisum patterns
3. ✅ Add new story for AI plain language summaries if not already covered
4. Consider adding "Multiple law lists per workspace" to FR if not present
5. Design Laglig.se email template based on this analysis
