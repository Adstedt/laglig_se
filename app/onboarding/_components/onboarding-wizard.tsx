'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createWorkspace } from '@/app/actions/workspace'
import { getSafeRedirectUrl } from '@/lib/utils'
import {
  getOnboardingData,
  clearOnboardingData,
} from '@/lib/onboarding/onboarding-store'
import { selectQuestions } from '@/lib/onboarding/question-selector'
import type { InvitationWithDetails } from '@/app/actions/invitations'
import type { WorkspaceOnboardingData } from '@/lib/validation/workspace'
import type { ActivityFlags } from './activity-questions-step'
import { WizardStepper } from './wizard-stepper'
import { CompanyInfoStep } from './company-info-step'
import { ActivityQuestionsStep } from './activity-questions-step'
import { ConfirmStep } from './confirm-step'
import { PendingInvitations } from './pending-invitations'

const WIZARD_STEPS = [
  { id: 'company-info' },
  { id: 'activity-questions' },
  { id: 'confirm' },
] as const

const STEP_LABELS = ['Företagsinfo', 'Verksamhet', 'Bekräfta']

interface OnboardingWizardProps {
  redirect?: string | undefined
  state?: string | undefined
  invitations?: InvitationWithDetails[] | undefined
}

export function OnboardingWizard({
  redirect,
  state,
  invitations,
}: OnboardingWizardProps) {
  const router = useRouter()
  const [showWizard, setShowWizard] = useState(
    !invitations || invitations.length === 0
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Partial<WorkspaceOnboardingData>>({})
  const [activityFlags, setActivityFlags] = useState<ActivityFlags>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [inferredFlags, setInferredFlags] = useState<
    Record<string, boolean> | undefined
  >()

  // Load inferredFlags from OnboardingStore on mount
  useEffect(() => {
    const stored = getOnboardingData()
    if (stored?.inferredFlags) {
      setInferredFlags(stored.inferredFlags)
    }
  }, [])

  const handleCompanyInfoNext = (data: WorkspaceOnboardingData) => {
    setFormData(data)
    setSubmitError(null)
    setCurrentStep((prev) => prev + 1)
  }

  const handleActivityQuestionsNext = (flags: ActivityFlags) => {
    setActivityFlags(flags)
    setCurrentStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  const handleGoBackToEdit = () => {
    setCurrentStep(0)
  }

  const handleSubmit = async () => {
    const data = formData as WorkspaceOnboardingData
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const fd = new FormData()
      fd.append('name', data.companyName)
      fd.append('orgNumber', data.orgNumber)
      if (data.streetAddress) fd.append('streetAddress', data.streetAddress)
      if (data.postalCode) fd.append('postalCode', data.postalCode)
      if (data.city) fd.append('city', data.city)
      if (data.sniCode) fd.append('sniCode', data.sniCode)
      if (data.legalForm) fd.append('legalForm', data.legalForm)
      if (data.employeeCount && data.employeeCount !== '')
        fd.append('employeeCount', data.employeeCount)

      // Enrichment fields from BolagsAPI auto-fill
      if (data.municipality) fd.append('municipality', data.municipality)
      if (data.industryLabel) fd.append('industryLabel', data.industryLabel)
      if (data.foundedYear) fd.append('foundedYear', data.foundedYear)
      if (data.websiteUrl) fd.append('websiteUrl', data.websiteUrl)
      if (data.businessDescription)
        fd.append('businessDescription', data.businessDescription)
      if (data.taxStatus) fd.append('taxStatus', data.taxStatus)
      if (data.foreignOwned !== undefined)
        fd.append('foreignOwned', String(data.foreignOwned))
      if (data.parentCompanyName)
        fd.append('parentCompanyName', data.parentCompanyName)
      if (data.parentCompanyOrgnr)
        fd.append('parentCompanyOrgnr', data.parentCompanyOrgnr)
      if (data.fiRegulated !== undefined)
        fd.append('fiRegulated', String(data.fiRegulated))
      if (data.activeStatus) fd.append('activeStatus', data.activeStatus)
      if (data.ongoingProcedures)
        fd.append('ongoingProcedures', data.ongoingProcedures)
      if (data.registeredDate) fd.append('registeredDate', data.registeredDate)
      if (data.dataSource) fd.append('dataSource', data.dataSource)

      // Activity flags from questions step (Story 16.3)
      if (Object.keys(activityFlags).length > 0) {
        // Separate has_collective_agreement from activity_flags
        const { has_collective_agreement, ...flagsOnly } = activityFlags
        fd.append('activityFlags', JSON.stringify(flagsOnly))
        if (has_collective_agreement !== undefined) {
          fd.append('hasCollectiveAgreement', String(has_collective_agreement))
        }
      }

      const result = await createWorkspace(fd)

      if (!result.success) {
        if (result.error?.includes('organisationsnummer')) {
          setSubmitError(result.error)
        } else {
          setSubmitError(null)
          toast.error(result.error || 'Ett fel uppstod. Försök igen.')
        }
        return
      }

      clearOnboardingData()
      const targetUrl = getSafeRedirectUrl(redirect)
      router.push(targetUrl)
    } catch {
      toast.error('Ett fel uppstod. Försök igen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Build questions for the activity step based on company data
  const questions = selectQuestions({
    sniCode: (formData as WorkspaceOnboardingData).sniCode,
    employeeCount:
      (formData as WorkspaceOnboardingData).employeeCount &&
      (formData as WorkspaceOnboardingData).employeeCount !== ''
        ? parseInt(
            (formData as WorkspaceOnboardingData).employeeCount as string,
            10
          )
        : undefined,
    inferredFlags,
  })

  if (!showWizard && invitations && invitations.length > 0) {
    return (
      <div>
        <PendingInvitations
          invitations={invitations}
          onAllDeclined={() => setShowWizard(true)}
          redirectUrl={redirect}
        />
      </div>
    )
  }

  return (
    <div>
      {state === 'deleted' && (
        <Alert className="mb-5">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Ditt tidigare workspace har raderats. Skapa ett nytt för att
            fortsätta.
          </AlertDescription>
        </Alert>
      )}

      <WizardStepper
        currentStep={currentStep}
        totalSteps={WIZARD_STEPS.length}
        labels={STEP_LABELS}
      />

      {(() => {
        const stepId = WIZARD_STEPS[currentStep]?.id
        return (
          <>
            {stepId === 'company-info' && (
              <CompanyInfoStep
                defaultValues={formData}
                onNext={handleCompanyInfoNext}
              />
            )}

            {stepId === 'activity-questions' && (
              <ActivityQuestionsStep
                questions={questions}
                onNext={handleActivityQuestionsNext}
                onBack={handleBack}
              />
            )}

            {stepId === 'confirm' && (
              <ConfirmStep
                data={formData as WorkspaceOnboardingData}
                onBack={handleBack}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onGoBackToEdit={handleGoBackToEdit}
              />
            )}
          </>
        )
      })()}
    </div>
  )
}
