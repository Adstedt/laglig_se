/**
 * Story 24.4: email sent on `commitImport` — confirms the imported list is
 * live and surfaces any rows handed off to ops as catalog requests.
 *
 * Mirrors the `TaskAssignedEmail` pattern in this directory: react-email
 * primitives, wrapped in `<LagligEmailLayout>`, Swedish copy.
 */

import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_LIST } from './components/email-icons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

export interface ImportReviewReadyEmailProps {
  /** First name from `User.name`; null is fine — falls back to "du". */
  firstName: string | null
  /** The list name the user picked at commit. */
  listName: string
  /** ID of the newly-created LawList — used to build the deep link. */
  lawListId: string
  /** Number of rows committed to the new list. */
  rowsAdded: number
  /** Number of rows handed off to ops as catalog requests (24h SLA). */
  rowsRequested: number
}

export function ImportReviewReadyEmail({
  firstName = null,
  listName = 'Laglista',
  lawListId = '',
  rowsAdded = 0,
  rowsRequested = 0,
}: ImportReviewReadyEmailProps) {
  const greetingName = firstName ?? 'du'
  const listUrl = `${APP_URL}/laglistor?list=${lawListId}`

  return (
    <LagligEmailLayout
      preview={`Din lista "${listName}" är skapad med ${rowsAdded} lagar`}
    >
      <EmailIconCircle src={ICON_LIST} />
      <EmailHeading>Din importerade laglista är klar</EmailHeading>
      <EmailBody>
        Hej {greetingName}, din lista <strong>&ldquo;{listName}&rdquo;</strong>{' '}
        är skapad med <strong>{rowsAdded}</strong>{' '}
        {rowsAdded === 1 ? 'lag' : 'lagar'}.
      </EmailBody>
      {rowsRequested > 0 && (
        <EmailBody>
          Vi arbetar på <strong>{rowsRequested}</strong>{' '}
          {rowsRequested === 1 ? 'dokument' : 'dokument'} som inte fanns i vår
          katalog och meddelar dig inom 24 timmar när de är tillagda.
        </EmailBody>
      )}
      <EmailCta href={listUrl}>Öppna listan</EmailCta>
    </LagligEmailLayout>
  )
}

export default ImportReviewReadyEmail
