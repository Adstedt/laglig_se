import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { redis, isRedisConfigured } from '@/lib/cache/redis'

export interface HealthCheckResult {
  name: string
  ok: boolean
  latencyMs: number
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

export async function checkRiksdagenApi(): Promise<{
  ok: boolean
  latencyMs: number
}> {
  const start = Date.now()
  try {
    const response = await fetchWithTimeout(
      'https://data.riksdagen.se/dokumentlista/?sok=test&utformat=json&antal=1',
      5000
    )
    return { ok: response.ok, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

export async function checkDomstolsverketApi(): Promise<{
  ok: boolean
  latencyMs: number
}> {
  const start = Date.now()
  try {
    const response = await fetchWithTimeout(
      'https://rattspraxis.etjanst.domstol.se/api/v1',
      5000
    )
    return { ok: response.ok, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

export async function checkDatabase(): Promise<{
  ok: boolean
  latencyMs: number
}> {
  const start = Date.now()
  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`)
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

export async function checkRedis(): Promise<{
  ok: boolean
  latencyMs: number
}> {
  if (!isRedisConfigured()) {
    return { ok: false, latencyMs: 0 }
  }

  const start = Date.now()
  try {
    await redis.ping()
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  const checks = await Promise.allSettled([
    checkRiksdagenApi(),
    checkDomstolsverketApi(),
    checkDatabase(),
    checkRedis(),
  ])

  const names = ['Riksdagen API', 'Domstolsverket API', 'Databas', 'Redis']

  return checks.map((result, i) => ({
    name: names[i]!,
    ok: result.status === 'fulfilled' ? result.value.ok : false,
    latencyMs: result.status === 'fulfilled' ? result.value.latencyMs : 0,
  }))
}
