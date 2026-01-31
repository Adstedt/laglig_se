'use client'

interface WizardStepperProps {
  currentStep: number
  totalSteps: number
}

export function WizardStepper({ currentStep, totalSteps }: WizardStepperProps) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
              i <= currentStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`h-px w-8 ${
                i < currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        Steg {currentStep + 1} av {totalSteps}
      </span>
    </div>
  )
}
