/**
 * Tests for parseAmendmentPdf — the PDF-direct LLM pipeline
 *
 * Verifies:
 * - Correct Anthropic API call structure (document content block, system prompt)
 * - HTML validation via validateLlmOutput
 * - Retry logic with exponential backoff
 * - Error handling for invalid/empty responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fixture: minimal valid amendment HTML ────────────────────────────────────
const VALID_HTML = `<article class="legal-document" id="SFS2025-100">
  <div class="lovhead">
    <h1 id="SFS2025-100_GENH0000">
      <p class="text">SFS 2025:100</p>
      <p class="text">Lag om ändring i testlagen (2000:1)</p>
    </h1>
  </div>
  <div class="body" id="SFS2025-100_BODY0001">
    <section class="ann">
      <div class="element-body annzone">
        <h3 class="paragraph" id="SFS2025-100_P1">1 §</h3>
        <p class="text" id="SFS2025-100_P1_S1">Första paragrafen.</p>
      </div>
    </section>
  </div>
  <footer class="back" id="SFS2025-100_BACK0001">
    <section class="in-force-info" id="SFS2025-100_IN_FORCE_INFO0001">
      <h2>Ikraftträdande- och övergångsbestämmelser</h2>
      <dl class="in-force">
        <dd class="in-force">
          <ol class="list" type="1">
            <li><p class="text">Denna lag träder i kraft den 1 januari 2026.</p></li>
          </ol>
        </dd>
      </dl>
    </section>
  </footer>
</article>`

// ── Mock Anthropic SDK ───────────────────────────────────────────────────────
const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor() {}
  }
  return { default: MockAnthropic }
})

// ── Import AFTER mocks ──────────────────────────────────────────────────────
import { parseAmendmentPdf } from '../external/llm-amendment-parser'

describe('parseAmendmentPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: return valid HTML
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: VALID_HTML }],
    })
  })

  it('should send PDF as document content block with correct structure', async () => {
    const pdfBuffer = Buffer.from('fake-pdf-content')

    await parseAmendmentPdf(pdfBuffer, '2025:100', '2000:1', 'Testlagen', {
      apiKey: 'test-key',
    })

    expect(mockCreate).toHaveBeenCalledOnce()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = mockCreate.mock.calls[0]?.[0] as any

    // Verify model and max_tokens
    expect(callArgs.model).toBe('claude-sonnet-4-20250514')
    expect(callArgs.max_tokens).toBe(8192)

    // Verify system prompt is set
    expect(callArgs.system).toBeTruthy()
    expect(callArgs.system).toContain('semantic HTML')

    // Verify message structure
    const message = callArgs.messages[0]
    expect(message.role).toBe('user')
    expect(message.content).toHaveLength(2)

    // First content block: PDF document
    const docBlock = message.content[0]
    expect(docBlock.type).toBe('document')
    expect(docBlock.source.type).toBe('base64')
    expect(docBlock.source.media_type).toBe('application/pdf')
    expect(docBlock.source.data).toBe(pdfBuffer.toString('base64'))

    // Second content block: text prompt
    const textBlock = message.content[1]
    expect(textBlock.type).toBe('text')
    expect(textBlock.text).toContain('2025:100')
    expect(textBlock.text).toContain('2000:1')
  })

  it('should return cleaned HTML and validation result on success', async () => {
    const result = await parseAmendmentPdf(
      Buffer.from('pdf'),
      '2025:100',
      undefined,
      undefined,
      { apiKey: 'test-key' }
    )

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('article')
    expect(result.validation.valid).toBe(true)
    expect(result.validation.metrics.sectionCount).toBeGreaterThan(0)
    expect(result.validation.metrics.paragraphCount).toBeGreaterThan(0)
  })

  it('should retry on LLM error with exponential backoff', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('API rate limit'))
      .mockRejectedValueOnce(new Error('API rate limit'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: VALID_HTML }],
      })

    const start = Date.now()
    const result = await parseAmendmentPdf(
      Buffer.from('pdf'),
      '2025:100',
      undefined,
      undefined,
      {
        apiKey: 'test-key',
        maxRetries: 3,
      }
    )

    // Should have called 3 times (2 failures + 1 success)
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result.html).toBeTruthy()

    // Backoff: 2s + 4s = 6s minimum, but we just verify it was called 3 times
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(5000) // at least 2+4=6s backoff (allow some margin)
  }, 15000)

  it('should retry when validation fails', async () => {
    const invalidHtml = '<div>Not a valid article</div>'

    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: invalidHtml }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: VALID_HTML }],
      })

    const result = await parseAmendmentPdf(
      Buffer.from('pdf'),
      '2025:100',
      undefined,
      undefined,
      {
        apiKey: 'test-key',
        maxRetries: 3,
      }
    )

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.validation.valid).toBe(true)
  }, 10000)

  it('should throw after exhausting all retries', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '' }], // empty = validation fail
    })

    await expect(
      parseAmendmentPdf(Buffer.from('pdf'), '2025:100', undefined, undefined, {
        apiKey: 'test-key',
        maxRetries: 2,
      })
    ).rejects.toThrow(/Failed to parse amendment PDF after 2 attempts/)

    expect(mockCreate).toHaveBeenCalledTimes(2)
  }, 15000)

  it('should throw when no text block in response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    })

    await expect(
      parseAmendmentPdf(Buffer.from('pdf'), '2025:100', undefined, undefined, {
        apiKey: 'test-key',
        maxRetries: 1,
      })
    ).rejects.toThrow(/No text response from LLM/)
  })

  it('should throw when ANTHROPIC_API_KEY is missing', async () => {
    const origKey = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    await expect(
      parseAmendmentPdf(Buffer.from('pdf'), '2025:100')
    ).rejects.toThrow(/ANTHROPIC_API_KEY/)

    if (origKey) process.env.ANTHROPIC_API_KEY = origKey
  })
})
