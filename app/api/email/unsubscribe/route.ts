import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

const ratelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    })
  : null

const UnsubscribeSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: Request) {
  // Rate limit by IP
  if (ratelimit) {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'
    const { success } = await ratelimit.limit(`unsubscribe:${ip}`)
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'For manga forfragan. Forsok igen senare.' },
        { status: 429 }
      )
    }
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Ogiltig forfragan.' },
      { status: 400 }
    )
  }

  const parsed = UnsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Token saknas.' },
      { status: 400 }
    )
  }

  // Verify token
  const result = verifyUnsubscribeToken(parsed.data.token)
  if (!result) {
    return NextResponse.json(
      { success: false, error: 'Ogiltig eller utgangen lank.' },
      { status: 400 }
    )
  }

  const { userId, workspaceId } = result

  // Upsert preference — set email_enabled = false
  await prisma.notificationPreference.upsert({
    where: {
      user_id_workspace_id: { user_id: userId, workspace_id: workspaceId },
    },
    update: { email_enabled: false },
    create: {
      user_id: userId,
      workspace_id: workspaceId,
      email_enabled: false,
    },
  })

  return NextResponse.json({ success: true })
}
