/**
 * Story 24.5: email sent when ops fulfils a catalog-add request.
 *
 * Closes the 24h SLA loop — confirms the originating row has been auto-
 * rematched and surfaces the right deep link depending on the import's
 * current state (COMMITTED → law list; AWAITING_REVIEW → review surface).
 */

import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CHECK } from './components/email-icons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

export interface CatalogRequestFulfilledEmailProps {
  firstName: string | null
  /** The user's source-row title — what they originally typed/uploaded. */
  sourceTitel: string
  /** The filename of the import the request originated from. */
  importFilename: string
  /** Title of the LegalDocument ops ingested. */
  legalDocumentTitle: string
  /** Document number if available — surfaces in subject when present. */
  legalDocumentNumber: string | null
  /**
   * Where to send the user. If the import is already COMMITTED, deep-link
   * to the law list (the row will be missing until they refresh — copy
   * acknowledges this); else deep-link back to the review surface.
   */
  importStatus: 'COMMITTED' | 'AWAITING_REVIEW' | 'OTHER'
  importId: string
  /** Set when importStatus=COMMITTED. */
  lawListId: string | null
  /** Set when importStatus=COMMITTED — surfaced in the body copy. */
  lawListName: string | null
}

export function CatalogRequestFulfilledEmail({
  firstName = null,
  sourceTitel = 'Lag',
  importFilename = 'import.xlsx',
  legalDocumentTitle = 'Lag',
  legalDocumentNumber = null,
  importStatus = 'OTHER',
  importId = '',
  lawListId = null,
  lawListName = null,
}: CatalogRequestFulfilledEmailProps) {
  const greetingName = firstName ?? 'du'
  const subjectAnchor = legalDocumentNumber
    ? `${legalDocumentTitle} (${legalDocumentNumber})`
    : legalDocumentTitle

  // Deep-link target: prefer the law list when committed; else back to the
  // review surface so the user sees the now-fulfilled row inline.
  const ctaUrl =
    importStatus === 'COMMITTED' && lawListId
      ? `${APP_URL}/laglistor?list=${lawListId}`
      : `${APP_URL}/laglistor/skapa/${importId}/granska`
  const ctaLabel =
    importStatus === 'COMMITTED' && lawListId
      ? 'Öppna listan'
      : 'Återgå till granskning'

  return (
    <LagligEmailLayout
      preview={`Vi har lagt till ${subjectAnchor} i katalogen`}
    >
      <EmailIconCircle src={ICON_CHECK} />
      <EmailHeading>Vi har lagt till {subjectAnchor} i katalogen</EmailHeading>
      <EmailBody>
        Hej {greetingName}, du begärde att vi skulle lägga till{' '}
        <strong>&ldquo;{sourceTitel}&rdquo;</strong> i katalogen för din import{' '}
        <strong>{importFilename}</strong>. Det är nu klart.
      </EmailBody>
      {importStatus === 'COMMITTED' && lawListName ? (
        <EmailBody>
          Raden har automatiskt matchats mot{' '}
          <strong>{legalDocumentTitle}</strong> och är nu en del av din lista{' '}
          <strong>&ldquo;{lawListName}&rdquo;</strong>.
        </EmailBody>
      ) : (
        <EmailBody>
          Raden har automatiskt matchats mot{' '}
          <strong>{legalDocumentTitle}</strong>. Återgå till granskningsvyn för
          att se den och bekräfta din lista.
        </EmailBody>
      )}
      <EmailCta href={ctaUrl}>{ctaLabel}</EmailCta>
    </LagligEmailLayout>
  )
}

export default CatalogRequestFulfilledEmail
