/**
 * Story 3.3: AI Chat API Route
 * Handles chat messages with streaming responses and rate limiting
 *
 * DEPENDENCY: Story 3.2 (RAG Query Pipeline) is required for full functionality
 * Currently using mock RAG responses until Story 3.2 is complete
 */

import { streamText, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getServerSession } from '@/lib/auth/session'

// Rate limiting configuration
// 10 requests per minute per user, 50 per workspace
const userRatelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:chat:user',
    })
  : null

const workspaceRatelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 m'),
      analytics: true,
      prefix: 'ratelimit:chat:workspace',
    })
  : null

// Maximum duration for streaming responses
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Authenticate user
    const session = await getServerSession()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = session.user.id
    const workspaceId =
      (session as { workspaceId?: string }).workspaceId ?? 'default'

    // Rate limit check - user level
    if (userRatelimit) {
      const { success, limit, reset, remaining } =
        await userRatelimit.limit(userId)
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `För många förfrågningar. Vänta ${retryAfter} sekunder.`,
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
              'Retry-After': retryAfter.toString(),
            },
          }
        )
      }
    }

    // Rate limit check - workspace level
    if (workspaceRatelimit) {
      const { success } = await workspaceRatelimit.limit(workspaceId)
      if (!success) {
        return new Response(
          JSON.stringify({
            error: 'Workspace rate limit exceeded',
            message:
              'Din arbetsyta har nått gränsen för förfrågningar. Försök igen senare.',
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Parse request body
    const body = await req.json()
    const { messages, contextType, contextId, ...initialContext } = body as {
      messages: UIMessage[]
      contextType?: 'global' | 'task' | 'law'
      contextId?: string
      title?: string
      description?: string
      sfsNumber?: string
      summary?: string
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Messages are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the latest user message for RAG query
    const latestUserMessage = messages.findLast((m) => m.role === 'user')
    const userQuery =
      latestUserMessage?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => ('text' in p ? p.text : ''))
        .join(' ') ?? ''

    // TODO: Story 3.2 - Replace with actual RAG pipeline
    // retrieveRelevantLaws() and buildSystemPrompt() will come from Story 3.2
    const { systemPrompt, citations } = await getMockRagResponse(userQuery, {
      contextType,
      contextId,
      ...initialContext,
    })

    // Select model based on environment variable (TBD - pending testing)
    const modelProvider = process.env.AI_CHAT_MODEL ?? 'openai'
    const model =
      modelProvider === 'anthropic'
        ? anthropic('claude-sonnet-4-20250514')
        : openai('gpt-4-turbo')

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content:
          m.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => ('text' in p ? p.text : ''))
            .join('\n') ?? '',
      })),
    })

    // Return streaming response with citations in metadata
    const response = result.toUIMessageStreamResponse()

    // Add citations header for client to parse
    const headers = new Headers(response.headers)
    headers.set('X-Citations', JSON.stringify(citations))

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('[CHAT API ERROR]', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'Något gick fel. Försök igen senare.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * MOCK RAG RESPONSE
 * TODO: Story 3.2 - Replace with actual RAG pipeline integration
 *
 * This provides placeholder responses until the vector search
 * and retrieval system is implemented.
 */
interface MockRagContext {
  contextType?: 'global' | 'task' | 'law' | undefined
  contextId?: string | undefined
  title?: string
  sfsNumber?: string
}

interface MockCitation {
  id: string
  title: string
  sfsNumber: string
  content: string
}

async function getMockRagResponse(
  _query: string,
  context: MockRagContext
): Promise<{ systemPrompt: string; citations: MockCitation[] }> {
  // Mock citations based on context
  const mockCitations: MockCitation[] = [
    {
      id: 'law-1',
      title: 'Arbetsmiljölagen',
      sfsNumber: 'SFS 1977:1160',
      content:
        'Arbetsgivaren ska vidta alla åtgärder som behövs för att förebygga att arbetstagaren utsätts för ohälsa eller olycksfall.',
    },
    {
      id: 'law-2',
      title: 'Diskrimineringslagen',
      sfsNumber: 'SFS 2008:567',
      content:
        'Diskriminering som har samband med kön, könsöverskridande identitet eller uttryck, etnisk tillhörighet, religion, funktionsnedsättning, sexuell läggning eller ålder är förbjuden.',
    },
    {
      id: 'law-3',
      title: 'Dataskyddsförordningen (GDPR)',
      sfsNumber: 'EU 2016/679',
      content:
        'Personuppgifter ska samlas in för särskilda, uttryckligt angivna och berättigade ändamål och inte senare behandlas på ett sätt som är oförenligt med dessa ändamål.',
    },
  ]

  // Build system prompt with context
  let systemPrompt = `Du är en AI-assistent som hjälper användare att förstå svensk lagstiftning.

VIKTIGA INSTRUKTIONER:
- Svara alltid på svenska
- Citera relevanta lagar med fotnoter i formatet [1], [2], etc.
- Var tydlig och koncis i dina svar
- Om du inte är säker på något, säg det tydligt
- Fokusera på att förklara lagar på ett lättförståeligt sätt

TILLGÄNGLIGA LAGKÄLLOR:
${mockCitations.map((c, i) => `[${i + 1}] ${c.title} (${c.sfsNumber}): ${c.content}`).join('\n\n')}`

  // Add context-specific instructions
  if (context.contextType === 'task' && context.title) {
    systemPrompt += `\n\nKONTEXT: Användaren arbetar med uppgiften "${context.title}". Fokusera svaren på denna uppgift.`
  } else if (context.contextType === 'law' && context.sfsNumber) {
    systemPrompt += `\n\nKONTEXT: Användaren tittar på ${context.title ?? 'en lag'} (${context.sfsNumber}). Fokusera svaren på denna lag.`
  }

  return { systemPrompt, citations: mockCitations }
}
