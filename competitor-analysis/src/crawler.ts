import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  username: process.env.NOTISUM_USERNAME || 'pr32602',
  password: process.env.NOTISUM_PASSWORD || 'KBty8611!',
  baseUrl: process.env.NOTISUM_BASE_URL || 'https://www.notisum.se',
  outputDir: path.join(__dirname, '../output'),
  screenshotsDir: path.join(__dirname, '../output/screenshots'),
  reportsDir: path.join(__dirname, '../output/reports'),
  timeout: 30000,
  slowMo: 500, // Slow down by 500ms for better observation
  maxPages: 200, // Maximum pages to crawl (increased from 50)
  maxDepth: 3, // How deep to explore from each main navigation item
};

interface PageAnalysis {
  url: string;
  title: string;
  timestamp: string;
  screenshotPath: string;
  features: string[];
  elements: {
    buttons: string[];
    forms: string[];
    tables: string[];
    navigation: string[];
  };
  dataTypes: string[];
  notes: string[];
}

class NotisumCrawler {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private visitedUrls: Set<string> = new Set();
  private pageAnalyses: PageAnalysis[] = [];
  private sectionReports: Map<string, PageAnalysis[]> = new Map();

  async init() {
    console.log('🚀 Initializing Notisum Crawler...');
    this.browser = await chromium.launch({
      headless: false, // Set to true for background operation
      slowMo: CONFIG.slowMo,
    });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });

    // Ensure output directories exist
    [CONFIG.outputDir, CONFIG.screenshotsDir, CONFIG.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🔐 Logging into Notisum...');
    await this.page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

    // Take screenshot of landing page
    await this.captureScreenshot('00-landing-page');

    try {
      // First, click the "Logga in till Notisum" button if it exists
      console.log('🔍 Looking for login button...');
      const loginButtonSelectors = [
        'button:has-text("Logga in till Notisum")',
        'a:has-text("Logga in till Notisum")',
        'button:has-text("Logga in")',
        'a:has-text("Logga in")',
        '.login-button',
        '#login-button',
      ];

      let foundLoginButton = false;
      for (const selector of loginButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            console.log(`✅ Found login button: ${selector}`);
            await button.click();
            await this.page.waitForLoadState('networkidle');
            await this.page.waitForTimeout(2000);
            await this.captureScreenshot('01-login-form-page');
            foundLoginButton = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!foundLoginButton) {
        console.log('⚠️  No login button found, assuming already on login page');
      }

      // Now try to find and fill login form
      console.log('🔍 Looking for login form fields...');

      // Wait for login form elements with longer timeout
      await this.page.waitForSelector('input[type="text"], input[type="email"], input[name*="user"], input[id*="user"], input[name*="login"]', { timeout: 10000 });

      // Try common login selectors
      const usernameSelectors = [
        'input[name="username"]',
        'input[name="user"]',
        'input[name="login"]',
        'input[type="text"]',
        'input[type="email"]',
        'input[id*="user"]',
        'input[id*="login"]',
        'input[placeholder*="användare"]',
        'input[placeholder*="user"]',
      ];

      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[id*="pass"]',
        'input[id*="lösenord"]',
      ];

      // Try to fill username
      for (const selector of usernameSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element && await element.isVisible()) {
            await element.fill(CONFIG.username);
            console.log(`✅ Username filled using selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Try to fill password
      for (const selector of passwordSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element && await element.isVisible()) {
            await element.fill(CONFIG.password);
            console.log(`✅ Password filled using selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Take screenshot before submitting
      await this.captureScreenshot('02-login-filled');

      console.log('\n⚠️  ===============================================');
      console.log('⚠️  PLEASE SOLVE THE RECAPTCHA MANUALLY IN THE BROWSER');
      console.log('⚠️  THEN CLICK THE LOGIN BUTTON');
      console.log('⚠️  The crawler will automatically detect when you are logged in');
      console.log('⚠️  Waiting up to 5 minutes for manual login...');
      console.log('⚠️  ===============================================\n');

      // Wait for navigation to occur (indicating successful login)
      try {
        await this.page.waitForNavigation({
          timeout: 300000, // 5 minutes
          waitUntil: 'networkidle'
        });
        console.log('✅ Navigation detected - login successful!');
      } catch (navError) {
        console.log('⚠️  No navigation detected, checking if we are already logged in...');

        // Maybe we're already on the dashboard, check for typical elements
        try {
          await this.page.waitForSelector('nav, .navigation, header, .dashboard, .main-content', { timeout: 5000 });
          console.log('✅ Dashboard elements found - assuming logged in');
        } catch {
          console.log('❌ Timeout: No login detected after 5 minutes');
          throw new Error('Manual login timeout');
        }
      }

      // Wait for page to settle
      await this.page.waitForTimeout(2000);

      console.log('✅ Login successful!');
      await this.captureScreenshot('03-after-login');

    } catch (error) {
      console.error('❌ Login failed:', error);
      await this.captureScreenshot('error-login-failed');
      throw error;
    }
  }

  async captureScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);

    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);

    return filename;
  }

  async analyzePage(pageName: string): Promise<PageAnalysis> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`🔍 Analyzing page: ${pageName}`);

    const url = this.page.url();
    const title = await this.page.title();
    const screenshotPath = await this.captureScreenshot(pageName);

    // Extract page elements
    const buttons = await this.page.$$eval('button, input[type="button"], input[type="submit"], a.btn, a.button',
      elements => elements.map(el => el.textContent?.trim() || el.getAttribute('aria-label') || '').filter(t => t)
    );

    const forms = await this.page.$$eval('form',
      elements => elements.map(el => el.getAttribute('name') || el.getAttribute('id') || 'unnamed-form')
    );

    const tables = await this.page.$$eval('table',
      elements => elements.map((el, i) => {
        const headers = Array.from(el.querySelectorAll('th')).map((th: any) => th.textContent?.trim());
        return `Table ${i + 1}: ${headers.join(', ')}`;
      })
    );

    const navigation = await this.page.$$eval('nav a, .nav a, .menu a, .sidebar a',
      elements => elements.map(el => el.textContent?.trim() || '').filter(t => t)
    );

    // Try to identify data types and features
    const pageText = await this.page.textContent('body');
    const features: string[] = [];
    const dataTypes: string[] = [];

    // Look for keywords that indicate features
    const featureKeywords = ['export', 'import', 'filter', 'search', 'create', 'edit', 'delete', 'download', 'upload', 'share', 'print'];
    featureKeywords.forEach(keyword => {
      if (pageText?.toLowerCase().includes(keyword)) {
        features.push(keyword);
      }
    });

    // Look for document/data type keywords
    const dataKeywords = ['lag', 'förordning', 'dokument', 'policy', 'avtal', 'employee', 'anställd', 'revision', 'audit', 'compliance'];
    dataKeywords.forEach(keyword => {
      if (pageText?.toLowerCase().includes(keyword)) {
        dataTypes.push(keyword);
      }
    });

    const analysis: PageAnalysis = {
      url,
      title,
      timestamp: new Date().toISOString(),
      screenshotPath,
      features,
      elements: {
        buttons: [...new Set(buttons)],
        forms,
        tables,
        navigation: [...new Set(navigation)],
      },
      dataTypes: [...new Set(dataTypes)],
      notes: [],
    };

    this.pageAnalyses.push(analysis);
    return analysis;
  }

  async exploreNavigation() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🗺️  Exploring site navigation...');

    // Get ALL links on the page - be very broad
    const allLinks = await this.page.$$eval(
      'a',
      (elements) => elements.map(el => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
        classes: el.className || '',
        id: el.id || '',
      }))
    );

    console.log(`🔍 Found ${allLinks.length} total links on page`);

    // Filter to get navigation and content links
    const headerLinks = allLinks.filter(link =>
      link.href &&
      !link.href.includes('logout') &&
      !link.href.includes('logga-ut') &&
      !link.href.startsWith('#') &&
      !link.href.startsWith('javascript:') &&
      link.text.length > 0 &&
      link.text.length < 100 // Avoid long text blocks
    ).map(link => ({
      text: link.text,
      href: link.href,
      isHeader: true,
    }));

    console.log(`🎯 Found ${headerLinks.length} valid navigation links`);

    // Also look for clickable list items and cards (like "Arbetsmiljö", "Miljö")
    const listItems = await this.page.$$eval(
      '[class*="list"] a, [class*="card"] a, [class*="item"] a, .laglistor a, h2 a, h3 a, h4 a',
      (elements) => elements.map(el => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
      }))
    );

    console.log(`📋 Found ${listItems.length} list/card items`);

    const otherNavLinks = listItems.filter(link =>
      link.href &&
      !link.href.includes('logout') &&
      !link.href.includes('logga-ut') &&
      !link.href.startsWith('#') &&
      !link.href.startsWith('javascript:') &&
      link.text.length > 0
    ).map(link => ({
      text: link.text,
      href: link.href,
      isHeader: false,
    }));

    // Combine with priority to header links
    const allNavLinks = [...headerLinks, ...otherNavLinks];

    // Visit each unique link
    for (const link of allNavLinks) {
      if (!link.href || link.href.startsWith('#') || link.href.startsWith('javascript:')) {
        continue;
      }

      const fullUrl = new URL(link.href, this.page.url()).href;

      if (this.visitedUrls.has(fullUrl)) {
        continue;
      }

      if (this.visitedUrls.size >= CONFIG.maxPages) {
        console.log(`⚠️  Reached maximum page limit (${CONFIG.maxPages})`);
        break;
      }

      try {
        const prefix = link.isHeader ? '🎯 HEADER' : '📋';
        console.log(`\n${prefix} Visiting: ${link.text} (${fullUrl})`);
        await this.page.goto(fullUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await this.page.waitForTimeout(1000);

        this.visitedUrls.add(fullUrl);

        const pageName = this.sanitizeFilename(link.text || `page-${this.visitedUrls.size}`);
        const analysis = await this.analyzePage(pageName);

        // Categorize by section
        const section = this.categorizeSection(link.text, fullUrl);
        if (!this.sectionReports.has(section)) {
          this.sectionReports.set(section, []);
        }
        this.sectionReports.get(section)?.push(analysis);

        // Look for additional links on this page (with depth control)
        if (link.isHeader) {
          // For header links, explore more deeply
          await this.explorePageLinks(CONFIG.maxDepth);
        } else {
          // For secondary links, explore less deeply
          await this.explorePageLinks(1);
        }

      } catch (error) {
        console.error(`❌ Failed to visit ${fullUrl}:`, error);
      }
    }
  }

  async explorePageLinks(depth: number = 1, currentDepth: number = 0) {
    if (!this.page) throw new Error('Page not initialized');
    if (currentDepth >= depth) return;
    if (this.visitedUrls.size >= CONFIG.maxPages) return;

    // Get all links on the current page
    const links = await this.page.$$eval('a', (elements) =>
      elements.map(el => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
      }))
    );

    console.log(`  🔍 Found ${links.length} links on current page (depth: ${currentDepth + 1}/${depth})`);

    // Visit internal links
    for (const link of links) {
      if (!link.href || this.visitedUrls.size >= CONFIG.maxPages) break;

      const fullUrl = new URL(link.href, this.page.url()).href;

      if (
        fullUrl.includes(CONFIG.baseUrl) &&
        !this.visitedUrls.has(fullUrl) &&
        !fullUrl.includes('logout') &&
        !fullUrl.includes('logga-ut')
      ) {
        try {
          const indent = '  '.repeat(currentDepth + 1);
          console.log(`${indent}└─ Exploring: ${link.text || 'unnamed'}`);
          await this.page.goto(fullUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
          await this.page.waitForTimeout(1000);

          this.visitedUrls.add(fullUrl);

          const pageName = this.sanitizeFilename(link.text || `subpage-${this.visitedUrls.size}`);
          const analysis = await this.analyzePage(pageName);

          const section = this.categorizeSection(link.text, fullUrl);
          if (!this.sectionReports.has(section)) {
            this.sectionReports.set(section, []);
          }
          this.sectionReports.get(section)?.push(analysis);

          // Recursively explore deeper if we haven't reached max depth
          if (currentDepth + 1 < depth) {
            await this.explorePageLinks(depth, currentDepth + 1);
          }

        } catch (error) {
          // Silently continue on sub-page errors
        }
      }
    }
  }

  categorizeSection(linkText: string, url: string): string {
    const text = linkText.toLowerCase();
    const urlLower = url.toLowerCase();

    if (text.includes('dashboard') || text.includes('hem') || text.includes('home')) return 'dashboard';
    if (text.includes('dokument') || text.includes('document')) return 'documents';
    if (text.includes('lag') || urlLower.includes('law') || urlLower.includes('lag')) return 'laws';
    if (text.includes('inställ') || text.includes('setting')) return 'settings';
    if (text.includes('användare') || text.includes('user')) return 'users';
    if (text.includes('rapport') || text.includes('report')) return 'reports';
    if (text.includes('sök') || text.includes('search')) return 'search';
    if (text.includes('hjälp') || text.includes('help')) return 'help';

    return 'other';
  }

  sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  async generateReports() {
    console.log('\n📝 Generating reports...');

    // Generate main overview report
    await this.generateOverviewReport();

    // Generate section-specific reports
    for (const [section, analyses] of this.sectionReports.entries()) {
      await this.generateSectionReport(section, analyses);
    }

    // Generate features and data types summary
    await this.generateFeaturesSummary();

    console.log('✅ All reports generated!');
  }

  async generateOverviewReport() {
    const reportPath = path.join(CONFIG.reportsDir, '00-overview.md');

    let content = `# Notisum Competitive Analysis - Overview\n\n`;
    content += `**Analysis Date:** ${new Date().toISOString()}\n`;
    content += `**Total Pages Analyzed:** ${this.pageAnalyses.length}\n`;
    content += `**Total Unique URLs:** ${this.visitedUrls.size}\n\n`;

    content += `## Sections Discovered\n\n`;
    for (const [section, analyses] of this.sectionReports.entries()) {
      content += `- **${section}**: ${analyses.length} pages\n`;
    }

    content += `\n## All Pages\n\n`;
    this.pageAnalyses.forEach((analysis, index) => {
      content += `### ${index + 1}. ${analysis.title}\n\n`;
      content += `- **URL:** ${analysis.url}\n`;
      content += `- **Screenshot:** [View](../screenshots/${analysis.screenshotPath})\n`;
      content += `- **Features:** ${analysis.features.join(', ') || 'None detected'}\n`;
      content += `- **Data Types:** ${analysis.dataTypes.join(', ') || 'None detected'}\n\n`;
    });

    fs.writeFileSync(reportPath, content);
    console.log(`📄 Overview report saved: ${reportPath}`);
  }

  async generateSectionReport(section: string, analyses: PageAnalysis[]) {
    const reportPath = path.join(CONFIG.reportsDir, `${section}.md`);

    let content = `# Notisum Analysis - ${section.charAt(0).toUpperCase() + section.slice(1)} Section\n\n`;
    content += `**Pages in this section:** ${analyses.length}\n\n`;

    analyses.forEach((analysis, index) => {
      content += `## ${index + 1}. ${analysis.title}\n\n`;
      content += `**URL:** ${analysis.url}\n\n`;
      content += `**Screenshot:**\n\n`;
      content += `![${analysis.title}](../screenshots/${analysis.screenshotPath})\n\n`;

      if (analysis.elements.buttons.length > 0) {
        content += `### Actions/Buttons\n\n`;
        analysis.elements.buttons.forEach(btn => {
          content += `- ${btn}\n`;
        });
        content += `\n`;
      }

      if (analysis.elements.tables.length > 0) {
        content += `### Data Tables\n\n`;
        analysis.elements.tables.forEach(table => {
          content += `- ${table}\n`;
        });
        content += `\n`;
      }

      if (analysis.elements.navigation.length > 0) {
        content += `### Navigation Links\n\n`;
        analysis.elements.navigation.forEach(nav => {
          content += `- ${nav}\n`;
        });
        content += `\n`;
      }

      if (analysis.features.length > 0) {
        content += `### Features Detected\n\n`;
        analysis.features.forEach(feature => {
          content += `- ${feature}\n`;
        });
        content += `\n`;
      }

      if (analysis.dataTypes.length > 0) {
        content += `### Data Types\n\n`;
        analysis.dataTypes.forEach(type => {
          content += `- ${type}\n`;
        });
        content += `\n`;
      }

      content += `---\n\n`;
    });

    fs.writeFileSync(reportPath, content);
    console.log(`📄 Section report saved: ${reportPath}`);
  }

  async generateFeaturesSummary() {
    const reportPath = path.join(CONFIG.reportsDir, 'features-and-data-summary.md');

    // Aggregate all features and data types
    const allFeatures = new Set<string>();
    const allDataTypes = new Set<string>();
    const allButtons = new Set<string>();

    this.pageAnalyses.forEach(analysis => {
      analysis.features.forEach(f => allFeatures.add(f));
      analysis.dataTypes.forEach(d => allDataTypes.add(d));
      analysis.elements.buttons.forEach(b => allButtons.add(b));
    });

    let content = `# Notisum - Features & Data Types Summary\n\n`;
    content += `This document summarizes all features, data types, and actions discovered across the entire Notisum platform.\n\n`;

    content += `## Key Features\n\n`;
    Array.from(allFeatures).sort().forEach(feature => {
      const count = this.pageAnalyses.filter(a => a.features.includes(feature)).length;
      content += `- **${feature}** (found on ${count} pages)\n`;
    });

    content += `\n## Data Types & Concepts\n\n`;
    Array.from(allDataTypes).sort().forEach(type => {
      const count = this.pageAnalyses.filter(a => a.dataTypes.includes(type)).length;
      content += `- **${type}** (found on ${count} pages)\n`;
    });

    content += `\n## Common Actions/Buttons\n\n`;
    Array.from(allButtons).sort().forEach(button => {
      content += `- ${button}\n`;
    });

    content += `\n## Recommendations for Laglig.se\n\n`;
    content += `Based on this analysis, consider:\n\n`;
    content += `1. **Must-have features from Notisum:**\n`;
    content += `   - [List key features to replicate/improve]\n\n`;
    content += `2. **Gaps/Opportunities in Notisum:**\n`;
    content += `   - [List missing features Laglig.se should provide]\n\n`;
    content += `3. **Data model requirements:**\n`;
    content += `   - [List document types and data structures needed]\n\n`;
    content += `4. **UX improvements over Notisum:**\n`;
    content += `   - [List specific UX pain points to solve]\n\n`;

    fs.writeFileSync(reportPath, content);
    console.log(`📄 Features summary saved: ${reportPath}`);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🧹 Browser closed');
    }
  }

  async run() {
    try {
      await this.init();
      await this.login();
      await this.exploreNavigation();
      await this.generateReports();

      console.log('\n✅ Crawl complete!');
      console.log(`📁 Results saved to: ${CONFIG.outputDir}`);

    } catch (error) {
      console.error('❌ Crawler failed:', error);
      await this.captureScreenshot('error-crawler-failed');
    } finally {
      await this.cleanup();
    }
  }
}

// Run the crawler
const crawler = new NotisumCrawler();
crawler.run().catch(console.error);
