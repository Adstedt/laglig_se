/**
 * Performance Audit Test Runner
 * 
 * This script provides utilities to run the performance audit tests
 * with different configurations and generate comprehensive reports.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface AuditConfig {
  url: string
  credentials: {
    email: string
    password: string
  }
  outputDir: string
  browser: 'chromium' | 'firefox' | 'webkit'
  headless: boolean
  workers: number
}

const DEFAULT_CONFIG: AuditConfig = {
  url: 'https://www.laglig.se',
  credentials: {
    email: 'alexander.adstedt+10@kontorab.se',
    password: 'KBty8611!!!!'
  },
  outputDir: './test-results/performance-audit',
  browser: 'chromium',
  headless: true,
  workers: 1
}

export class PerformanceAuditRunner {
  private config: AuditConfig
  private results: any[] = []
  
  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  async runAudit(options: {
    tags?: string[]
    repeat?: number
    saveReport?: boolean
  } = {}) {
    const { tags = [], repeat = 1, saveReport = true } = options
    
    console.log('🚀 Starting Laglig.se Performance Audit')
    console.log(`URL: ${this.config.url}`)
    console.log(`Browser: ${this.config.browser}`)
    console.log(`Repeats: ${repeat}`)
    
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true })
    }
    
    for (let run = 1; run <= repeat; run++) {
      console.log(`\n📊 Running audit iteration ${run}/${repeat}`)
      
      try {
        const result = await this.runSingleAudit(run, tags)
        this.results.push(result)
        
        if (saveReport) {
          await this.saveRunReport(result, run)
        }
        
      } catch (error) {
        console.error(`❌ Audit iteration ${run} failed:`, error)
        this.results.push({
          run,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        })
      }
    }
    
    if (saveReport) {
      await this.generateFinalReport()
    }
    
    return this.results
  }
  
  private async runSingleAudit(run: number, tags: string[]) {
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-')
    const reportDir = path.join(this.config.outputDir, `run-${run}-${timestamp}`)
    
    // Build Playwright command
    let command = `npx playwright test laglig-performance-audit.spec.ts`
    
    // Add project/browser selection
    command += ` --project=${this.config.browser}`
    
    // Add workers
    command += ` --workers=${this.config.workers}`
    
    // Add output directory
    command += ` --output-dir="${reportDir}"`
    
    // Add headless flag
    if (this.config.headless) {
      command += ` --headed=false`
    } else {
      command += ` --headed=true`
    }
    
    // Add tags if specified
    if (tags.length > 0) {
      command += ` --grep="${tags.join('|')}"`
    }
    
    // Set environment variables
    const env = {
      ...process.env,
      BASE_URL: this.config.url,
      AUDIT_EMAIL: this.config.credentials.email,
      AUDIT_PASSWORD: this.config.credentials.password,
    }
    
    console.log(`Executing: ${command}`)
    
    const startTime = Date.now()
    
    try {
      const output = execSync(command, { 
        cwd: process.cwd(),
        env,
        encoding: 'utf-8',
        stdio: 'pipe'
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      return {
        run,
        success: true,
        duration,
        timestamp: new Date().toISOString(),
        output,
        reportDir
      }
      
    } catch (error: any) {
      const endTime = Date.now()
      const duration = endTime - startTime
      
      return {
        run,
        success: false,
        duration,
        timestamp: new Date().toISOString(),
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        reportDir
      }
    }
  }
  
  private async saveRunReport(result: any, run: number) {
    const reportPath = path.join(this.config.outputDir, `run-${run}-report.json`)
    
    const enhancedResult = {
      ...result,
      config: this.config,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString()
      }
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(enhancedResult, null, 2))
    console.log(`📄 Run ${run} report saved to: ${reportPath}`)
  }
  
  private async generateFinalReport() {
    const successful = this.results.filter(r => r.success)
    const failed = this.results.filter(r => !r.success)
    
    const avgDuration = successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
      : 0
    
    const report = {
      summary: {
        totalRuns: this.results.length,
        successfulRuns: successful.length,
        failedRuns: failed.length,
        successRate: (successful.length / this.results.length) * 100,
        averageDuration: avgDuration,
        totalDuration: this.results.reduce((sum, r) => sum + (r.duration || 0), 0)
      },
      config: this.config,
      results: this.results,
      timestamp: new Date().toISOString()
    }
    
    const reportPath = path.join(this.config.outputDir, 'final-audit-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    // Also create a markdown report
    await this.generateMarkdownReport(report)
    
    console.log(`\n📊 Final Performance Audit Report`)
    console.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`)
    console.log(`Average Duration: ${(avgDuration / 1000).toFixed(2)}s`)
    console.log(`Report saved to: ${reportPath}`)
  }
  
  private async generateMarkdownReport(report: any) {
    const markdown = `# Laglig.se Performance Audit Report

Generated: ${report.timestamp}

## Summary

- **Total Runs**: ${report.summary.totalRuns}
- **Successful Runs**: ${report.summary.successfulRuns}
- **Failed Runs**: ${report.summary.failedRuns}
- **Success Rate**: ${report.summary.successRate.toFixed(1)}%
- **Average Duration**: ${(report.summary.averageDuration / 1000).toFixed(2)}s

## Test Configuration

- **URL**: ${report.config.url}
- **Browser**: ${report.config.browser}
- **Headless**: ${report.config.headless}
- **Workers**: ${report.config.workers}

## Results by Run

${report.results.map((result: any, index: number) => `
### Run ${index + 1}

- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}
- **Duration**: ${result.duration ? (result.duration / 1000).toFixed(2) + 's' : 'N/A'}
- **Timestamp**: ${result.timestamp}
${result.error ? `- **Error**: ${result.error}` : ''}
${result.reportDir ? `- **Report Directory**: ${result.reportDir}` : ''}
`).join('')}

## Performance Targets

The audit tests against these performance targets:

- **Workspace Switch**: <200ms
- **List Loads**: <500ms
- **Modal First Open**: <1000ms
- **Modal Cached**: <100ms
- **Page Navigations**: <1000ms
- **Max UI Freeze**: <50ms

## Detailed Test Coverage

1. **Workspace Selector Performance**
   - Dropdown opening time
   - Context switching between workspaces
   - Multiple workspace testing

2. **Law Lists (Laglistor) Navigation**
   - Sidebar expansion
   - Navigation to "Mina laglistor"
   - Table interactions and sorting
   - Pagination performance

3. **Law List Item Modal Performance**
   - First-time modal opening
   - Cached modal reopening
   - Multiple modal testing

4. **Settings Page Performance**
   - Page load time
   - Tab switching performance
   - Form input responsiveness

5. **Legal Sources (Rättskällor)**
   - Browse results performance
   - Navigation between resources
   - Search functionality
   - Repeat visit performance

6. **Tasks Page Performance**
   - Page load time with UI freeze detection
   - Task interaction performance
   - Task creation flow

7. **Performance Report Generation**
   - Comprehensive metrics collection
   - Target validation
   - Summary statistics

## Recommendations

Based on the audit results:

${report.summary.successRate < 80 ? '⚠️  **High failure rate detected** - Review failed tests for performance bottlenecks' : '✅ Good overall performance'}

${report.summary.averageDuration > 30000 ? '⚠️  **Long test duration** - Consider optimizing slow operations' : '✅ Reasonable test execution time'}

For detailed performance metrics, check the JSON reports in the test results directory.
`

    const markdownPath = path.join(this.config.outputDir, 'audit-report.md')
    fs.writeFileSync(markdownPath, markdown)
    console.log(`📄 Markdown report saved to: ${markdownPath}`)
  }
}

// CLI execution
if (require.main === module) {
  const runner = new PerformanceAuditRunner()
  
  const args = process.argv.slice(2)
  const options: any = {}
  
  // Parse simple CLI arguments
  if (args.includes('--repeat')) {
    const repeatIndex = args.indexOf('--repeat')
    options.repeat = parseInt(args[repeatIndex + 1]) || 1
  }
  
  if (args.includes('--headless')) {
    options.headless = true
  }
  
  if (args.includes('--headed')) {
    options.headless = false
  }
  
  runner.runAudit(options).then(results => {
    console.log(`\n🎉 Audit completed! ${results.filter(r => r.success).length}/${results.length} runs successful`)
    process.exit(results.every(r => r.success) ? 0 : 1)
  }).catch(error => {
    console.error('🔥 Audit failed:', error)
    process.exit(1)
  })
}

export default PerformanceAuditRunner