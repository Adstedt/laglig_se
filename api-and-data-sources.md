# API & Data Sources for Legal Compliance Platform

## Overview
This document outlines all API integrations and data sources needed to build a hyper-personalized legal compliance platform for Swedish companies.

---

## 1. Legal Content Sources

### 1.1 Riksdagens Öppna Data (Swedish Parliament Open Data)

**Base URL:** `https://data.riksdagen.se/`

**Coverage:** 654,447 documents total

#### Document Types & Counts

| Document Type | Code | Count | Description |
|--------------|------|-------|-------------|
| Motioner | `mot` | 256,241 | Parliamentary member proposals |
| Betänkanden | `bet` | 74,405 | Committee reports |
| Propositioner | `prop` | 31,525 | Government bills |
| Protokoll | `prot` | 18,419 | Parliamentary debates |
| SFS | `sfs` | 11,336 | Swedish Code of Statutes (laws) |
| SOU | `sou` | 4,863 | Government investigations |
| Departementsserien | `ds` | 1,626 | Ministry series |
| Other | - | ~256,032 | Interpellations, questions, etc. |

#### API Endpoints

**1. Document List (Search/Filter)**
```
GET /dokumentlista/
```

**Parameters:**
- `doktyp`: Document type (sfs, prop, mot, bet, prot, sou, ds)
- `rm`: Parliamentary session (e.g., 2022/23)
- `from`: Date from (YYYY-MM-DD)
- `tom`: Date to (YYYY-MM-DD)
- `sort`: Sorting (datum, rel)
- `sortorder`: Sort order (asc, desc)
- `utformat`: Output format (json, xml, html, csv)
- `p`: Page number (20 documents per page)

**Example:**
```
https://data.riksdagen.se/dokumentlista/?doktyp=sfs&sort=datum&sortorder=desc&utformat=json&p=1
```

**2. Single Document (Full Text)**
```
GET /dokument/{dok_id}.{format}
```

**Formats:**
- `.json` - Full metadata + text
- `.text` - Plain text
- `.html` - HTML formatted

**Example:**
```
https://data.riksdagen.se/dokument/sfs-2025-873.json
```

#### Response Structure

**Document List Response:**
```json
{
  "dokumentlista": {
    "@traffar": 11336,
    "@sida": 1,
    "@nasta_sida": "...",
    "dokument": [
      {
        "id": "sfs-2025-873",
        "titel": "Förordning (2025:873)...",
        "datum": "2025-09-18",
        "organ": "Finansdepartementet",
        "dokument_url_text": "//data.riksdagen.se/dokument/sfs-2025-873.text",
        "dokument_url_html": "//data.riksdagen.se/dokument/sfs-2025-873.html"
      }
    ]
  }
}
```

**Single Document Response (SFS):**
```json
{
  "dokumentstatus": {
    "dokument": {
      "dok_id": "sfs-2025-873",
      "rm": "2025",
      "titel": "Förordning (2025:873)...",
      "datum": "2025-09-18",
      "organ": "Finansdepartementet",
      "text": "...full legal text...",
      "html": "...HTML formatted legal text..."
    }
  }
}
```

**Proposition Response:**
```json
{
  "dokumentstatus": {
    "dokument": {
      "dok_id": "HD0327",
      "rm": "2025/26",
      "nummer": "327",
      "titel": "...",
      "summary": "...",
      "relaterat_id": "...",
      "dokument_url_html": "//data.riksdagen.se/dokument/HD0327.html",
      "filbilaga": {
        "fil": {
          "url": "...pdf..."
        }
      }
    }
  }
}
```

#### Data Download Strategy

**Bulk Import (Historical):**
```python
# Paginate through all documents
base_url = "https://data.riksdagen.se/dokumentlista/"
params = {
    "doktyp": "sfs",
    "utformat": "json",
    "p": 1
}

# 11,336 SFS documents / 20 per page = ~567 pages
for page in range(1, 568):
    params["p"] = page
    response = requests.get(base_url, params=params)
    documents = response.json()["dokumentlista"]["dokument"]
    # Store in database
```

**Incremental Updates:**
```python
# Check for new/updated documents daily
params = {
    "doktyp": "sfs",
    "from": "2025-10-02",  # Yesterday
    "sort": "datum",
    "sortorder": "desc",
    "utformat": "json"
}
```

---

### 1.2 Government Agency Regulations (Myndigheters Författningar)

**Critical for Compliance - Not in Riksdagen API**

| Agency | Abbreviation | Coverage | API/Access |
|--------|--------------|----------|------------|
| Arbetsmiljöverket | AFS | Work environment | https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/ |
| Transportstyrelsen | TSFS | Transport/logistics | https://www.transportstyrelsen.se/sv/regler/transport-och-fordon/ |
| Finansinspektionen | FFFS | Financial sector | https://www.fi.se/sv/vara-register/foreskrifter/ |
| Läkemedelsverket | LVFS | Pharmaceuticals | https://www.lakemedelsverket.se/sv/regel/foreskrifter |
| Boverket | BFS | Construction | https://www.boverket.se/sv/lag--ratt/forfattningssamling/ |
| Livsmedelsverket | LIVSFS | Food safety | https://www.livsmedelsverket.se/om-oss/lagstiftning/gallande-regler |
| Datainspektionen | DIFS | Data protection | https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/ |

**Access Methods:**
- ⚠️ Most agencies don't have unified APIs
- 📄 PDF downloads from each agency website
- 🔍 Requires web scraping or manual curation
- 💰 Some aggregators (e.g., Rättsnätet.se) offer paid access

**Priority P0 Agencies:**
- Arbetsmiljöverket (AFS) - Applies to ALL employers
- Livsmedelsverket (LIVSFS) - Food/restaurant industry
- Datainspektionen (DIFS) - GDPR guidance

---

### 1.3 EU Legislation (EUR-Lex)

**Base URL:** `https://eur-lex.europa.eu/`

**API:** SPARQL endpoint available
- Documentation: https://eur-lex.europa.eu/content/help/data-reuse/webservice.html

**Key Regulations for Swedish Companies:**
- GDPR (EU 2016/679)
- REACH (Chemicals)
- Machinery Directive
- NIS2 Directive (Cybersecurity)
- EU Taxonomy (Sustainability)

**Integration:**
- Direct API queries for specific regulations
- Focus on directives that apply directly (not transposed to SFS)

---

### 1.4 Consolidated Law Database (Rättsnätet.se)

**URL:** `https://lagen.nu/`

**Coverage:**
- Consolidated versions of laws (with all amendments applied)
- Cross-references between laws
- Historical versions

**Access:**
- 🆓 Website scraping possible (check ToS)
- 💰 May offer commercial API access
- ⚠️ Alternative: Build consolidation logic from SFS changes

---

## 2. Company Data Sources

### 2.1 Bolagsverket (Swedish Companies Registration Office)

**Open Data Portal:** `https://data.bolagsverket.se/`

**Available Data:**
- Organization number (Organisationsnummer)
- Company name
- Legal form (AB, HB, etc.)
- SNI code (Industry classification)
- Registration date
- Number of employees (ranges)
- Registered address

**API Access:**
```
# Example: Company search
https://data.bolagsverket.se/api/v1/company/{org_number}
```

**Data Format:** XML, JSON

**Update Frequency:** Daily

**Use Case:**
```
Input: 556789-1234
→ Output: {
    "name": "Café Kärlek AB",
    "sni_code": "56.10",  // Restaurants and food service
    "employees": "5-9",
    "legal_form": "AB"
  }
```

---

### 2.2 SCB (Statistics Sweden)

**SNI Code Database:** `https://www.scb.se/vara-tjanster/oppna-data/`

**SNI 2007 Classification:**
- 21 sections (A-U)
- 88 divisions
- 272 groups
- 615 classes

**Example SNI Codes:**
| Code | Description | Triggered Laws |
|------|-------------|----------------|
| 56.10 | Restaurants | Livsmedelslag, Alkohollag, AFS |
| 62.01 | Computer programming | GDPR, Upphovsrättslagen |
| 41.20 | Construction of buildings | PBL, Arbetsmiljölagen, Miljöbalken |
| 47.11 | Retail sale in non-specialized stores | Kassaregisterlagen, GDPR |

**API/Access:**
- Open data downloads (CSV, Excel)
- No real-time API for company lookup
- Use for SNI → Law mapping table

---

### 2.3 Allabolag.se / Retriever Business (Commercial)

**URL:** `https://www.allabolag.se/`

**API:** Retriever Business API (paid)

**Additional Data:**
- Financial statements
- Credit ratings
- Industry classifications (more detailed than SNI)
- Related companies
- Board members
- Auditors

**Pricing:** ~5-20 SEK per company lookup

**Use Case:**
- Enhanced company profile
- Risk assessment
- Better industry classification

---

### 2.4 Website Analysis (URL Input)

**Web Scraping Strategy:**

```python
# 1. Fetch website content
import requests
from bs4 import BeautifulSoup

def analyze_company_website(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Extract key content
    text_content = soup.get_text()
    meta_description = soup.find('meta', {'name': 'description'})

    return {
        "content": text_content,
        "meta": meta_description
    }
```

**AI-Powered Activity Detection:**

```python
# 2. LLM analysis for business signals
analysis_prompt = f"""
Analyze this Swedish company website:

{website_content}

Extract:
1. Primary business activities (specific services/products)
2. Target customers (B2B, B2C, schools, healthcare, etc.)
3. Special operations (delivery, events, exports, online sales)
4. Certifications mentioned (ISO, KRAV, Fairtrade, etc.)
5. Risk indicators (alcohol, food, personal data, chemicals, children)
6. Number of locations/employees if mentioned

Return as structured JSON.
"""

signals = llm.extract(analysis_prompt)
```

**Activity Signals → Law Triggers:**

| Website Signal | Triggered Laws |
|----------------|----------------|
| "serverar alkohol" | Alkohollag (SFS 2010:1622) |
| "skolmat", "skola" | Livsmedelslag + Skollagen |
| "utkörning", "delivery" | Arbetstidslagen (obekväm arbetstid) |
| "personuppgifter", "kundklubb" | GDPR |
| "export", "international" | Tullregler, EU-förordningar |
| "kemikalier" | REACH, Kemikalielagen |
| "barnverksamhet" | Socialtjänstlagen |
| "hälso- och sjukvård" | Patientsäkerhetslagen |
| "ISO 9001" | Quality management triggers |
| "ISO 14001" | Environmental law triggers |
| "ISO 27001" | Data protection law triggers |

---

## 3. Data Integration Architecture

### 3.1 Company Profile Enrichment Pipeline

```
Step 1: Organization Number Input
↓
Step 2: Bolagsverket Lookup
  → SNI code, employees, legal form
↓
Step 3: URL Analysis (if provided)
  → Web scraping → Content extraction
  → LLM analysis → Activity signals
↓
Step 4: Merge & Enrich
  → Combined profile with confidence scores
```

**Data Model:**
```json
{
  "org_number": "556789-1234",
  "company_name": "Café Kärlek AB",
  "sni_code": "56.10",
  "sni_description": "Restauranger och caféer",
  "employees": "5-9",
  "legal_form": "AB",
  "data_sources": ["bolagsverket", "website"],
  "website_analysis": {
    "url": "https://cafekarlек.se",
    "activities": [
      "café",
      "catering",
      "event services"
    ],
    "signals": {
      "food_service": true,
      "alcohol": false,
      "delivery": true,
      "personal_data": true,
      "certifications": ["ekologiskt"]
    }
  },
  "confidence": 0.92
}
```

---

### 3.2 Law Mapping Database

**SNI → Law Mapping Table:**

```sql
CREATE TABLE sni_law_mapping (
  id SERIAL PRIMARY KEY,
  sni_code VARCHAR(10),
  law_id VARCHAR(50),  -- References SFS or agency regulation
  relevance_score FLOAT,  -- 0.0 to 1.0
  mandatory BOOLEAN,
  employee_threshold INT,  -- Null if applies regardless
  description TEXT
);

-- Example entries
INSERT INTO sni_law_mapping VALUES
  (1, '56.10', 'sfs-2006-804', 1.0, true, NULL, 'Livsmedelslag - applies to all food businesses'),
  (2, '56.10', 'sfs-2010-1622', 0.8, false, NULL, 'Alkohollag - only if serving alcohol'),
  (3, '56.10', 'afs-2001-1', 1.0, true, 1, 'Systematiskt arbetsmiljöarbete');
```

**Activity Signal → Law Triggers:**

```sql
CREATE TABLE activity_law_triggers (
  id SERIAL PRIMARY KEY,
  activity_keyword VARCHAR(100),
  law_id VARCHAR(50),
  trigger_type VARCHAR(50),  -- 'mandatory', 'conditional', 'recommended'
  confidence_threshold FLOAT
);

-- Example
INSERT INTO activity_law_triggers VALUES
  (1, 'serverar alkohol', 'sfs-2010-1622', 'mandatory', 0.9),
  (2, 'skolmat', 'sfs-2010-800', 'mandatory', 0.85),
  (3, 'ISO 27001', 'gdpr', 'recommended', 0.7);
```

---

### 3.3 Hybrid Law Retrieval

**Method 1: Rule-based (Metadata)**
```python
def get_laws_by_rules(company_profile):
    laws = []

    # Universal laws
    if company_profile.employees > 0:
        laws.append('arbetsmiljölagen')

    laws.append('gdpr')  # Applies to all

    # SNI-based
    laws.extend(
        db.query("SELECT law_id FROM sni_law_mapping WHERE sni_code = ?",
                 company_profile.sni_code)
    )

    # Activity-based
    for signal, detected in company_profile.signals.items():
        if detected:
            laws.extend(
                db.query("SELECT law_id FROM activity_law_triggers WHERE activity_keyword = ?",
                         signal)
            )

    return laws
```

**Method 2: Vector Search (Semantic)**
```python
def get_laws_by_semantic_search(business_description):
    # Generate embedding of business description
    query_embedding = embed(business_description)

    # Search law database with embeddings
    results = db.vector_search(
        query_embedding,
        table='laws',
        top_k=50,
        filters={'active': True}
    )

    return results
```

**Method 3: LLM Ranking + Explanation**
```python
def rank_and_explain_laws(company_profile, candidate_laws):
    prompt = f"""
    Company Profile:
    - Name: {company_profile.name}
    - Industry: {company_profile.sni_description}
    - Employees: {company_profile.employees}
    - Activities: {company_profile.activities}

    Candidate Laws: {candidate_laws}

    For each law:
    1. Assign relevance score (0-100)
    2. Explain WHY it applies to THIS company specifically
    3. Give concrete examples from their operations
    4. Indicate priority (must-have, conditional, nice-to-have)

    Return as JSON.
    """

    return llm.analyze(prompt)
```

---

## 4. API Rate Limits & Costs

### Free APIs
| Source | Rate Limit | Cost |
|--------|-----------|------|
| Riksdagen API | Unknown (generous) | Free |
| Bolagsverket Open Data | Unknown | Free |
| SCB Open Data | N/A (downloads) | Free |

### Paid APIs
| Source | Cost per Lookup | Notes |
|--------|----------------|-------|
| Retriever Business | ~5-20 SEK | Detailed company data |
| Allabolag API | Similar | Alternative to Retriever |

### LLM Costs (per company analysis)
| Model | Input Tokens | Output Tokens | Cost/Analysis |
|-------|-------------|---------------|---------------|
| GPT-4 | ~2000 | ~1000 | ~$0.08 |
| GPT-4o-mini | ~2000 | ~1000 | ~$0.01 |
| Claude Sonnet 3.5 | ~2000 | ~1000 | ~$0.01 |

**Estimated Cost per Company Profile:**
- Bolagsverket lookup: Free
- Website scraping: Free (hosting cost only)
- LLM analysis: ~$0.01
- **Total: ~$0.01 per company**

---

## 5. Data Update Strategy

### Static Data (One-time Import)
- Historical SFS documents (11,336)
- SNI → Law mapping tables
- Agency regulations (manual curation)

### Daily Updates
- New SFS documents (check last 7 days)
- Bolagsverket company changes
- Agency regulation updates (monitor websites)

### Real-time
- Company profile generation (on-demand)
- Website analysis (cached for 30 days)
- Law explanations (generated per request)

---

## 6. Priority Implementation Roadmap

### Phase 1: MVP (3 months)
**Data Sources:**
- ✅ Riksdagen API (SFS only)
- ✅ Bolagsverket (org number → SNI)
- ✅ Manual SNI → Law mapping (top 50 laws, 20 industries)
- ✅ Basic website scraping

**Coverage:**
- 50 most common laws
- 20 most common industries
- No agency regulations yet

### Phase 2: Enhanced (6 months)
**Add:**
- Arbetsmiljöverket (AFS) regulations
- Livsmedelsverket (LIVSFS) regulations
- EU regulations (GDPR, REACH)
- Advanced website analysis (LLM)
- Propositioner + Betänkanden (legislative history)

### Phase 3: Complete (12 months)
**Add:**
- All government agency regulations
- EUR-Lex integration
- Change tracking & alerts
- Historical law versions
- Court rulings (optional)

---

## 7. Example: Complete Data Flow

**Input:**
```
Organization Number: 556789-1234
URL: https://cafekarlек.se (optional)
```

**Step 1: Bolagsverket Lookup**
```json
{
  "name": "Café Kärlek AB",
  "sni_code": "56.10",
  "employees": "5-9",
  "legal_form": "AB"
}
```

**Step 2: Website Analysis**
```json
{
  "activities": ["café", "catering", "event services"],
  "signals": {
    "food": true,
    "alcohol": false,
    "delivery": true,
    "personal_data": true
  }
}
```

**Step 3: Law Retrieval**

*Rule-based:*
- SNI 56.10 → Livsmedelslag, Kassaregisterlagen
- Employees > 0 → Arbetsmiljölagen
- Always → GDPR

*Signal-based:*
- "catering" → Livsmedelsförordningen
- "event services" → Arbetstidslagen
- "personal_data" → Dataskyddsförordningen

*Vector search:*
- "café with catering for corporate events" → Additional relevant laws

**Step 4: LLM Explanation**
```json
{
  "laws": [
    {
      "id": "sfs-2006-804",
      "title": "Livsmedelslag",
      "relevance": 100,
      "priority": "must-have",
      "explanation": "Eftersom ni hanterar, tillagar och serverar mat...",
      "examples": [
        "HACCP-dokumentation för ert kök",
        "Temperaturkontroller vid catering-transporter"
      ]
    }
  ]
}
```

---

## 8. Technical Stack Recommendations

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL 15+ with pgvector extension
- **Caching:** Redis

### Data Processing
- **Web Scraping:** BeautifulSoup4, Scrapy
- **HTTP Requests:** httpx (async)
- **Data Validation:** Pydantic

### AI/ML
- **LLM:** OpenAI GPT-4o-mini or Claude 3.5 Sonnet
- **RAG Framework:** LangChain or LlamaIndex
- **Embeddings:** OpenAI text-embedding-3-small or Cohere
- **Vector Store:** pgvector (PostgreSQL extension)

### Monitoring
- **API Monitoring:** Sentry
- **Data Quality:** Great Expectations
- **Uptime:** StatusPage or similar

---

## 9. Legal & Compliance Considerations

### Data Privacy
- ✅ Bolagsverket data is public
- ✅ Website scraping: Respect robots.txt
- ⚠️ Cache company data: Max 30 days (GDPR)
- ⚠️ Don't store unnecessary personal data

### Liability
- ❗ Add disclaimer: "Not legal advice"
- ❗ Recommend professional legal review
- ❗ Consider E&O insurance
- ✅ Cite sources for all law interpretations

### Intellectual Property
- ✅ SFS is public domain
- ⚠️ Agency regulations: Check per-agency
- ❌ ISO standards: Cannot republish (link only)
- ⚠️ EUR-Lex: Check reuse policy

---

## Next Steps

1. **Set up Riksdagen API integration**
   - Build SFS import pipeline
   - Store in PostgreSQL with full-text search

2. **Create SNI → Law mapping**
   - Manual curation for top 20 industries
   - Validate with legal expert

3. **Bolagsverket integration**
   - API client for company lookup
   - Cache strategy

4. **Build RAG pipeline**
   - Chunk SFS documents
   - Generate embeddings
   - Test retrieval quality

5. **Prototype LLM explanation generator**
   - Template-based + context injection
   - A/B test different prompts

---

## Resources

- Riksdagen API Docs: https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/
- Bolagsverket Open Data: https://data.bolagsverket.se/
- SNI Codes: https://www.scb.se/vara-tjanster/foretagsregister/sni/
- EUR-Lex: https://eur-lex.europa.eu/
- Swedish Law Portal: https://lagen.nu/

---

*Last Updated: 2025-10-03*
