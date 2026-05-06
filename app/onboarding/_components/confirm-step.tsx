'use client'

import { LoaderCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  LEGAL_FORM_LABELS,
  type WorkspaceOnboardingData,
} from '@/lib/validation/workspace'

// Story 5.12: same URL as BillingDashboard.ENTERPRISE_CONTACT_URL.
const ENTERPRISE_CONTACT_URL = 'https://cal.com/laglig/sales'

const TIER_LABELS: Record<'SOLO' | 'TEAM' | 'ENTERPRISE', string> = {
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

interface ConfirmStepProps {
  data: WorkspaceOnboardingData
  pickedTier: 'SOLO' | 'TEAM' | 'ENTERPRISE'
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
  submitError: string | null
  onGoBackToEdit: () => void
  onChangeTier: () => void
}

export function ConfirmStep({
  data,
  pickedTier,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
  onGoBackToEdit,
  onChangeTier,
}: ConfirmStepProps) {
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 14)
  const formattedTrialEnd = trialEndDate.toISOString().split('T')[0]

  const hasAddress = data.streetAddress || data.postalCode || data.city
  const isEnterprise = pickedTier === 'ENTERPRISE'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-safiro text-2xl font-medium tracking-tight">
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
        {hasAddress && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-sm text-muted-foreground">Adress</dt>
            <dd className="text-sm font-medium text-foreground sm:text-right">
              {data.streetAddress && (
                <span className="block">{data.streetAddress}</span>
              )}
              {(data.postalCode || data.city) && (
                <span className="block">
                  {[data.postalCode, data.city].filter(Boolean).join(' ')}
                </span>
              )}
            </dd>
          </div>
        )}
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

      {/* Trial info callout — tier-aware */}
      {isEnterprise ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/30 dark:bg-amber-950/20">
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Vi har bett om kontakt om Enterprise — vi hör av oss inom 24
              timmar.
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              Under tiden får du Team-funktionalitet i 15 dagar så du kan
              utvärdera plattformen medan vi pratar. Provperioden löper ut{' '}
              {formattedTrialEnd}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={ENTERPRISE_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              Boka samtal
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={onChangeTier}
              className="text-xs text-amber-900 underline hover:text-amber-950 dark:text-amber-200"
            >
              Ändra nivå
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-medium">
            Provperiod: {TIER_LABELS[pickedTier]} · 15 dagar gratis · ingen
            betalning krävs
          </p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-emerald-700 dark:text-emerald-300">
              Provperioden löper ut {formattedTrialEnd}
            </p>
            <button
              type="button"
              onClick={onChangeTier}
              className="text-xs text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-300"
            >
              Ändra nivå
            </button>
          </div>
        </div>
      )}

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
