/**
 * Diagnostic script — explores the chat_usage_events log.
 * Shows recent rows + aggregates (per-user, per-context, cache efficiency).
 * Safe to delete after Story 14.27 is fully validated.
 */

import { prisma } from '../lib/prisma'

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      workspaceId: string
      workspaceName: string
      userEmail: string
      model: string
      contextType: string
      inputTokens: bigint
      outputTokens: bigint
      cacheReadInputTokens: bigint
      cacheWriteInputTokens: bigint
      reasoningTokens: bigint
      stepCount: number
      costUsd: string
      createdAt: Date
    }>
  >`
    SELECT
      e.id,
      e.workspace_id AS "workspaceId",
      w.name AS "workspaceName",
      u.email AS "userEmail",
      e.model,
      e.context_type::text AS "contextType",
      e.input_tokens::bigint AS "inputTokens",
      e.output_tokens::bigint AS "outputTokens",
      e.cache_read_input_tokens::bigint AS "cacheReadInputTokens",
      e.cache_write_input_tokens::bigint AS "cacheWriteInputTokens",
      e.reasoning_tokens::bigint AS "reasoningTokens",
      e.step_count AS "stepCount",
      e.cost_usd_estimate::text AS "costUsd",
      e.created_at AS "createdAt"
    FROM chat_usage_events e
    INNER JOIN workspaces w ON w.id = e.workspace_id
    INNER JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC
    LIMIT 25
  `

  if (rows.length === 0) {
    console.log('No chat_usage_events rows found.')
    return
  }

  console.log(`\n=== All rows (most recent first, limit 25) ===\n`)
  for (const [i, row] of rows.entries()) {
    const fresh =
      Number(row.inputTokens) -
      Number(row.cacheReadInputTokens) -
      Number(row.cacheWriteInputTokens)
    const cacheHitPct =
      Number(row.inputTokens) > 0
        ? (Number(row.cacheReadInputTokens) / Number(row.inputTokens)) * 100
        : 0
    console.log(
      `[${i + 1}] ${row.createdAt.toISOString()}  ctx=${row.contextType.padEnd(6)}  steps=${row.stepCount}  in=${row.inputTokens}  out=${row.outputTokens}  cacheRead=${row.cacheReadInputTokens}  cacheWrite=${row.cacheWriteInputTokens}  fresh=${fresh}  hitPct=${cacheHitPct.toFixed(1)}%  $${row.costUsd}  user=${row.userEmail.split('@')[0]}`
    )
  }

  // Aggregate totals
  const [totals] = await prisma.$queryRaw<
    [
      {
        rowCount: bigint
        totalCost: string
        totalInput: bigint
        totalOutput: bigint
        totalCacheRead: bigint
        totalCacheWrite: bigint
        avgSteps: string
      },
    ]
  >`
    SELECT
      COUNT(*)::bigint AS "rowCount",
      SUM(cost_usd_estimate)::text AS "totalCost",
      SUM(input_tokens)::bigint AS "totalInput",
      SUM(output_tokens)::bigint AS "totalOutput",
      SUM(cache_read_input_tokens)::bigint AS "totalCacheRead",
      SUM(cache_write_input_tokens)::bigint AS "totalCacheWrite",
      AVG(step_count)::text AS "avgSteps"
    FROM chat_usage_events
  `

  if (totals) {
    const cacheHitPct =
      Number(totals.totalInput) > 0
        ? (Number(totals.totalCacheRead) / Number(totals.totalInput)) * 100
        : 0
    const cacheWritePct =
      Number(totals.totalInput) > 0
        ? (Number(totals.totalCacheWrite) / Number(totals.totalInput)) * 100
        : 0
    const avgCost =
      Number(totals.rowCount) > 0
        ? parseFloat(totals.totalCost) / Number(totals.rowCount)
        : 0

    console.log(`\n=== Aggregate totals ===`)
    console.log(`Total turns:        ${totals.rowCount}`)
    console.log(`Total input tokens: ${totals.totalInput}`)
    console.log(
      `  ├─ cache reads:   ${totals.totalCacheRead}  (${cacheHitPct.toFixed(1)}%)`
    )
    console.log(
      `  ├─ cache writes:  ${totals.totalCacheWrite}  (${cacheWritePct.toFixed(1)}%)`
    )
    console.log(
      `  └─ fresh:         ${Number(totals.totalInput) - Number(totals.totalCacheRead) - Number(totals.totalCacheWrite)}`
    )
    console.log(`Total output tokens: ${totals.totalOutput}`)
    console.log(`Total cost USD:      $${totals.totalCost}`)
    console.log(`Avg cost per turn:   $${avgCost.toFixed(6)}`)
    console.log(
      `Avg steps per turn:  ${parseFloat(totals.avgSteps).toFixed(2)}`
    )
  }

  // Per-context breakdown
  const byContext = await prisma.$queryRaw<
    Array<{
      contextType: string
      turns: bigint
      cost: string
      avgInput: string
      avgOutput: string
    }>
  >`
    SELECT
      context_type::text AS "contextType",
      COUNT(*)::bigint AS turns,
      SUM(cost_usd_estimate)::text AS cost,
      AVG(input_tokens)::text AS "avgInput",
      AVG(output_tokens)::text AS "avgOutput"
    FROM chat_usage_events
    GROUP BY context_type
    ORDER BY SUM(cost_usd_estimate) DESC
  `
  if (byContext.length > 0) {
    console.log(`\n=== Per-context breakdown ===`)
    for (const c of byContext) {
      console.log(
        `  ${c.contextType.padEnd(8)}  turns=${c.turns}  cost=$${c.cost}  avgIn=${Math.round(parseFloat(c.avgInput))}  avgOut=${Math.round(parseFloat(c.avgOutput))}`
      )
    }
  }

  // Per-user breakdown
  const byUser = await prisma.$queryRaw<
    Array<{
      userEmail: string
      workspaceName: string
      turns: bigint
      cost: string
    }>
  >`
    SELECT
      u.email AS "userEmail",
      w.name AS "workspaceName",
      COUNT(*)::bigint AS turns,
      SUM(e.cost_usd_estimate)::text AS cost
    FROM chat_usage_events e
    INNER JOIN users u ON u.id = e.user_id
    INNER JOIN workspaces w ON w.id = e.workspace_id
    GROUP BY u.email, w.name
    ORDER BY SUM(e.cost_usd_estimate) DESC
  `
  if (byUser.length > 0) {
    console.log(`\n=== Per-user breakdown ===`)
    for (const u of byUser) {
      console.log(
        `  ${u.userEmail.padEnd(45)}  ws="${u.workspaceName}"  turns=${u.turns}  cost=$${u.cost}`
      )
    }
  }
}

main()
  .catch((err) => {
    console.error('[check-usage-events] failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
