import { Scale, ShieldCheck, Database, Sparkles } from 'lucide-react'

const stats = [
  {
    icon: Database,
    value: '10 000+',
    label: 'Svenska lagar indexerade',
    iconClass: 'bg-primary/10 text-primary',
  },
  {
    icon: Scale,
    value: '1 000+',
    label: 'Aktiva företag',
    iconClass: 'bg-primary/10 text-primary',
  },
  {
    icon: Sparkles,
    value: '50 000+',
    label: 'AI-svar genererade',
    iconClass: 'bg-primary/10 text-primary',
  },
  {
    icon: ShieldCheck,
    value: '99.9%',
    label: 'Upptid',
    iconClass: 'bg-emerald-500/10 text-emerald-600',
  },
]

export function LogoCloudSection() {
  return (
    <section className="border-y bg-muted/30 py-10">
      <div className="container mx-auto px-4">
        {/* 2x2 grid on mobile, single row on desktop */}
        <div className="grid grid-cols-2 gap-6 md:flex md:items-center md:justify-center md:gap-12 lg:gap-16">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-3">
              {/* Divider - only on desktop, not before first item */}
              {index > 0 && (
                <div className="mr-3 hidden h-8 w-px bg-border md:block lg:mr-4" />
              )}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.iconClass.split(' ')[0]}`}
              >
                <stat.icon
                  className={`h-5 w-5 ${stat.iconClass.split(' ')[1]}`}
                />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight md:text-2xl">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground md:text-sm">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
