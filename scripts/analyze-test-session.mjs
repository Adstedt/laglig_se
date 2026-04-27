import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

const since = new Date('2026-04-27T07:30:00Z')

const rows = await p.chatUsageEvent.findMany({
  where: { created_at: { gte: since } },
  orderBy: { created_at: 'asc' },
  select: {
    input_tokens: true,
    output_tokens: true,
    cache_read_input_tokens: true,
    cache_write_input_tokens: true,
    reasoning_tokens: true,
    step_count: true,
    cost_usd_estimate: true,
    context_type: true,
    model: true,
    created_at: true,
  },
})

const sum = (key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0)
const mean = (key) => sum(key) / rows.length
const median = (key) => {
  const sorted = rows.map((r) => Number(r[key] || 0)).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const max = (key) => Math.max(...rows.map((r) => Number(r[key] || 0)))

const SONNET_46 = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }
const OPUS_46 = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }
const HAIKU_45 = { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }

function priceTurn(r, rates) {
  const fresh = Math.max(
    0,
    r.input_tokens - r.cache_read_input_tokens - r.cache_write_input_tokens
  )
  return (
    (fresh / 1e6) * rates.input +
    (r.cache_read_input_tokens / 1e6) * rates.cacheRead +
    (r.cache_write_input_tokens / 1e6) * rates.cacheWrite +
    (r.output_tokens / 1e6) * rates.output
  )
}

const sonnetTotal = rows.reduce((a, r) => a + priceTurn(r, SONNET_46), 0)
const opusTotal = rows.reduce((a, r) => a + priceTurn(r, OPUS_46), 0)
const haikuTotal = rows.reduce((a, r) => a + priceTurn(r, HAIKU_45), 0)
const dbCostTotal = rows.reduce((a, r) => a + Number(r.cost_usd_estimate), 0)

console.log(`\n=== TEST SESSION: ${rows.length} turns ===\n`)

console.log('PER-TURN BREAKDOWN:')
rows.forEach((r, i) => {
  const sonnet = priceTurn(r, SONNET_46)
  const opus = priceTurn(r, OPUS_46)
  console.log(
    `  T${(i + 1).toString().padStart(2)}: in=${r.input_tokens.toString().padStart(6)} out=${r.output_tokens.toString().padStart(5)} cR=${r.cache_read_input_tokens.toString().padStart(6)} cW=${r.cache_write_input_tokens.toString().padStart(5)} step=${r.step_count}  $sonnet=${sonnet.toFixed(4)}  $opus=${opus.toFixed(4)}`
  )
})

console.log('\nAGGREGATE:')
console.log(`  Total input tokens:        ${sum('input_tokens').toLocaleString()}`)
console.log(`  Total cache-read tokens:   ${sum('cache_read_input_tokens').toLocaleString()}`)
console.log(`  Total cache-write tokens:  ${sum('cache_write_input_tokens').toLocaleString()}`)
console.log(`  Total output tokens:       ${sum('output_tokens').toLocaleString()}`)
console.log(`  Total reasoning tokens:    ${sum('reasoning_tokens').toLocaleString()}`)
console.log(`  Total step_count:          ${sum('step_count').toLocaleString()}`)

const cacheHitRatio = sum('cache_read_input_tokens') / sum('input_tokens')
const fresh = sum('input_tokens') - sum('cache_read_input_tokens') - sum('cache_write_input_tokens')
console.log(`  Fresh input ratio:         ${((fresh / sum('input_tokens')) * 100).toFixed(1)}%`)
console.log(`  Cache-read ratio:          ${(cacheHitRatio * 100).toFixed(1)}%`)
console.log(`  Cache-write ratio:         ${((sum('cache_write_input_tokens') / sum('input_tokens')) * 100).toFixed(1)}%`)

console.log('\nPER-TURN MEAN:')
console.log(`  Input:        ${Math.round(mean('input_tokens')).toLocaleString()}`)
console.log(`  Output:       ${Math.round(mean('output_tokens')).toLocaleString()}`)
console.log(`  Cache-read:   ${Math.round(mean('cache_read_input_tokens')).toLocaleString()}`)
console.log(`  Cache-write:  ${Math.round(mean('cache_write_input_tokens')).toLocaleString()}`)
console.log(`  Step count:   ${mean('step_count').toFixed(2)}`)

console.log('\nPER-TURN MEDIAN:')
console.log(`  Input:        ${median('input_tokens').toLocaleString()}`)
console.log(`  Output:       ${median('output_tokens').toLocaleString()}`)
console.log(`  Cache-read:   ${median('cache_read_input_tokens').toLocaleString()}`)
console.log(`  Step count:   ${median('step_count')}`)

console.log('\nMAX (worst-case turn):')
console.log(`  Input:        ${max('input_tokens').toLocaleString()}`)
console.log(`  Output:       ${max('output_tokens').toLocaleString()}`)
console.log(`  Cache-read:   ${max('cache_read_input_tokens').toLocaleString()}`)
console.log(`  Step count:   ${max('step_count')}`)

console.log('\nCOST TOTALS (15 turns):')
console.log(`  As-is (Sonnet 4.6):  $${sonnetTotal.toFixed(4)}`)
console.log(`  DB cost_usd_estimate: $${dbCostTotal.toFixed(4)}  (sanity check vs As-is)`)
console.log(`  Projected Opus 4.6:  $${opusTotal.toFixed(4)}`)
console.log(`  Projected Haiku 4.5: $${haikuTotal.toFixed(4)}`)

console.log('\nCOST PER TURN (mean):')
console.log(`  Sonnet 4.6:  $${(sonnetTotal / rows.length).toFixed(4)}`)
console.log(`  Opus 4.6:    $${(opusTotal / rows.length).toFixed(4)}`)
console.log(`  Haiku 4.5:   $${(haikuTotal / rows.length).toFixed(4)}`)

const opusPerTurn = opusTotal / rows.length
const sonnetPerTurn = sonnetTotal / rows.length

console.log('\n=== TIER ECONOMICS @ 75% MARGIN ===\n')
const SEK_PER_USD = 10.5

const tiers = [
  { name: 'Solo',                sek: 499,      users: 1 },
  { name: 'Team (3 users base)', sek: 1299,     users: 3 },
  { name: 'Team add-on user',    sek: 300,      users: 1 },
]

const NON_AI_INFRA_PER_USER = 2.5

console.log(`Assumptions: 1 USD = ${SEK_PER_USD} SEK; non-AI infra per user/mo = $${NON_AI_INFRA_PER_USER}\n`)

tiers.forEach((t) => {
  const usdRev = t.sek / SEK_PER_USD
  const usdRevPerUser = usdRev / t.users
  const cogsBudget = usdRevPerUser * 0.25
  const aiBudget = cogsBudget - NON_AI_INFRA_PER_USER

  const turnsOpus = Math.floor(aiBudget / opusPerTurn)
  const turnsSonnet = Math.floor(aiBudget / sonnetPerTurn)

  console.log(`${t.name} (${t.sek} SEK = $${usdRev.toFixed(2)}, $${usdRevPerUser.toFixed(2)}/user)`)
  console.log(`  COGS budget @ 25%: $${cogsBudget.toFixed(2)}/user`)
  console.log(`  AI budget after infra: $${aiBudget.toFixed(2)}/user`)
  console.log(`  → ${turnsOpus} turns/user/mo on 100% Opus 4.6`)
  console.log(`  → ${turnsSonnet} turns/user/mo on 100% Sonnet 4.6 (current)`)
  console.log()
})

await p.$disconnect()
