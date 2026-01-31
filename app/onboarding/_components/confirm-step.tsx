'use client'

import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  LEGAL_FORM_LABELS,
  type WorkspaceOnboardingData,
} from '@/lib/validation/workspace'

interface ConfirmStepProps {
  data: WorkspaceOnboardingData
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
  submitError: string | null
  onGoBackToEdit: () => void
}

export function ConfirmStep({
  data,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
  onGoBackToEdit,
}: ConfirmStepProps) {
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 14)
  const formattedTrialEnd = trialEndDate.toISOString().split('T')[0]

  const addressParts = [data.streetAddress, data.postalCode, data.city].filter(
    Boolean
  )
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-safiro text-2xl font-semibold tracking-tight">
          Bekräfta &amp; Skapa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Granska dina uppgifter innan workspace skapas.
        </p>
      </div>

      {/* Summary card */}
      <dl className="space-y-3 rounded-lg border p-4">
        <SummaryRow label="Företagsnamn" value={data.companyName} />
        <SummaryRow label="Organisationsnummer" value={data.orgNumber} />
        {fullAddress && <SummaryRow label="Adress" value={fullAddress} />}
        {data.sniCode && (
          <SummaryRow label="Bransch / SNI-kod" value={data.sniCode} />
        )}
        {data.legalForm && (
          <SummaryRow
            label="Juridisk form"
            value={LEGAL_FORM_LABELS[data.legalForm] || data.legalForm}
          />
        )}
        {data.employeeCount && data.employeeCount !== '' && (
          <SummaryRow label="Antal anställda" value={data.employeeCount} />
        )}
      </dl>

      {/* Trial info callout */}
      <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <p className="font-medium">Din 14-dagars provperiod börjar nu</p>
        <p className="mt-1 text-emerald-700 dark:text-emerald-300">
          Provperioden löper ut {formattedTrialEnd}
        </p>
      </div>

      {/* Duplicate org number error */}
      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p>{submitError}</p>
          {submitError.includes('organisationsnummer') && (
            <Button
              variant="link"
              className="mt-1 h-auto p-0 text-sm text-destructive underline"
              onClick={onGoBackToEdit}
            >
              Ändra organisationsnummer
            </Button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1"
        >
          Tillbaka
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Skapar workspace...
            </>
          ) : (
            'Skapa workspace'
          )}
        </Button>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}
