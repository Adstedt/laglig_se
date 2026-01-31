'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createWorkspace } from '@/app/actions/workspace'
import { getSafeRedirectUrl } from '@/lib/utils'
import type { WorkspaceOnboardingData } from '@/lib/validation/workspace'
import { WizardStepper } from './wizard-stepper'
import { CompanyInfoStep } from './company-info-step'
import { ConfirmStep } from './confirm-step'

const WIZARD_STEPS = [
  { id: 'company-info' },
  // Future: { id: 'law-list' },
  { id: 'confirm' },
] as const

interface OnboardingWizardProps {
  redirect?: string | undefined
  state?: string | undefined
}

export function OnboardingWizard({ redirect, state }: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Partial<WorkspaceOnboardingData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleCompanyInfoNext = (data: WorkspaceOnboardingData) => {
    setFormData(data)
    setSubmitError(null)
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

      const targetUrl = getSafeRedirectUrl(redirect)
      router.push(targetUrl)
    } catch {
      toast.error('Ett fel uppstod. Försök igen.')
    } finally {
      setIsSubmitting(false)
    }
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
