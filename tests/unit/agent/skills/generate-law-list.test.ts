import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lawList: {
      findFirst: vi.fn(),
    },
    lawListItem: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn().mockReturnValue(() => false),
  tool: vi.fn((config) => config),
  zodSchema: vi.fn((schema) => schema),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mock-model'),
}))

vi.mock('@/lib/agent/tools', () => ({
  createAgentTools: vi.fn().mockReturnValue({
    search_laws: { execute: vi.fn() },
    get_company_context: { execute: vi.fn() },
  }),
}))

vi.mock('@/lib/agent/tools/get-template-laws', () => ({
  createGetTemplateLawsTool: vi.fn().mockReturnValue({
    execute: vi.fn(),
  }),
}))

vi.mock('@/lib/agent/tools/add-laws-to-list', () => ({
  createAddLawsToListTool: vi.fn().mockReturnValue({
    execute: vi.fn(),
  }),
}))

import { generateText } from 'ai'
import { prisma } from '@/lib/prisma'
import { createAgentTools } from '@/lib/agent/tools'
import { createGetTemplateLawsTool } from '@/lib/agent/tools/get-template-laws'
import { createAddLawsToListTool } from '@/lib/agent/tools/add-laws-to-list'
import { generateLawList } from '@/lib/agent/skills/generate-law-list'

const mockGenerateText = vi.mocked(generateText)
const mockWorkspaceUpdate = vi.mocked(prisma.workspace.update)
const mockWorkspaceFindUnique = vi.mocked(prisma.workspace.findUnique)
const mockLawListFindFirst = vi.mocked(prisma.lawList.findFirst)
const mockLawListItemFindMany = vi.mocked(prisma.lawListItem.findMany)

const WORKSPACE_ID = 'ws-test-123'
const USER_ID = 'user-test-456'

describe('generateLawList skill', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockWorkspaceFindUnique.mockResolvedValue({
      law_list_generation_progress: [],
    } as never)

    mockWorkspaceUpdate.mockResolvedValue({} as never)

    // Phase B (gap audit) reads the freshly-built list back. Default to an
    // empty list so the audit short-circuits (count 0 → no audit pass runs),
    // keeping these Phase A assertions isolated from the audit pipeline.
    mockLawListItemFindMany.mockResolvedValue([] as never)
  })

  it('composes correct tools from factory + skill-specific tools', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Done',
      steps: [],
      totalUsage: { inputTokens: 1000, outputTokens: 500 },
    } as never)

    mockLawListFindFirst.mockResolvedValue({
      id: 'list-1',
      _count: { items: 50 },
      groups: [{ name: 'Arbetsrätt' }, { name: 'Miljö' }],
    } as never)

    await generateLawList(WORKSPACE_ID, USER_ID)

    expect(createAgentTools).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID)
    expect(createGetTemplateLawsTool).toHaveBeenCalled()
    expect(createAddLawsToListTool).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID)

    // Verify generateText was called with merged tools
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          search_laws: expect.anything(),
          get_company_context: expect.anything(),
          get_template_laws: expect.anything(),
          add_laws_to_list: expect.anything(),
        }),
      })
    )
  })

  it('returns correct result shape', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Done building law list',
      steps: [],
      totalUsage: { inputTokens: 15000, outputTokens: 8000 },
    } as never)

    mockLawListFindFirst.mockResolvedValue({
      id: 'list-1',
      _count: { items: 55 },
      groups: [
        { name: 'Arbetsrätt' },
        { name: 'Bolagsrätt' },
        { name: 'Skatt' },
      ],
    } as never)

    const result = await generateLawList(WORKSPACE_ID, USER_ID)

    expect(result).toMatchObject({
      listId: 'list-1',
      itemCount: 55,
      groups: ['Arbetsrätt', 'Bolagsrätt', 'Skatt'],
      tokensUsed: { input: 15000, output: 8000 },
      durationMs: expect.any(Number),
    })
  })

  it('initializes progress on workspace', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Done',
      steps: [],
      totalUsage: { inputTokens: 100, outputTokens: 50 },
    } as never)

    mockLawListFindFirst.mockResolvedValue(null)

    await generateLawList(WORKSPACE_ID, USER_ID)

    // First update call should initialize empty progress
    expect(mockWorkspaceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WORKSPACE_ID },
        data: { law_list_generation_progress: [] },
      })
    )
  })

  it('returns null listId when no list was created', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'No results',
      steps: [],
      totalUsage: { inputTokens: 100, outputTokens: 50 },
    } as never)

    mockLawListFindFirst.mockResolvedValue(null)

    const result = await generateLawList(WORKSPACE_ID, USER_ID)

    expect(result.listId).toBeNull()
    expect(result.itemCount).toBe(0)
    expect(result.groups).toEqual([])
  })

  it('uses anthropic claude-opus-4-8 model', async () => {
    const { anthropic } = await import('@ai-sdk/anthropic')

    mockGenerateText.mockResolvedValue({
      text: 'Done',
      steps: [],
      totalUsage: { inputTokens: 100, outputTokens: 50 },
    } as never)

    mockLawListFindFirst.mockResolvedValue(null)

    await generateLawList(WORKSPACE_ID, USER_ID)

    expect(anthropic).toHaveBeenCalledWith('claude-opus-4-8')
  })

  it('passes onStepFinish callback to generateText for live progress', async () => {
    // Simulate onStepFinish being called during generation
    mockGenerateText.mockImplementation(
      async (opts: Record<string, unknown>) => {
        const onStepFinish = opts.onStepFinish as (_event: {
          toolCalls: Array<{ toolName: string; input?: unknown }>
        }) => Promise<void>

        if (onStepFinish) {
          await onStepFinish({
            toolCalls: [{ toolName: 'get_company_context', input: {} }],
          })
          await onStepFinish({
            toolCalls: [
              { toolName: 'get_template_laws', input: { area: 'arbetsmiljö' } },
            ],
          })
          await onStepFinish({
            toolCalls: [{ toolName: 'add_laws_to_list', input: { laws: [] } }],
          })
        }

        return {
          text: 'Done',
          steps: [],
          totalUsage: { inputTokens: 100, outputTokens: 50 },
        }
      }
    )

    mockLawListFindFirst.mockResolvedValue(null)

    await generateLawList(WORKSPACE_ID, USER_ID)

    // onStepFinish should cause progress updates during generation (init + 3 steps + final = 5)
    expect(mockWorkspaceUpdate.mock.calls.length).toBeGreaterThanOrEqual(5)

    // Verify onStepFinish was passed to generateText
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        onStepFinish: expect.any(Function),
      })
    )
  })
})
