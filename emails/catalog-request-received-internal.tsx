/**
 * Internal ops notification when a customer submits a catalog-add request.
 *
 * Sent to CATALOG_REQUEST_NOTIFICATION_EMAIL (default dev@laglig.se) the
 * moment requestCatalogAdd creates a CatalogIngestRequest, so the team can
 * triage manually — ingest the missing document (or set up a pipeline for a
 * new agency / content type) and contact the customer directly.
 */

import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  EmailInfoCard,
  EmailMeta,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_DOCUMENT } from './components/email-icons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

export interface CatalogRequestReceivedInternalEmailProps {
  requestId: string
  requesterName: string | null
  requesterEmail: string
  workspaceName: string
  sourceTitel: string | null
  sourceSfsNummer: string | null
  sourceOmrade: string | null
  sourceLagansvarig: string | null
  sourceKommentar: string | null
  adminNote: string | null
  importFilename: string
}

export function CatalogRequestReceivedInternalEmail({
  requestId = '',
  requesterName = null,
  requesterEmail = '',
  workspaceName = '',
  sourceTitel = null,
  sourceSfsNummer = null,
  sourceOmrade = null,
  sourceLagansvarig = null,
  sourceKommentar = null,
  adminNote = null,
  importFilename = '',
}: CatalogRequestReceivedInternalEmailProps) {
  const titel = sourceTitel ?? '(saknad titel)'
  const sfs = sourceSfsNummer ?? '—'
  const subjectAnchor = sourceSfsNummer
    ? `${titel} (${sourceSfsNummer})`
    : titel

  return (
    <LagligEmailLayout
      preview={`Ny katalogförfrågan: ${subjectAnchor} från ${workspaceName}`}
    >
      <EmailIconCircle src={ICON_DOCUMENT} />
      <EmailHeading>Ny katalogförfrågan</EmailHeading>
      <EmailBody>
        <strong>{requesterName ?? requesterEmail}</strong> från{' '}
        <strong>{workspaceName}</strong> har begärt att vi lägger till ett
        dokument som saknas i katalogen.
      </EmailBody>

      <EmailInfoCard>
        <EmailMeta align="left">
          <strong>Titel:</strong> {titel}
        </EmailMeta>
        <EmailMeta align="left">
          <strong>SFS / dokumentnummer:</strong> {sfs}
        </EmailMeta>
        {sourceOmrade && (
          <EmailMeta align="left">
            <strong>Område:</strong> {sourceOmrade}
          </EmailMeta>
        )}
        {sourceLagansvarig && (
          <EmailMeta align="left">
            <strong>Lagansvarig:</strong> {sourceLagansvarig}
          </EmailMeta>
        )}
        {sourceKommentar && (
          <EmailMeta align="left">
            <strong>Kommentar i källraden:</strong> {sourceKommentar}
          </EmailMeta>
        )}
        <EmailMeta align="left">
          <strong>Importfil:</strong> {importFilename}
        </EmailMeta>
      </EmailInfoCard>

      {adminNote && (
        <>
          <EmailBody>
            <strong>Kundens meddelande:</strong>
          </EmailBody>
          <EmailInfoCard>
            <EmailMeta align="left">{adminNote}</EmailMeta>
          </EmailInfoCard>
        </>
      )}

      <EmailBody>
        Kontakta kunden på <strong>{requesterEmail}</strong> när dokumentet är
        på plats — fullföljs förfrågan via admin-vyn skickas också en automatisk
        bekräftelse.
      </EmailBody>

      <EmailCta href={`${APP_URL}/admin/catalog-requests`}>
        Öppna admin-vyn
      </EmailCta>

      <EmailMeta>Förfrågans ID: {requestId}</EmailMeta>
    </LagligEmailLayout>
  )
}

export default CatalogRequestReceivedInternalEmail
