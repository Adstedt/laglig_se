# Notisum Competitive Analysis Tool

Autonomous Playwright-based crawler for comprehensive Notisum platform analysis.

## 🎯 Purpose

This tool systematically explores the entire Notisum platform to:

- Document all pages and features
- Capture screenshots of every section
- Identify document types and data structures
- Analyze UX patterns and workflows
- Generate structured reports for building Laglig.se

## 📁 Output Structure

```
output/
├── screenshots/          # Full-page screenshots of every page
│   ├── 00-login-page_*.png
│   ├── 01-dashboard_*.png
│   └── ...
└── reports/             # Markdown analysis reports
    ├── 00-overview.md   # Complete site overview
    ├── dashboard.md     # Dashboard section analysis
    ├── documents.md     # Documents section analysis
    ├── laws.md          # Laws section analysis
    └── features-and-data-summary.md  # Aggregated insights
```

## 🚀 Usage

### 1. Install Dependencies

```bash
cd competitor-analysis
npm install
npm run install-browser
```

### 2. Run the General Site Crawler

```bash
npm run crawl
```

The crawler will:

1. ✅ Launch browser (visible by default)
2. ✅ Navigate to Notisum and fill in credentials
3. ⚠️ **PAUSE for you to solve reCAPTCHA** (you have 5 minutes)
4. ✅ Auto-detect successful login
5. ✅ Systematically explore all header navigation links (3 levels deep)
6. ✅ Capture screenshots of every page (up to 200 pages)
7. ✅ Analyze page structure and features
8. ✅ Generate organized markdown reports

### 3. Run the Laglistor Scraper V2 (Detailed Law Lists)

**Important:** The v2 scraper requires manual reCAPTCHA solving during login.

To scrape ALL standardlaglistor with complete details:

```bash
npm run scrape-laglistor
```

**What to do when the browser opens:**

1. ⚠️ Wait for the browser window to open
2. ⚠️ The scraper will fill in username/password automatically
3. ⚠️ **YOU MUST SOLVE THE RECAPTCHA MANUALLY**
4. ⚠️ Click the "Logga in" button after solving reCAPTCHA
5. ✅ The scraper will continue automatically once logged in

This will:

1. ✅ Login to Notisum (manual reCAPTCHA required - YOU MUST DO THIS)
2. ✅ Visit all 12 standardlaglistor
3. ✅ Expand all categories (e.g., "01 ALLMÄNNA REGLER", "02 HR")
4. ✅ Scroll to load all content
5. ✅ Extract ALL laws with:
   - **SFS-nummer** (e.g., "SFS 2021:890")
   - **Beteckning** (law title, e.g., "Lag (2021:890) om skydd för personer...")
   - **Full beskrivning** (complete description text)
   - **Uppdateringsdatum** (latest amendment SFS number)
   - **Category** (which section the law belongs to)
6. ✅ Generate multiple output formats:
   - **JSON** - Structured data for programmatic access
   - **CSV** - Spreadsheet format
   - **Markdown** - Human-readable reports

**Output:**

- `output/laglistor-data/*.json` - Structured data
- `output/laglistor-data/*.csv` - CSV format for Excel/Sheets
- `output/laglistor-data/*.md` - Human-readable reports
- `output/laglistor-data/*_full.png` - Full-page screenshots

**Expected Results:**

- Arbetsmiljö: ~112 laws across multiple categories
- Miljö: ~98 laws across multiple categories
- Other lists: Variable number of laws, all properly categorized

### 4. Review Results

After completion, check:

- `output/reports/00-overview.md` - Start here for the complete overview
- `output/reports/features-and-data-summary.md` - Key insights for Laglig.se
- `output/reports/*.md` - Section-specific deep dives
- `output/screenshots/` - Visual documentation

## ⚙️ Configuration

Edit `.env` file to change:

- `NOTISUM_USERNAME` - Login username
- `NOTISUM_PASSWORD` - Login password
- `NOTISUM_BASE_URL` - Base URL (default: https://www.notisum.se)

Edit `src/crawler.ts` constants to adjust:

- `headless: false` → `true` for background operation
- `slowMo: 500` → Lower for faster crawling
- `timeout: 30000` → Adjust network timeout

## 📊 What Gets Analyzed

For each page, the crawler extracts:

### Structure

- URL and page title
- Navigation menus
- Forms and inputs
- Data tables and headers

### Functionality

- All buttons and actions
- Detected features (search, export, filter, etc.)
- Data types (laws, documents, policies, etc.)

### Visual

- Full-page screenshots
- Timestamp metadata

## 🎨 Report Structure

### Overview Report (`00-overview.md`)

- Total pages analyzed
- Sections discovered
- Quick links to all pages

### Section Reports (e.g., `documents.md`)

- Detailed page-by-page analysis
- Screenshots embedded
- Actions, tables, and navigation documented
- Features and data types identified

### Features Summary (`features-and-data-summary.md`)

- Aggregated feature list
- Common data types
- Recommendations for Laglig.se
- Gaps and opportunities

## 🔍 Troubleshooting

**Login fails:**

- Check credentials in `.env`
- Run with `headless: false` to watch login process
- Check `output/screenshots/00-login-page_*.png`

**Timeout errors:**

- Increase `timeout` value in `crawler.ts`
- Check internet connection
- Verify Notisum is accessible

**Missing pages:**

- Crawler limits to 50 pages to prevent infinite loops
- Adjust limit in `explorePageLinks()` method
- Add specific URLs to manual exploration list

## 🎯 Next Steps

After running the crawler:

1. **Review `features-and-data-summary.md`** for key insights
2. **Identify must-have features** to replicate in Laglig.se
3. **Document UX improvements** over Notisum's approach
4. **Map data structures** needed for API and database
5. **Update product roadmap** based on competitive intelligence

## 📝 Notes

- Crawler is autonomous but can be monitored (headless: false)
- Screenshots are timestamped for version tracking
- Safe exploration: avoids logout links and infinite loops
- Respects rate limits with configurable slowMo delay

---

**Generated for Laglig.se competitive analysis**
