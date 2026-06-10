import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgCheckCta } from '@/components/marketing/sections/org-check-cta'

const trackMock = vi.fn()
vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}))

const PREVIEW_RESPONSE = {
  company: {
    name: 'Testbolaget AB',
    orgNumber: '556677-8899',
    legalForm: 'Aktiebolag',
    address: null,
    municipality: 'Stockholm',
    sniCode: null,
    industry: null,
  },
  areas: ['Arbetsmiljö', 'GDPR & dataskydd', 'Bokföring'],
  areaCount: 3,
  inferredFlags: {},
  companySummary: null,
}

describe('<OrgCheckCta> analytics chain (QA-26.1-2)', () => {
  beforeEach(() => {
    trackMock.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => PREVIEW_RESPONSE,
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires marketing_org_check_submit once on a successful preview fetch', async () => {
    render(<OrgCheckCta kind="branscher" slug="bygg" />)

    // Step 1: enter org number → Nästa
    fireEvent.change(screen.getByLabelText('Organisationsnummer'), {
      target: { value: '5566778899' },
    })
    fireEvent.click(screen.getByRole('button', { name: /nästa/i }))

    // Step 2: submit (website field optional, left empty)
    fireEvent.click(screen.getByRole('button', { name: /visa min översikt/i }))

    await waitFor(() => {
      expect(screen.getByText('Testbolaget AB')).toBeTruthy()
    })

    expect(trackMock).toHaveBeenCalledTimes(1)
    expect(trackMock).toHaveBeenCalledWith('marketing_org_check_submit', {
      kind: 'branscher',
      slug: 'bygg',
    })
  })

  it('does NOT fire the event when the lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    )
    render(<OrgCheckCta kind="branscher" slug="bygg" />)

    fireEvent.change(screen.getByLabelText('Organisationsnummer'), {
      target: { value: '5566778899' },
    })
    fireEvent.click(screen.getByRole('button', { name: /nästa/i }))
    fireEvent.click(screen.getByRole('button', { name: /visa min översikt/i }))

    await waitFor(() => {
      expect(screen.getByText(/inget företag hittades/i)).toBeTruthy()
    })
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('renders the section heading and supporting copy', () => {
    render(
      <OrgCheckCta
        kind="funktioner"
        slug="kontroller"
        heading="Testa med ert orgnummer"
      />
    )
    expect(
      screen.getByRole('heading', { name: 'Testa med ert orgnummer' })
    ).toBeTruthy()
  })
})
