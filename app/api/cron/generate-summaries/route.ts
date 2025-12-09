/**
 * AI Summary Generation Cron Job
 *
 * This endpoint is called by Vercel Cron to generate AI summaries for change events.
 * Runs every 4 hours to process pending summaries in small batches.
 *
 * Story 2.11 - Task 14: Cron Job Setup
 *
 * Features:
 * - Processes pending change event summaries
 * - Uses OpenAI GPT-4 for Swedish summaries
 * - Rate limited to control costs
 * - Designed for ~$0.42/month at ~10 changes/day
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ChangeType } from '@prisma/client'
import {
  generateAmendmentSummaryPrompt,
  generateRepealSummaryPrompt,
} from '@/lib/sync/ai-summary-queue'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max

const CRON_SECRET = process.env.CRON_SECRET
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const CONFIG = {
  BATCH_SIZE: 5, // Process 5 summaries per run
  MAX_RETRIES: 2,
}

interface SummaryStats {
  processed: number
  succeeded: number
  failed: number
  skipped: number
}

async function generateSummaryWithOpenAI(prompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured, skipping AI summary generation')
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model for summaries
        messages: [
          {
            role: 'system',
            content: 'Du är en expert på svensk lagstiftning som skriver korta, lättförståeliga sammanfattningar för allmänheten.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error('OpenAI API call failed:', error)
    return null
  }
}

export async function GET(request: Request) {
  const startTime = new Date()

  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats: SummaryStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      success: true,
      message: 'OpenAI API key not configured, no summaries generated',
      stats,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Get pending change events that need summaries
    const pendingEvents = await prisma.changeEvent.findMany({
      where: {
        ai_summary: null,
        change_type: {
          in: [ChangeType.AMENDMENT, ChangeType.REPEAL],
        },
      },
      include: {
        document: {
          select: {
            title: true,
            document_number: true,
          },
        },
      },
      orderBy: { detected_at: 'asc' },
      take: CONFIG.BATCH_SIZE,
    })

    if (pendingEvents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending summaries to process',
        stats,
        timestamp: new Date().toISOString(),
      })
    }

    // Process each event
    for (const event of pendingEvents) {
      stats.processed++

      let prompt: string

      if (event.change_type === ChangeType.AMENDMENT) {
        // Get affected sections from the change event
        const changedSections = (event.changed_sections as string[]) || []

        const promptParams: {
          lawTitle: string
          lawNumber: string
          amendmentSfs: string
          affectedSections: string[]
          diffSummary?: string
        } = {
          lawTitle: event.document.title,
          lawNumber: event.document.document_number,
          amendmentSfs: event.amendment_sfs || 'Okänd',
          affectedSections: changedSections,
        }
        if (event.diff_summary) {
          promptParams.diffSummary = event.diff_summary.substring(0, 200)
        }
        prompt = generateAmendmentSummaryPrompt(promptParams)
      } else if (event.change_type === ChangeType.REPEAL) {
        const repealParams: {
          lawTitle: string
          lawNumber: string
          repealedBySfs?: string
        } = {
          lawTitle: event.document.title,
          lawNumber: event.document.document_number,
        }
        if (event.amendment_sfs) {
          repealParams.repealedBySfs = event.amendment_sfs
        }
        prompt = generateRepealSummaryPrompt(repealParams)
      } else {
        stats.skipped++
        continue
      }

      // Generate summary
      const summary = await generateSummaryWithOpenAI(prompt)

      if (summary) {
        // Save summary
        await prisma.changeEvent.update({
          where: { id: event.id },
          data: {
            ai_summary: summary,
            ai_summary_generated_at: new Date(),
          },
        })
        stats.succeeded++
      } else {
        stats.failed++
      }

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const duration = Date.now() - startTime.getTime()

    // Get count of remaining pending summaries
    const remainingCount = await prisma.changeEvent.count({
      where: {
        ai_summary: null,
        change_type: { in: [ChangeType.AMENDMENT, ChangeType.REPEAL] },
      },
    })

    return NextResponse.json({
      success: true,
      stats,
      remainingPending: remainingCount,
      duration: `${Math.round(duration / 1000)}s`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('AI summary generation failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
