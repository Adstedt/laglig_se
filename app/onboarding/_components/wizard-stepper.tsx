'use client'

interface WizardStepperProps {
  currentStep: number
  totalSteps: number
  labels?: string[] | undefined
}

export function WizardStepper({
  currentStep,
  totalSteps,
  labels,
}: WizardStepperProps) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                i <= currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            {labels?.[i] && (
              <span
                className={`text-[10px] leading-none ${
                  i <= currentStep
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {labels[i]}
              </span>
            )}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`h-px w-8 ${
                i < currentStep ? 'bg-primary' : 'bg-muted'
              } ${labels ? 'mb-4' : ''}`}
            />
          )}
        </div>
      ))}
      {!labels && (
        <span className="ml-2 text-sm text-muted-foreground">
          Steg {currentStep + 1} av {totalSteps}
        </span>
      )}
    </div>
  )
}
