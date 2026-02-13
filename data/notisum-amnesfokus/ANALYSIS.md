# Document Reference Analysis - Notisum Ämnesfokus Templates

Analysis of document references extracted from `laglistor-all-combined.csv` for the three target templates:
- **Arbetsmiljö** (Work Environment)
- **Miljö** (Environment)
- **Arbetsmiljö för tjänsteföretag** (Work Environment for Service Companies)

## Summary Statistics

- **Total rows in CSV**: 657
- **Rows in target templates**: 265
- **Total unique documents**: 151

### By Category

| Category | Count | Percentage |
|----------|-------|------------|
| SFS (Swedish Laws) | 76 | 50.3% |
| Other Agency Regulations | 34 | 22.5% |
| EU/EG Regulations | 15 | 9.9% |
| AFS (Work Environment Authority) | 13 | 8.6% |
| Unrecognized/Other | 13 | 8.6% |

## Detailed Breakdown

### 1. SFS Documents (76 total)

Swedish Statute Book (Svensk författningssamling) documents. These are national laws.

**Multi-template documents** (appear in all 3 templates):
- SFS 2003:778 - Lagen om skydd mot olyckor
- SFS 2010:1011 - Plan- och bygglagen
- SFS 2010:1075 - Plan- och byggförordningen

**Arbetsmiljö + Arbetsmiljö för tjänsteföretag** (28 documents):
- 1974:358, 1974:981, 1976:580, 1977:1160, 1977:1166, 1977:284, 1977:480
- 1982:673, 1982:80, 1986:163, 1988:1465
- 1991:1046, 1991:1047, 1995:584
- 1998:209, 1999:678
- 2002:293, 2003:778
- 2008:565, 2008:567
- 2012:854, 2016:732
- 2018:2088, 2018:218, 2021:890

**Arbetsmiljö + Miljö** (5 documents):
- 2003:789, 2006:263, 2006:311, 2007:19, 2018:396, 2018:506

**Miljö only** (40 documents):
- 1995:1554, 1998:808, 1998:899, 1998:901, 1998:940, 1998:944, 1999:381
- 2001:512, 2006:1592, 2006:985, 2007:667
- 2008:112, 2008:245, 2008:486, 2008:834, 2010:900
- 2011:338, 2012:259, 2012:861
- 2013:250, 2013:251, 2013:254
- 2014:266, 2014:347, 2014:425, 2015:236
- 2016:1067, 2016:402, 2016:986, 2017:214, 2017:966
- 2018:471, 2021:1002, 2021:787, 2021:789, 2021:996
- 2022:1276

**Arbetsmiljö only** (3 documents):
- 1994:1297, 2004:865, 2005:395, 2017:218, 2017:319, 2022:469

### 2. AFS Documents (13 total)

Regulations from Arbetsmiljöverket (Swedish Work Environment Authority).

**Note**: One entry "STAFS 2020:1" was incorrectly categorized as AFS (actually Statistics Sweden). The actual AFS count is 12.

**2023 revisions** (dominant year):
- AFS 2023:1 (replaces 2001:1) - Both Arbetsmiljö templates
- AFS 2023:2 (replaces 2015:4) - Both Arbetsmiljö templates
- AFS 2023:3 (replaces 1999:3) - Arbetsmiljö only
- AFS 2023:4 (replaces 2008:3) - Arbetsmiljö only
- AFS 2023:5 - Arbetsmiljö only
- AFS 2023:9 (replaces 2004:3) - Both Arbetsmiljö templates
- AFS 2023:10 (replaces 1981:14) - Both Arbetsmiljö templates
- AFS 2023:11 (replaces 2001:3) - Both Arbetsmiljö templates
- AFS 2023:12 (replaces 2020:1) - Both Arbetsmiljö templates
- AFS 2023:13 - Arbetsmiljö only
- AFS 2023:14 (replaces 2018:1) - Arbetsmiljö only
- AFS 2023:15 (replaces 2019:3) - Arbetsmiljö only

**Key observation**: All AFS documents are from 2023, representing a major regulatory update cycle.

### 3. EU/EG Regulations (15 total)

**Most common across templates**:
- (EG) nr 1272/2008 - CLP Regulation (Classification, Labelling and Packaging) - All 3 templates
- (EG) nr 1907/2006 - REACH Regulation - All 3 templates
- (EU) nr 679/2016 - GDPR - Both Arbetsmiljö templates
- (EU) nr 1021/2019 - POPs Regulation - Arbetsmiljö + Miljö

**Miljö-specific** (9 regulations):
- (EG) nr 166/2006, (EG) nr 440/2008
- (EU) nr 1115/2023, (EU) nr 1542/2023, (EU) nr 2772/2023
- (EU) nr 649/2012, (EU) nr 852/2020, (EU) nr 956/2023

**Arbetsmiljö-specific** (3 regulations):
- (EG) nr 561/2006 - Driving times
- (EU) nr 1230/2023
- (EU) nr 165/2014 - Tachographs

### 4. Other Agency Regulations (34 total)

**MSBFS** (Myndigheten för samhällsskydd och beredskap - MSB): 13 documents
- 2010:4, 2011:3, 2013:3, 2014:6, 2015:8, 2015:9, 2016:4, 2018:3
- 2020:1, 2023:2 (both in all 3 templates)
- 2024:10, 2025:2

**NFS** (Naturvårdsverket - Swedish EPA): 9 documents
- All Miljö-specific
- 2001:2, 2004:10, 2004:15, 2015:2, 2015:3, 2016:8, 2018:11, 2021:10, 2021:6

**ELSÄK-FS** (Elsäkerhetsverket - Electrical Safety): 6 documents
- All Arbetsmiljö-related
- 2017:2, 2017:3, 2022:1, 2022:2, 2022:3

**KIFS** (Kemikalieinspektionen - Chemicals Inspectorate): 2 documents
- 2017:7 (all 3 templates)
- 2022:3 (Arbetsmiljö + Miljö)

**Other agencies** (1-2 documents each):
- SRVFS (Strålsäkerhetsmyndigheten - Radiation Safety): 2004:3, 2004:7
- BFS (Boverket - Building): 2011:16
- SSMFS (Socialstyrelsen - Health): 2018:2
- SCB-FS (Statistics Sweden): 2024:25
- SKVFS (Skatteverket - Tax): 2015:6

### 5. Unrecognized References (13 total)

All from Miljö template, appear to be codes:
- 0200, 0210, 0220, 0230, 0240, 0250, 0260
- 0500, 0510, 0520, 0530, 0540, 0550

**Investigation needed**: These might be:
- Industry classification codes (SNI codes)
- Internal Notisum reference codes
- Miljörapportering codes

## Cross-Template Analysis

### Documents in all 3 templates (5):
1. SFS 2003:778 - Lagen om skydd mot olyckor
2. SFS 2010:1011 - Plan- och bygglagen
3. SFS 2010:1075 - Plan- och byggförordningen
4. (EG) nr 1272/2008 - CLP Regulation
5. (EG) nr 1907/2006 - REACH Regulation
6. MSBFS 2020:1
7. MSBFS 2023:2
8. KIFS 2017:7
9. SRVFS 2004:3

### Template-specific counts:

**Arbetsmiljö**:
- 17 unique (not in other templates)
- 50 shared with "Arbetsmiljö för tjänsteföretag"
- 8 shared with Miljö

**Miljö**:
- 76 unique (not in other templates)
- 9 shared with both Arbetsmiljö templates

**Arbetsmiljö för tjänsteföretag**:
- 0 unique (all documents also in "Arbetsmiljö")
- Essentially a subset of Arbetsmiljö

## Key Insights

1. **Arbetsmiljö för tjänsteföretag is a strict subset**: Every document in this template also appears in the main "Arbetsmiljö" template. This suggests it's a simplified/focused version.

2. **2023 AFS regulatory wave**: All AFS regulations are from 2023, indicating a comprehensive modernization of work environment regulations.

3. **Heavy regulatory overlap**: The core safety/environmental regulations (REACH, CLP, fire safety law, building law) span all templates.

4. **Agency specialization**:
   - NFS (EPA) = 100% Miljö
   - ELSÄK-FS = 100% Arbetsmiljö
   - AFS = 100% Arbetsmiljö

5. **EU regulation importance**: 15 EU/EG regulations referenced, primarily REACH/CLP for chemical safety and GDPR for data protection.

6. **Historical span**: SFS documents range from 1974 to 2022, showing long-standing regulatory framework.

## Database Coverage Analysis

**Overall Coverage: 96.7%** (119/123 documents in database)

### SFS Documents: 74/76 (97.4%)

**Missing** (2):
- SFS 1977:480
- SFS 1999:678

### Agency Regulations: 45/47 (95.7%)

**Missing** (2):
- AFS 2020:1
- BFS 2011:16

**Complete coverage** (100%):
- ELSÄK-FS: 5/5
- KIFS: 2/2
- MSBFS: 12/12
- NFS: 9/9
- SCB-FS: 1/1
- SKVFS: 1/1
- SRVFS: 2/2
- SSMFS: 1/1

**Near-complete**:
- AFS: 12/13 (missing AFS 2020:1 which appears to be a miscategorization - it's actually STAFS)
- BFS: 0/1 (missing BFS 2011:16)

### Notable Findings

1. **Excellent existing coverage**: 96.7% of referenced documents are already in the database
2. **Strong agency coverage**: All MSBFS (12), NFS (9), and ELSÄK-FS (5) documents are present
3. **Minimal gaps**: Only 4 documents missing total
4. **AFS 2020:1 note**: Listed as "STAFS 2020:1" in the CSV but extracted as "AFS 2020:1" - this is likely Statistics Sweden (SCB), not Arbetsmiljöverket

## Files Generated

1. `document-references.json` - Machine-readable structured data
2. `ANALYSIS.md` - This human-readable analysis
3. `scripts/extract-document-references.ts` - Extraction script (reusable)
4. `scripts/check-existing-coverage.ts` - Database coverage checker

## Next Steps

1. **Investigate unrecognized codes** (0200-0550 series) - likely SNI industry codes or reporting codes
2. **Ingest missing documents**:
   - SFS 1977:480
   - SFS 1999:678
   - BFS 2011:16 (Boverket - construction regulations)
   - Verify AFS 2020:1 / STAFS 2020:1 categorization
3. **Prioritization**: Focus on multi-template documents first (highest impact)
4. **Template mapping**: Use this data to create intelligent document recommendations based on template selection
