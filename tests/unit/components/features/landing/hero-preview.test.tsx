import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeroPreview } from '@/components/features/landing/hero-preview'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

describe('HeroPreview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders org number input and submit button', () => {
    render(<HeroPreview />)

    expect(screen.getByLabelText('Organisationsnummer')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /visa min översikt/i })
    ).toBeInTheDocument()
  })

  it('shows not found message on 404 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'company_not_found' }), {
        status: 404,
      })
    )

    const user = userEvent.setup()
    render(<HeroPreview />)

    await user.type(screen.getByLabelText('Organisationsnummer'), '000000-0000')
    await user.click(screen.getByRole('button', { name: /visa min översikt/i }))

    expect(
      await screen.findByText(
        'Inget företag hittades med detta organisationsnummer'
      )
    ).toBeInTheDocument()
  })

  it('does not show error on 503 response (graceful degradation)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'service_unavailable' }), {
        status: 503,
      })
    )

    const user = userEvent.setup()
    render(<HeroPreview />)

    await user.type(screen.getByLabelText('Organisationsnummer'), '556452-1234')
    await user.click(screen.getByRole('button', { name: /visa min översikt/i }))

    // Wait for loading to finish
    await vi.waitFor(() => {
      expect(
        screen.getByRole('button', { name: /visa min översikt/i })
      ).not.toBeDisabled()
    })

    expect(
      screen.queryByText(/inget företag hittades/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  it('does not crash on malformed API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ unexpected: 'shape' }), { status: 200 })
    )

    const user = userEvent.setup()
    render(<HeroPreview />)

    await user.type(screen.getByLabelText('Organisationsnummer'), '556452-1234')
    await user.click(screen.getByRole('button', { name: /visa min översikt/i }))

    // Should not crash — component remains functional
    await vi.waitFor(() => {
      expect(
        screen.getByRole('button', { name: /visa min översikt/i })
      ).not.toBeDisabled()
    })

    // No preview shown since response was invalid
    expect(screen.queryByText(/regelområden/i)).not.toBeInTheDocument()
  })

  it('normalizes bare domain to https:// URL', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          company: {
            name: 'Test AB',
            orgNumber: '556452-1234',
            legalForm: 'AB',
            address: null,
            municipality: 'Stockholm',
            sniCode: null,
            industry: null,
          },
          areas: ['GDPR'],
          areaCount: 1,
          inferredFlags: {},
          companySummary: null,
        }),
        { status: 200 }
      )
    )

    const user = userEvent.setup()
    render(<HeroPreview />)

    await user.type(screen.getByLabelText('Organisationsnummer'), '556452-1234')
    await user.type(screen.getByLabelText('Webbplats'), 'example.com')
    await user.click(screen.getByRole('button', { name: /visa min översikt/i }))

    // Verify the request body included normalized URL
    const requestBody = JSON.parse(
      (mockFetch.mock.calls[0]![1] as RequestInit).body as string
    )
    expect(requestBody.websiteUrl).toBe('https://example.com')
  })
})
