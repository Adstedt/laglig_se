import { describe, it, expect } from 'vitest'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import {
  AmendmentDigestEmail,
  type AmendmentDigestEmailProps,
} from '@/emails/amendment-digest'

function renderEmail(props: AmendmentDigestEmailProps): string {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(AmendmentDigestEmail, props)
  )
}

const BASE_PROPS: AmendmentDigestEmailProps = {
  userName: 'Alice',
  workspaceName: 'Workspace A',
  changes: [
    {
      lawTitle: 'Arbetsmiljölagen (1977:1160)',
      changeType: 'Ändrad',
      changeRef: 'SFS 2026:145',
      effectiveDate: '2026-07-01',
      aiSummary:
        'Lagen har uppdaterats med nya krav på riskbedömningar för arbetsgivare.',
      sectionChanges: [
        { label: '7 kap. 15 § — ändrad', type: 'AMENDED' },
        { label: '2a § — ny', type: 'NEW' },
      ],
      lawUrl: 'https://laglig.se/lagar/sfs-1977-1160',
      pdfUrl: 'https://riksdagen.se/sv/dokument/sfs-2026-145.pdf',
      assessUrl: 'https://laglig.se/dashboard?changeId=ce-1',
    },
  ],
  unsubscribeUrl: 'https://laglig.se/unsubscribe?token=test',
}

describe('AmendmentDigestEmail', () => {
  it('renders without errors', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toBeTruthy()
    expect(typeof html).toBe('string')
  })

  it('contains heading and greeting with user name', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('Lagändringar upptäckta')
    expect(html).toContain('Hej Alice')
    expect(html).toContain('Workspace A')
  })

  it('contains change card elements', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('Arbetsmiljölagen (1977:1160)')
    expect(html).toContain('Ändrad')
    expect(html).toContain('SFS 2026:145')
    expect(html).toContain('2026-07-01')
  })

  it('contains aiSummary preview text', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('riskbedömningar')
  })

  it('shows fallback text when aiSummary is null', () => {
    const props: AmendmentDigestEmailProps = {
      ...BASE_PROPS,
      changes: [
        {
          ...BASE_PROPS.changes[0]!,
          aiSummary: null,
        },
      ],
    }
    const html = renderEmail(props)
    expect(html).toContain('En ändring har upptäckts i denna lag.')
  })

  it('contains section changes', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('7 kap. 15 §')
    expect(html).toContain('ändrad')
    expect(html).toContain('2a §')
    expect(html).toContain('ny')
  })

  it('contains deep-link CTA button', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('Granska ändringen')
    expect(html).toContain('dashboard?changeId=ce-1')
  })

  it('contains law link and PDF link', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('https://laglig.se/lagar/sfs-1977-1160')
    expect(html).toContain('Visa lag')
    expect(html).toContain('PDF')
  })

  it('contains unsubscribe link', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('unsubscribe?token=test')
    expect(html).toContain('Avregistrera')
  })

  it('renders correctly with no section changes', () => {
    const props: AmendmentDigestEmailProps = {
      ...BASE_PROPS,
      changes: [
        {
          ...BASE_PROPS.changes[0]!,
          sectionChanges: [],
        },
      ],
    }
    const html = renderEmail(props)
    expect(html).toBeTruthy()
    expect(html).toContain('riskbedömningar')
    expect(html).not.toContain('Berörda paragrafer')
  })

  it('renders correctly with multiple change cards', () => {
    const props: AmendmentDigestEmailProps = {
      ...BASE_PROPS,
      changes: [
        BASE_PROPS.changes[0]!,
        {
          lawTitle: 'Miljöbalken (1998:808)',
          changeType: 'Upphävd',
          changeRef: 'SFS 2026:200',
          effectiveDate: null,
          aiSummary: null,
          sectionChanges: [],
          lawUrl: 'https://laglig.se/lagar/sfs-1998-808',
          pdfUrl: null,
          assessUrl: 'https://laglig.se/dashboard?changeId=ce-2',
        },
      ],
    }
    const html = renderEmail(props)
    expect(html).toBeTruthy()
    expect(html).toContain('Arbetsmiljölagen')
    expect(html).toContain('Miljöbalken')
    expect(html).toContain('2 ändringar')
  })

  it('uses fallback greeting when userName is null', () => {
    const props: AmendmentDigestEmailProps = {
      ...BASE_PROPS,
      userName: null,
    }
    const html = renderEmail(props)
    expect(html).toContain('Hej du')
  })
})
