import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mock-model'),
}))

vi.mock('@/lib/company-preview/url-fetcher', () => ({
  fetchUrlContent: vi.fn(),
}))

import { generateText } from 'ai'
import { analyzeCompany } from '@/lib/company-preview/company-analyzer'
import { fetchUrlContent } from '@/lib/company-preview/url-fetcher'

const mockGenerateText = vi.mocked(generateText)
const mockFetchUrlContent = vi.mocked(fetchUrlContent)

describe('analyzeCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchUrlContent.mockResolvedValue(null)
  })

  it('returns parsed activity flags and summary from LLM', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        activityFlags: {
          chemicals: true,
          construction: false,
          food: true,
          personalData: false,
          publicSector: false,
          heavyMachinery: false,
          minorEmployees: false,
          internationalOperations: true,
        },
        companySummary: 'Livsmedelsföretag med kemikaliehantering',
        confidence: 'high',
      }),
    } as never)

    const result = await analyzeCompany({
      name: 'TestCo AB',
      sniCode: '10110',
      sniDescription: 'Slakt',
      businessDescription: 'Livsmedelsproduktion',
    })

    expect(result.activityFlags.chemicals).toBe(true)
    expect(result.activityFlags.food).toBe(true)
    expect(result.activityFlags.construction).toBe(false)
    expect(result.activityFlags.internationalOperations).toBe(true)
    expect(result.companySummary).toBe(
      'Livsmedelsföretag med kemikaliehantering'
    )
    expect(result.confidence).toBe('high')
  })

  it('handles JSON wrapped in markdown code block', async () => {
    mockGenerateText.mockResolvedValue({
      text: '```json\n{"activityFlags":{"chemicals":false,"construction":true,"food":false,"personalData":false,"publicSector":false,"heavyMachinery":true,"minorEmployees":false,"internationalOperations":false},"companySummary":"Byggföretag","confidence":"high"}\n```',
    } as never)

    const result = await analyzeCompany({ name: 'Bygg AB' })

    expect(result.activityFlags.construction).toBe(true)
    expect(result.activityFlags.heavyMachinery).toBe(true)
    expect(result.companySummary).toBe('Byggföretag')
  })

  it('returns empty analysis on LLM error', async () => {
    mockGenerateText.mockRejectedValue(new Error('API rate limit'))

    const result = await analyzeCompany({ name: 'FailCo AB' })

    expect(result.activityFlags).toEqual({})
    expect(result.companySummary).toBeNull()
    expect(result.confidence).toBe('low')
  })

  it('returns empty analysis on invalid JSON response', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'This is not valid JSON at all',
    } as never)

    const result = await analyzeCompany({ name: 'BadJson AB' })

    expect(result.activityFlags).toEqual({})
    expect(result.companySummary).toBeNull()
    expect(result.confidence).toBe('low')
  })

  it('normalizes unknown flags to false', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        activityFlags: {
          chemicals: true,
          // Missing other flags
        },
        companySummary: 'Test',
        confidence: 'medium',
      }),
    } as never)

    const result = await analyzeCompany({ name: 'PartialCo AB' })

    expect(result.activityFlags.chemicals).toBe(true)
    expect(result.activityFlags.construction).toBe(false)
    expect(result.activityFlags.food).toBe(false)
  })

  it('fetches website content when URL provided', async () => {
    mockFetchUrlContent.mockResolvedValue('Vi bygger hus och renoverar')
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        activityFlags: {
          chemicals: false,
          construction: true,
          food: false,
          personalData: false,
          publicSector: false,
          heavyMachinery: false,
          minorEmployees: false,
          internationalOperations: false,
        },
        companySummary: 'Byggföretag',
        confidence: 'high',
      }),
    } as never)

    await analyzeCompany({
      name: 'Bygg AB',
      websiteUrl: 'https://bygg.se',
    })

    expect(mockFetchUrlContent).toHaveBeenCalledWith('https://bygg.se')
    // Verify website text was included in the prompt
    const call = mockGenerateText.mock.calls[0]![0]
    expect(call.prompt).toContain('Vi bygger hus och renoverar')
  })

  it('defaults confidence to low for unknown values', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        activityFlags: {},
        companySummary: 'Test',
        confidence: 'invalid-value',
      }),
    } as never)

    const result = await analyzeCompany({ name: 'Test AB' })
    expect(result.confidence).toBe('low')
  })

  it('returns null summary when LLM returns empty string', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        activityFlags: {},
        companySummary: '',
        confidence: 'low',
      }),
    } as never)

    const result = await analyzeCompany({ name: 'Empty AB' })
    expect(result.companySummary).toBeNull()
  })
})
