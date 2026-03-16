/**
 * Assessment Quality Simulation
 *
 * Uses REAL change events from the DB, REAL agent tools (vector search, etc.),
 * and the REAL system prompt to test what the agent would produce.
 *
 * Generates an HTML report comparing Notisum's basic info vs our agentic output.
 *
 * Run: npx tsx scripts/tmp-simulate-assessment.ts
 */

// Dotenv must run before any app code to set SUPABASE env vars
// that are read at module scope by transitive imports.
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { writeFileSync } from 'fs'

// These are loaded lazily in main() after dotenv has run
let generateText: (typeof import('ai'))['generateText']
let stepCountIs: (typeof import('ai'))['stepCountIs']
let anthropic: (typeof import('@ai-sdk/anthropic'))['anthropic']
let prisma: (typeof import('../lib/prisma'))['prisma']
let createAgentTools: (typeof import('../lib/agent/tools'))['createAgentTools']
let buildSystemPrompt: (typeof import('../lib/agent/system-prompt'))['buildSystemPrompt']
let formatCompanyContext: (typeof import('../lib/agent/system-prompt'))['formatCompanyContext']

interface CompanyProfileMock {
  company_name?: string | null
  org_number?: string | null
  sni_code?: string | null
  industry_label?: string | null
  employee_count_range?: string | null
  compliance_maturity?: string | null
  certifications?: string[] | null
  activity_flags?: Record<string, boolean> | null
}

// ---------------------------------------------------------------------------
// Scenario definitions — each simulates a different company facing a change
// ---------------------------------------------------------------------------

interface Scenario {
  label: string
  changeEventId: string
  /** Mock company profile to inject (overrides DB) */
  companyProfile: CompanyProfileMock
  /** What Notisum would show (for comparison baseline) */
  notisumBaseline: string
}

// ---------------------------------------------------------------------------
// Helper: find change events
// ---------------------------------------------------------------------------

async function findChangeEvents() {
  const events = await prisma.changeEvent.findMany({
    where: { change_type: 'AMENDMENT' },
    orderBy: { detected_at: 'desc' },
    take: 20,
    include: {
      document: {
        select: {
          id: true,
          title: true,
          document_number: true,
          effective_date: true,
        },
      },
    },
  })

  console.log('\nAvailable change events:')
  for (const e of events) {
    const sections =
      (e.changed_sections as string[] | null)?.join(', ') || 'okänt'
    console.log(
      `  ${e.id.substring(0, 12)}... | ${e.amendment_sfs} → ${e.document.document_number} | Sections: ${sections}`
    )
  }

  return events
}

// ---------------------------------------------------------------------------
// Build scenarios from real data
// ---------------------------------------------------------------------------

async function buildScenarios(): Promise<Scenario[]> {
  const events = await findChangeEvents()
  const scenarios: Scenario[] = []

  // Scenario 1: Healthcare company + Hälso- och sjukvårdslag
  // SFS 2026:214 amends SFS 2017:30 (many sections changed — high relevance)
  const hsv = events.find((e) => e.amendment_sfs === 'SFS 2026:214')
  if (hsv) {
    scenarios.push({
      label: 'Vårdföretag + Hälso- och sjukvårdslagen',
      changeEventId: hsv.id,
      companyProfile: {
        company_name: 'Norrlands Vårdcentral AB',
        org_number: '556801-1234',
        sni_code: '86210',
        industry_label: 'Allmän öppenvård',
        employee_count_range: 'RANGE_50_249',
        compliance_maturity: 'DEVELOPING',
        certifications: ['ISO 9001'],
        activity_flags: {
          personalData: true,
          publicSector: true,
          chemicals: false,
          construction: false,
          food: false,
          heavyMachinery: false,
          minorEmployees: false,
          internationalOperations: false,
        },
      },
      notisumBaseline: `Hälso- och sjukvårdslag (2017:30) har nu uppdateringsinformationen SFS 2026:214
Senaste ändring: Lag (2026:214) om ändring i hälso- och sjukvårdslagen (2017:30)
ändr. 6 kap. 2 §, 8 kap. 4, 9 §§, 14 kap. 1 §
Ikraftträdande: [datum saknas]`,
    })
  }

  // Scenario 2: IT consulting + Värdepappersmarknaden
  // SFS 2026:208 amends SFS 2007:572 — should be NOT relevant for IT company
  const vpf = events.find((e) => e.amendment_sfs === 'SFS 2026:208')
  if (vpf) {
    scenarios.push({
      label: 'IT-konsultbolag + Värdepappersmarknadsförordningen',
      changeEventId: vpf.id,
      companyProfile: {
        company_name: 'CodeNorth AB',
        org_number: '559123-4567',
        sni_code: '62010',
        industry_label: 'Dataprogrammering',
        employee_count_range: 'RANGE_10_49',
        compliance_maturity: 'BASIC',
        certifications: [],
        activity_flags: {
          personalData: true,
          publicSector: false,
          chemicals: false,
          construction: false,
          food: false,
          heavyMachinery: false,
          minorEmployees: false,
          internationalOperations: false,
        },
      },
      notisumBaseline: `Förordning (2007:572) om värdepappersmarknaden har nu uppdateringsinformationen SFS 2026:208
Senaste ändring: Förordning (2026:208) om ändring i förordningen (2007:572) om värdepappersmarknaden
Ikraftträdande: [datum saknas]`,
    })
  }

  // Scenario 3: Restaurant + Patientlag
  // SFS 2026:213 amends SFS 2014:821 — NOT relevant for restaurant
  const pat = events.find((e) => e.amendment_sfs === 'SFS 2026:213')
  if (pat) {
    scenarios.push({
      label: 'Restaurangföretag + Patientlagen',
      changeEventId: pat.id,
      companyProfile: {
        company_name: 'Smakfull Restaurang AB',
        org_number: '556901-9876',
        sni_code: '56100',
        industry_label: 'Restaurangverksamhet',
        employee_count_range: 'RANGE_10_49',
        compliance_maturity: 'BASIC',
        certifications: [],
        activity_flags: {
          food: true,
          personalData: false,
          publicSector: false,
          chemicals: false,
          construction: false,
          heavyMachinery: false,
          minorEmployees: true,
          internationalOperations: false,
        },
      },
      notisumBaseline: `Patientlag (2014:821) har nu uppdateringsinformationen SFS 2026:213
Senaste ändring: Lag (2026:213) om ändring i patientlagen (2014:821)
Ikraftträdande: [datum saknas]`,
    })
  }

  // Scenario 4: Energy company + Hållbarhetskriterier
  // SFS 2026:216 amends SFS 2025:588 — relevant for transport/energy
  const hbk = events.find((e) => e.amendment_sfs === 'SFS 2026:216')
  if (hbk) {
    scenarios.push({
      label: 'Transportbolag + Hållbarhetskriterier för bränslen',
      changeEventId: hbk.id,
      companyProfile: {
        company_name: 'NordTrans Logistik AB',
        org_number: '556701-5678',
        sni_code: '49410',
        industry_label: 'Vägtransport av gods',
        employee_count_range: 'RANGE_250_PLUS',
        compliance_maturity: 'ESTABLISHED',
        certifications: ['ISO 14001', 'ISO 9001'],
        activity_flags: {
          personalData: false,
          publicSector: false,
          chemicals: true,
          construction: false,
          food: false,
          heavyMachinery: true,
          minorEmployees: false,
          internationalOperations: true,
        },
      },
      notisumBaseline: `Förordning (2025:588) om hållbarhetskriterier för vissa bränslen har nu uppdateringsinformationen SFS 2026:216
Senaste ändring: Förordning (2026:216) om ändring i förordningen (2025:588)
Ikraftträdande: [datum saknas]`,
    })
  }

  return scenarios
}

// ---------------------------------------------------------------------------
// Run a single scenario through the full agent pipeline
// ---------------------------------------------------------------------------

interface ScenarioResult {
  scenario: Scenario
  agentResponse: string
  toolCalls: ToolCallInfo[]
  steps: number
  durationMs: number
  error?: string
}

interface ToolCallInfo {
  tool: string
  args: Record<string, unknown>
  resultSummary: string
}

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const start = Date.now()
  console.log(`\n${'━'.repeat(60)}`)
  console.log(`Running: ${scenario.label}`)
  console.log(`Change Event: ${scenario.changeEventId}`)

  try {
    // Build company context from mock profile
    const companyContext = formatCompanyContext(scenario.companyProfile as any)

    // Build system prompt — this loads the REAL change context from DB
    const systemPrompt = await buildSystemPrompt({
      companyContext: companyContext ?? undefined,
      contextType: 'change',
      contextId: scenario.changeEventId,
    })

    console.log(
      `System prompt: ${systemPrompt.length} chars (change context injected)`
    )

    // Use a workspace that exists (the first one — tools need a workspace for scoping)
    const ws = await prisma.workspace.findFirst()
    const workspaceId = ws?.id ?? 'default'
    const tools = createAgentTools(workspaceId, 'simulation-user')

    // The auto-start message
    const userMessage =
      'Granska denna lagändring och bedöm hur den påverkar vår verksamhet.'

    console.log(`Calling Claude Sonnet with tools...`)

    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools,
      stopWhen: stepCountIs(10),
    })

    const elapsed = Date.now() - start

    // Collect tool call info
    const toolCalls: ToolCallInfo[] = []
    for (const step of result.steps) {
      if (step.toolCalls?.length) {
        for (const tc of step.toolCalls) {
          const args = tc.args as Record<string, unknown>
          const tr = step.toolResults?.find(
            (r) => r.toolCallId === tc.toolCallId
          )
          let resultSummary = '(no result)'
          if (tr) {
            const res = tr.result as Record<string, unknown> | undefined
            if (res == null) {
              resultSummary = '(empty result)'
            } else if (res._meta) {
              const meta = res._meta as Record<string, unknown>
              resultSummary = `${meta.resultCount ?? '?'} results (${meta.executionTimeMs ?? '?'}ms)`
            } else if (res.error) {
              resultSummary = `Error: ${res.error}`
            } else {
              const json = JSON.stringify(res) ?? '{}'
              resultSummary = json.substring(0, 100) + '...'
            }
          }
          toolCalls.push({ tool: tc.toolName, args: args ?? {}, resultSummary })
          const argsStr = JSON.stringify(args ?? {}) ?? '{}'
          console.log(
            `  🔧 ${tc.toolName}(${argsStr.substring(0, 80)}) → ${resultSummary}`
          )
        }
      }
    }

    console.log(
      `✅ Done in ${(elapsed / 1000).toFixed(1)}s — ${result.steps.length} steps, ${toolCalls.length} tool calls`
    )
    console.log(
      `Response: ${result.text.length} chars (${result.text.split('\n').length} lines)`
    )

    return {
      scenario,
      agentResponse: result.text,
      toolCalls,
      steps: result.steps.length,
      durationMs: elapsed,
    }
  } catch (err) {
    const elapsed = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    console.error(`❌ Error: ${message}`)
    console.error(`Stack: ${stack}`)
    return {
      scenario,
      agentResponse: '',
      toolCalls: [],
      steps: 0,
      durationMs: elapsed,
      error: message,
    }
  }
}

// ---------------------------------------------------------------------------
// HTML Report Generator
// ---------------------------------------------------------------------------

function generateReport(results: ScenarioResult[]): string {
  const scenarioCards = results
    .map(
      (r, i) => `
    <div class="scenario" id="scenario-${i}">
      <div class="scenario-header">
        <span class="scenario-number">${i + 1}</span>
        <div>
          <h2>${esc(r.scenario.label)}</h2>
          <div class="stats">
            <span class="stat">${r.steps} steg</span>
            <span class="stat">${r.toolCalls.length} verktygsanrop</span>
            <span class="stat">${(r.durationMs / 1000).toFixed(1)}s</span>
            <span class="stat">${r.agentResponse.length} tecken</span>
            ${r.error ? '<span class="stat error">FEL</span>' : ''}
          </div>
        </div>
      </div>

      <div class="comparison">
        <!-- Notisum column -->
        <div class="column notisum">
          <div class="column-header">
            <div class="column-icon notisum-icon">N</div>
            <div>
              <h3>Notisum</h3>
              <p class="column-sub">Vad kunden får idag</p>
            </div>
          </div>
          <div class="column-body">
            <pre class="notisum-text">${esc(r.scenario.notisumBaseline)}</pre>
            <div class="verdict notisum-verdict">
              <strong>Ger:</strong> Ren faktainformation. Användaren måste själv avgöra relevans,
              hitta lagtext, tolka konsekvenser, och bestämma åtgärder.
            </div>
          </div>
        </div>

        <!-- Laglig column -->
        <div class="column laglig">
          <div class="column-header">
            <div class="column-icon laglig-icon">L</div>
            <div>
              <h3>Laglig.se</h3>
              <p class="column-sub">Agentic assessment flow</p>
            </div>
          </div>
          <div class="column-body">
            ${
              r.toolCalls.length > 0
                ? `<div class="tool-trace">
                <div class="tool-trace-header">Verktygsanrop</div>
                ${r.toolCalls
                  .map(
                    (tc) => `
                  <div class="tool-call">
                    <span class="tool-name">${esc(tc.tool)}</span>
                    <span class="tool-args">${esc(JSON.stringify(tc.args).substring(0, 120))}</span>
                    <span class="tool-result">→ ${esc(tc.resultSummary)}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>`
                : ''
            }
            <div class="agent-response" id="response-${i}"></div>
            ${r.error ? `<div class="error-box">${esc(r.error)}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Company context sidebar -->
      <div class="company-context">
        <h4>Simulerat företag</h4>
        <ul>
          <li><strong>${esc(r.scenario.companyProfile.company_name ?? '')}</strong></li>
          <li>Bransch: ${esc(r.scenario.companyProfile.industry_label ?? 'Okänd')}</li>
          <li>SNI: ${esc(r.scenario.companyProfile.sni_code ?? '-')}</li>
          <li>Anställda: ${esc(r.scenario.companyProfile.employee_count_range ?? '-')}</li>
          <li>Certifieringar: ${esc((r.scenario.companyProfile.certifications as string[])?.join(', ') || 'Inga')}</li>
          <li>Mognad: ${esc(r.scenario.companyProfile.compliance_maturity ?? '-')}</li>
        </ul>
      </div>
    </div>
  `
    )
    .join('')

  // JSON array of response texts for marked.js to render
  const responseTexts = JSON.stringify(results.map((r) => r.agentResponse))

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Assessment Quality Simulation — Laglig.se</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --surface-2: #1a1a26;
      --border: #2a2a3a;
      --text: #e4e4ef;
      --text-muted: #8888a0;
      --accent: #6366f1;
      --accent-light: #818cf8;
      --notisum: #f59e0b;
      --laglig: #6366f1;
      --green: #22c55e;
      --red: #ef4444;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .page-header {
      border-bottom: 1px solid var(--border);
      padding: 2rem 2rem 1.5rem;
      background: var(--surface);
    }
    .page-header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .page-header p {
      color: var(--text-muted);
      font-size: 0.9rem;
      max-width: 700px;
    }
    .page-header .meta {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .page-header .meta span {
      background: var(--surface-2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--border);
    }

    .scenarios { padding: 2rem; max-width: 1400px; margin: 0 auto; }

    .scenario {
      margin-bottom: 3rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      background: var(--surface);
    }

    .scenario-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
    }
    .scenario-number {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: var(--accent);
      color: white;
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .scenario-header h2 {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .stats {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.25rem;
      flex-wrap: wrap;
    }
    .stat {
      font-size: 0.72rem;
      color: var(--text-muted);
      background: var(--bg);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .stat.error { color: var(--red); border-color: var(--red); }

    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    @media (max-width: 900px) {
      .comparison { grid-template-columns: 1fr; }
    }

    .column {
      padding: 0;
      border-right: 1px solid var(--border);
    }
    .column:last-child { border-right: none; }

    .column-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .column-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.75rem;
      flex-shrink: 0;
    }
    .notisum-icon { background: var(--notisum); color: #000; }
    .laglig-icon { background: var(--laglig); color: #fff; }
    .column-header h3 { font-size: 0.9rem; font-weight: 600; }
    .column-sub { font-size: 0.75rem; color: var(--text-muted); }

    .column-body { padding: 1.25rem; }

    .notisum-text {
      font-family: inherit;
      font-size: 0.85rem;
      color: var(--text);
      white-space: pre-wrap;
      word-wrap: break-word;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      line-height: 1.7;
    }
    .verdict {
      margin-top: 1rem;
      font-size: 0.8rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      border-left: 3px solid;
    }
    .notisum-verdict {
      color: var(--notisum);
      border-color: var(--notisum);
      background: rgba(245, 158, 11, 0.08);
    }

    .tool-trace {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.75rem;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .tool-trace-header {
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .tool-call { margin-bottom: 0.35rem; line-height: 1.5; }
    .tool-name { color: var(--accent-light); font-weight: 600; }
    .tool-args { color: var(--text-muted); margin-left: 0.25rem; }
    .tool-result { display: block; color: var(--green); margin-left: 1rem; font-size: 0.7rem; }

    .agent-response {
      font-size: 0.88rem;
      line-height: 1.7;
    }
    .agent-response h2 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; color: var(--text); font-weight: 600; }
    .agent-response h3 { font-size: 0.95rem; margin: 1rem 0 0.4rem; color: var(--text); }
    .agent-response p { margin: 0.5rem 0; }
    .agent-response ul, .agent-response ol { padding-left: 1.5rem; margin: 0.4rem 0; }
    .agent-response li { margin: 0.2rem 0; }
    .agent-response strong { color: #fff; }
    .agent-response blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.5rem 1rem;
      margin: 0.75rem 0;
      background: rgba(99, 102, 241, 0.08);
      border-radius: 0 6px 6px 0;
      font-size: 0.85rem;
    }
    .agent-response code {
      background: var(--bg);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.82rem;
    }

    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--red);
      border-radius: 8px;
      padding: 1rem;
      color: var(--red);
      font-size: 0.85rem;
      margin-top: 1rem;
    }

    .company-context {
      padding: 1rem 1.25rem;
      background: var(--surface-2);
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
    }
    .company-context h4 {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .company-context ul {
      list-style: none;
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .company-context li { color: var(--text-muted); }
    .company-context strong { color: var(--text); }

    .summary {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    .summary-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .summary-card h3 { font-size: 0.9rem; margin-bottom: 0.75rem; }
    .summary-card .big-number { font-size: 2rem; font-weight: 700; color: var(--accent-light); }
    .summary-card p { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Assessment Quality Simulation</h1>
    <p>
      Comparison between Notisum's static notification and Laglig.se's agentic change assessment.
      Each scenario uses <strong>real change events</strong> from the database,
      <strong>real vector search</strong> over embedded law text, and the
      <strong>full system prompt</strong> with assessment workflow.
    </p>
    <div class="meta">
      <span>claude-sonnet-4-6</span>
      <span>${results.length} scenarios</span>
      <span>${new Date().toISOString().substring(0, 16)}</span>
      <span>Total: ${(results.reduce((a, r) => a + r.durationMs, 0) / 1000).toFixed(0)}s</span>
    </div>
  </div>

  <div class="summary">
    <div class="summary-grid">
      <div class="summary-card">
        <h3>Avg. Tool Calls</h3>
        <div class="big-number">${(results.reduce((a, r) => a + r.toolCalls.length, 0) / results.length).toFixed(1)}</div>
        <p>Search, context fetch, change details — the agent gathers facts before responding</p>
      </div>
      <div class="summary-card">
        <h3>Avg. Response Length</h3>
        <div class="big-number">${Math.round(results.reduce((a, r) => a + r.agentResponse.length, 0) / results.length)}</div>
        <p>Characters of structured analysis vs Notisum's ~200 char notification</p>
      </div>
      <div class="summary-card">
        <h3>Avg. Response Time</h3>
        <div class="big-number">${(results.reduce((a, r) => a + r.durationMs, 0) / results.length / 1000).toFixed(1)}s</div>
        <p>End-to-end including all tool calls and LLM inference</p>
      </div>
    </div>
  </div>

  <div class="scenarios">
    ${scenarioCards}
  </div>

  <script>
    const responses = ${responseTexts};
    responses.forEach((md, i) => {
      const el = document.getElementById('response-' + i);
      if (el && md) {
        el.innerHTML = marked.parse(md);
      } else if (el) {
        el.innerHTML = '<em style="color: var(--text-muted)">Inget svar genererat</em>';
      }
    });
  <\/script>
</body>
</html>`
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let results: ScenarioResult[] = []

async function main() {
  // Dynamic imports after dotenv has populated process.env
  const ai = await import('ai')
  generateText = ai.generateText
  stepCountIs = ai.stepCountIs
  anthropic = (await import('@ai-sdk/anthropic')).anthropic
  prisma = (await import('../lib/prisma')).prisma
  createAgentTools = (await import('../lib/agent/tools')).createAgentTools
  const sp = await import('../lib/agent/system-prompt')
  buildSystemPrompt = sp.buildSystemPrompt
  formatCompanyContext = sp.formatCompanyContext

  console.log('🔬 Assessment Quality Simulation')
  console.log('================================\n')

  const scenarios = await buildScenarios()
  console.log(`\nFound ${scenarios.length} scenarios to simulate\n`)

  if (scenarios.length === 0) {
    console.error('No scenarios could be built from available data')
    process.exit(1)
  }

  // Run scenarios sequentially (to avoid rate limits)
  for (const scenario of scenarios) {
    const result = await runScenario(scenario)
    results.push(result)
  }

  // Generate report
  console.log('\n\n📊 Generating HTML report...')
  const html = generateReport(results)
  const outPath = 'data/assessment-simulation.html'
  writeFileSync(outPath, html, 'utf-8')
  console.log(`📄 Report: ${outPath}`)

  // Print summary
  console.log('\n=== SUMMARY ===')
  for (const r of results) {
    const status = r.error ? '❌' : '✅'
    console.log(
      `${status} ${r.scenario.label}: ${r.toolCalls.length} tools, ${r.agentResponse.length} chars, ${(r.durationMs / 1000).toFixed(1)}s`
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
