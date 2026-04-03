import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth/session'
import { analyzeCompany } from '@/lib/company-preview/company-analyzer'

export const maxDuration = 30

const RequestSchema = z.object({
  name: z.string().min(1),
  sniCode: z.string().optional(),
  sniDescription: z.string().optional(),
  businessDescription: z.string().optional(),
  websiteUrl: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof RequestSchema>
  try {
    const raw = await request.json()
    body = RequestSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const analysis = await analyzeCompany(body)

  return NextResponse.json({
    summary: analysis.companySummary,
    activityFlags: analysis.activityFlags,
  })
}
