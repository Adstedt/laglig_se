/**
 * Full agent simulation: user query → tool calls → LLM response.
 * Outputs an HTML file you can open in the browser.
 *
 * Run: npx tsx scripts/tmp-simulate-full-agent.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { generateText, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createAgentTools } from '../lib/agent/tools'
import { writeFileSync } from 'fs'

const tools = createAgentTools('default')

const systemPrompt = `Du är en AI-assistent som hjälper användare att förstå svensk lagstiftning.

VIKTIGA INSTRUKTIONER:
- Svara alltid på svenska
- Använd dina verktyg (search_laws, get_document_details, get_change_details) för att söka i lagdatabasen innan du svarar på frågor om lagar och regler
- Citera relevanta lagar med dokumentnummer, t.ex. "Enligt Arbetsmiljölagen (SFS 1977:1160)..."
- Var tydlig och koncis i dina svar
- Om du inte hittar relevant information, säg det tydligt
- Fokusera på att förklara lagar på ett lättförståeligt sätt`

const userQuery = 'Vilka krav ställs på arbetsgivaren kring kemikaliehantering?'

async function main() {
  console.log(`👤 ${userQuery}`)
  console.log('Generating response...\n')

  const startTime = Date.now()

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: [{ role: 'user', content: userQuery }],
    tools,
    stopWhen: stepCountIs(5),
  })

  const elapsed = Date.now() - startTime

  // Collect tool call info
  const toolCalls: string[] = []
  for (const [i, step] of result.steps.entries()) {
    if (step.toolCalls?.length) {
      for (const tc of step.toolCalls) {
        const args = tc.args as Record<string, unknown>
        toolCalls.push(`${tc.toolName}(${JSON.stringify(args)})`)
        const tr = step.toolResults?.find((r) => r.toolCallId === tc.toolCallId)
        if (tr) {
          const res = tr.result as any
          if (res?._meta) {
            toolCalls.push(
              `  → ${res._meta.resultCount} results (${res._meta.executionTimeMs}ms)`
            )
          }
        }
      }
    }
  }

  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Simulation — Laglig.se</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #f8f9fa;
      color: #1a1a2e;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.25rem; color: #64748b; margin-bottom: 1.5rem; font-weight: 500; }
    .stats {
      display: flex; gap: 1.5rem; margin-bottom: 1.5rem; font-size: 0.8rem; color: #94a3b8;
    }
    .stats span { background: #e2e8f0; padding: 0.25rem 0.75rem; border-radius: 999px; }
    .bubble {
      padding: 1rem 1.25rem;
      border-radius: 1rem;
      margin-bottom: 1rem;
      max-width: 90%;
    }
    .user-bubble {
      background: #2563eb;
      color: white;
      margin-left: auto;
      border-bottom-right-radius: 0.25rem;
    }
    .tool-trace {
      background: #1e293b;
      color: #94e2d5;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.78rem;
      padding: 1rem 1.25rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      white-space: pre-wrap;
      line-height: 1.7;
    }
    .tool-trace .label { color: #f59e0b; font-weight: 600; }
    .agent-bubble {
      background: white;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 0.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .agent-bubble h2 { font-size: 1.15rem; margin: 1.25rem 0 0.5rem; color: #1e293b; }
    .agent-bubble h3 { font-size: 1rem; margin: 1rem 0 0.4rem; color: #334155; }
    .agent-bubble ul, .agent-bubble ol { padding-left: 1.5rem; margin: 0.4rem 0; }
    .agent-bubble li { margin: 0.2rem 0; }
    .agent-bubble strong { color: #0f172a; }
    .agent-bubble p { margin: 0.5rem 0; }
    .role-label {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 0.35rem; color: #94a3b8;
    }
    .user-label { text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Agent Simulation — Laglig.se</h1>

    <div class="stats">
      <span>claude-sonnet-4</span>
      <span>${result.steps.length} steg</span>
      <span>${(elapsed / 1000).toFixed(1)}s</span>
      <span>${toolCalls.filter((t) => !t.startsWith(' ')).length} tool calls</span>
    </div>

    <div class="role-label user-label">Användare</div>
    <div class="bubble user-bubble">${escapeHtml(userQuery)}</div>

    <div class="role-label">Verktygsanrop</div>
    <div class="tool-trace">${toolCalls
      .map((t) =>
        t.startsWith('  ')
          ? `<span style="color:#a6e3a1">${escapeHtml(t)}</span>`
          : `<span class="label">→</span> ${escapeHtml(t)}`
      )
      .join('\n')}</div>

    <div class="role-label">Laglig AI-assistent</div>
    <div class="bubble agent-bubble" id="agent-response"></div>
  </div>

  <script>
    const md = ${JSON.stringify(result.text)};
    document.getElementById('agent-response').innerHTML = marked.parse(md);
  <\/script>
</body>
</html>`

  const outPath = 'data/agent-simulation.html'
  writeFileSync(outPath, html, 'utf-8')
  console.log(
    `\n✅ Done in ${(elapsed / 1000).toFixed(1)}s — ${result.steps.length} steps, ${toolCalls.filter((t) => !t.startsWith(' ')).length} tool calls`
  )
  console.log(`📄 Open: ${outPath}`)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
