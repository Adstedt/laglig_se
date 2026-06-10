import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NavbarV3 } from '@/components/features/landing-v3/navbar-v3'

/**
 * Published/coming-soon nav state (Story 26.2 AC 5, 9, 12) — asserted via the
 * MOBILE SHEET, which renders the same resolved data as the desktop megamenu
 * without Radix hover-state flakiness in happy-dom.
 */

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }))

async function openSheetSection(sectionTitle: string) {
  // open the mobile sheet
  fireEvent.click(screen.getByRole('button', { name: /öppna meny/i }))
  // MobileSection renders children only when its accordion is open
  fireEvent.click(await screen.findByRole('button', { name: sectionTitle }))
}

describe('<NavbarV3> nav state', () => {
  it('published bransch renders as a live link with the canonical href', async () => {
    render(<NavbarV3 publishedRoutes={['/branscher/bygg']} />)
    await openSheetSection('Branscher')

    const link = screen.getByRole('link', { name: 'Bygg & anläggning' })
    expect(link.getAttribute('href')).toBe('/branscher/bygg')
  })

  it('unpublished bransch renders "Kommer snart" and is not a link', async () => {
    render(<NavbarV3 publishedRoutes={[]} />)
    await openSheetSection('Branscher')

    expect(screen.queryByRole('link', { name: /vård & omsorg/i })).toBeNull()
    const item = screen.getByText('Vård & omsorg')
    expect(item.closest('[aria-disabled="true"]')).not.toBeNull()
    expect(screen.getAllByText('Kommer snart').length).toBeGreaterThan(0)
  })

  it('Områden section exists and lists all 8 topics', async () => {
    render(<NavbarV3 publishedRoutes={[]} />)
    await openSheetSection('Områden')

    for (const label of [
      'GDPR & dataskydd',
      'NIS2',
      'Arbetsmiljö',
      'Brandskydd',
      'Miljö',
      'Visselblåsarlagen',
      'Penningtvätt',
      'ISO 14001',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('unpublished Produkt item falls back to a root-relative homepage anchor', async () => {
    render(<NavbarV3 publishedRoutes={[]} />)
    await openSheetSection('Produkt')

    const link = screen.getByRole('link', { name: 'Laglista' })
    expect(link.getAttribute('href')).toBe('/#how-it-works')
  })

  it('published Produkt item upgrades from anchor to route', async () => {
    render(<NavbarV3 publishedRoutes={['/funktioner/laglista']} />)
    await openSheetSection('Produkt')

    const link = screen.getByRole('link', { name: 'Laglista' })
    expect(link.getAttribute('href')).toBe('/funktioner/laglista')
  })

  it('mobile Priser link is root-relative', async () => {
    render(<NavbarV3 publishedRoutes={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /öppna meny/i }))

    const priser = await screen.findByRole('link', { name: 'Priser' })
    expect(priser.getAttribute('href')).toBe('/#pricing')
  })
})
