'use client'

export function TrialStatusWidget() {
  // TODO: Fetch actual trial status from user subscription
  const trialDaysLeft = 14
  const totalTrialDays = 14

  return (
    <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Provperiod</span>
        <span className="text-xs font-medium text-primary">
          {trialDaysLeft} dagar
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(trialDaysLeft / totalTrialDays) * 100}%` }}
        />
      </div>
    </div>
  )
}
