import { describe, it, expect } from 'vitest'
import ReactDOMServer from 'react-dom/server'
import React from 'react'
import { CatalogRequestReceivedInternalEmail } from '@/emails/catalog-request-received-internal'

function renderEmail(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element)
}

describe('CatalogRequestReceivedInternalEmail', () => {
  it('renders with all fields populated', () => {
    const html = renderEmail(
      <CatalogRequestReceivedInternalEmail
        requestId="req-123"
        requesterName="Anna Karlsson"
        requesterEmail="anna@kund.se"
        workspaceName="Kund AB"
        sourceTitel="Lag om straff för marknadsmissbruk"
        sourceSfsNummer="1990:1342"
        sourceOmrade="Finansrätt"
        sourceLagansvarig="Erik Andersson"
        sourceKommentar="Ersatt 2005 enligt vår jurist"
        adminNote="Vi behöver den gamla versionen för historisk granskning."
        importFilename="laglista-2026.xlsx"
      />
    )

    expect(html).toContain('Ny katalogförfrågan')
    expect(html).toContain('Anna Karlsson')
    expect(html).toContain('Kund AB')
    expect(html).toContain('Lag om straff för marknadsmissbruk')
    expect(html).toContain('1990:1342')
    expect(html).toContain('Finansrätt')
    expect(html).toContain('Erik Andersson')
    expect(html).toContain('Ersatt 2005 enligt vår jurist')
    expect(html).toContain('Vi behöver den gamla versionen')
    expect(html).toContain('laglista-2026.xlsx')
    expect(html).toContain('anna@kund.se')
    expect(html).toContain('req-123')
    expect(html).toContain('/admin/catalog-requests')
  })

  it('falls back to requesterEmail when name is null', () => {
    const html = renderEmail(
      <CatalogRequestReceivedInternalEmail
        requestId="req-456"
        requesterName={null}
        requesterEmail="okand@kund.se"
        workspaceName="Annan workspace"
        sourceTitel="Lag X"
        sourceSfsNummer={null}
        sourceOmrade={null}
        sourceLagansvarig={null}
        sourceKommentar={null}
        adminNote={null}
        importFilename="rader.csv"
      />
    )

    // Name absent → header line uses email
    expect(html).toContain('okand@kund.se')
    // Optional sections absent
    expect(html).not.toContain('Område:')
    expect(html).not.toContain('Lagansvarig:')
    expect(html).not.toContain('Kommentar i källraden:')
    expect(html).not.toContain('Kundens meddelande:')
    // Required sections still present
    expect(html).toContain('Lag X')
    expect(html).toContain('rader.csv')
    expect(html).toContain('req-456')
  })

  it('handles null titel + null sfs gracefully', () => {
    const html = renderEmail(
      <CatalogRequestReceivedInternalEmail
        requestId="req-789"
        requesterName="X"
        requesterEmail="x@y.se"
        workspaceName="W"
        sourceTitel={null}
        sourceSfsNummer={null}
        sourceOmrade={null}
        sourceLagansvarig={null}
        sourceKommentar={null}
        adminNote={null}
        importFilename="f.xlsx"
      />
    )

    // Should render fallback strings instead of crashing
    expect(html).toContain('(saknad titel)')
    expect(html).toContain('Ny katalogförfrågan')
  })
})
