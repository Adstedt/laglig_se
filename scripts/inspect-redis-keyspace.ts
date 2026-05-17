/**
 * One-off: scan the Upstash keyspace and report what's dominating it.
 *
 *   pnpm tsx scripts/inspect-redis-keyspace.ts
 *
 * Uses SCAN (not KEYS) so it's safe to run against prod.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { redis } from '@/lib/cache/redis'

async function main() {
  const dbsize = await redis.dbsize()
  console.log(`DBSIZE: ${dbsize.toLocaleString()} keys`)
  console.log('')

  const prefixCounts = new Map<string, number>()
  const sampleByPrefix = new Map<string, string>()
  let cursor: string | number = 0
  let scanned = 0
  let iterations = 0

  do {
    const [next, keys] = (await redis.scan(cursor, {
      count: 1000,
    })) as [string | number, string[]]
    cursor = next
    iterations++
    scanned += keys.length

    for (const key of keys) {
      const prefix = key.split(':').slice(0, 2).join(':')
      prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1)
      if (!sampleByPrefix.has(prefix)) sampleByPrefix.set(prefix, key)
    }
  } while (String(cursor) !== '0')

  console.log(
    `Scanned ${scanned.toLocaleString()} keys in ${iterations} iterations`
  )
  console.log('')
  console.log('Top prefixes:')
  const sorted = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [prefix, count] of sorted.slice(0, 25)) {
    const pct = ((count / scanned) * 100).toFixed(1)
    console.log(
      `  ${count.toLocaleString().padStart(8)}  ${pct.padStart(5)}%  ${prefix.padEnd(40)}  e.g. ${sampleByPrefix.get(prefix)}`
    )
  }

  console.log('')
  console.log('TTL spot-check on top 5 prefixes (first sample key each):')
  for (const [prefix] of sorted.slice(0, 5)) {
    const sample = sampleByPrefix.get(prefix)!
    const ttl = await redis.ttl(sample)
    const type = await redis.type(sample)
    const ttlStr =
      ttl === -1 ? 'NO EXPIRY (!)' : ttl === -2 ? 'missing' : `${ttl}s`
    console.log(`  ${prefix.padEnd(40)}  type=${type}  ttl=${ttlStr}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
