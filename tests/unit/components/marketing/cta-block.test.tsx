import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CtaBlock } from '@/components/marketing/sections/cta-block'

const trackMock = vi.fn()
vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}))

describe('<CtaBlock>', () => {
  beforeEach(() => {
    trackMock.mockClear()
  })

  it('renders the UTM-tagged href', () => {
    render(
      <CtaBlock
        kind="branscher"
        slug="bygg"
        placement="hero"
        label="Testa gratis"
        href="/signup"
      />
    )
    const link = screen.getByRole('link', { name: /testa gratis/i })
    const href = link.getAttribute('href') ?? ''
    expect(href).toContain('/signup?')
    expect(href).toContain('utm_source=marketing')
    expect(href).toContain('utm_campaign=branscher-bygg')
    expect(href).toContain('utm_content=hero')
  })

  it('fires marketing_cta_click via trackEvent on click', () => {
    render(
      <CtaBlock
        kind="funktioner"
        slug="kontroller"
        placement="footer-strip"
        label="Testa gratis"
        href="/signup"
        variant="band"
      />
    )
    fireEvent.click(screen.getByRole('link', { name: /testa gratis/i }))
    expect(trackMock).toHaveBeenCalledWith('marketing_cta_click', {
      kind: 'funktioner',
      slug: 'kontroller',
      placement: 'footer-strip',
    })
  })

  it('shows the secondary note in inline variant', () => {
    render(
      <CtaBlock
        kind="omraden"
        slug="gdpr"
        placement="mid-page"
        label="Testa gratis"
        href="/signup"
        secondaryNote="Inget betalkort krävs"
      />
    )
    expect(screen.getByText('Inget betalkort krävs')).toBeTruthy()
  })
})
