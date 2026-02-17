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
      summering:
        'Lagen har uppdaterats med nya krav på riskbedömningar för arbetsgivare.',
      kommentar:
        'Vi ska genomföra riskbedömningar kvartalsvis istället för årligen.',
      sectionChanges: [
        { label: '7 kap. 15 § — ändrad', type: 'AMENDED' },
        { label: '2a § — ny', type: 'NEW' },
      ],
      lawUrl: 'https://laglig.se/lagar/sfs-1977-1160',
      pdfUrl: 'https://riksdagen.se/sv/dokument/sfs-2026-145.pdf',
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

  it('contains summering and kommentar', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('Summering')
    expect(html).toContain('riskbedömningar')
    expect(html).toContain('Kommentar')
    expect(html).toContain('kvartalsvis')
  })

  it('contains section changes', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('7 kap. 15 §')
    expect(html).toContain('ändrad')
    expect(html).toContain('2a §')
    expect(html).toContain('ny')
  })

  it('contains links to Laglig.se and Riksdagen PDF', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('https://laglig.se/lagar/sfs-1977-1160')
    expect(html).toContain('Visa på Laglig.se')
    expect(html).toContain('Riksdagen PDF')
  })

  it('contains unsubscribe link', () => {
    const html = renderEmail(BASE_PROPS)
    expect(html).toContain('unsubscribe?token=test')
    expect(html).toContain('Avregistrera')
  })

  it('renders correctly with no summering/kommentar (only section changes)', () => {
    const props: AmendmentDigestEmailProps = {
      ...BASE_PROPS,
      changes: [
        {
          ...BASE_PROPS.changes[0]!,
          summering: null,
          kommentar: null,
        },
      ],
    }
    const html = renderEmail(props)
    expect(html).toBeTruthy()
    expect(html).toContain('7 kap. 15 §')
    expect(html).not.toContain('Summering')
    expect(html).not.toContain('Kommentar')
  })

  it('renders correctly with 0 section changes (only summering/kommentar)', () => {
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
    expect(html).toContain('Summering')
    expect(html).toContain('Kommentar')
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
          summering: null,
          kommentar: null,
          sectionChanges: [],
          lawUrl: 'https://laglig.se/lagar/sfs-1998-808',
          pdfUrl: null,
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
