'use client'

/**
 * Story 14.4: Company Profile Tab
 * Form for editing workspace company profile data for the compliance agent.
 */

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateCompanyProfile } from '@/app/actions/company-profile'
import type { CompanyProfile } from '@prisma/client'

// ============================================================================
// Constants
// ============================================================================

const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  AB: 'Aktiebolag (AB)',
  HB: 'Handelsbolag (HB)',
  KOMMUN: 'Kommun',
  REGION: 'Region',
  STATLIG_MYNDIGHET: 'Statlig myndighet',
  ENSKILD_FIRMA: 'Enskild firma',
  EKONOMISK_FORENING: 'Ekonomisk förening',
  OTHER: 'Annat',
}

const EMPLOYEE_COUNT_LABELS: Record<string, string> = {
  RANGE_1_9: '1-9 anställda',
  RANGE_10_49: '10-49 anställda',
  RANGE_50_249: '50-249 anställda',
  RANGE_250_PLUS: '250+ anställda',
  UNKNOWN: 'Vet ej',
}

const COMPLIANCE_MATURITY_LABELS: Record<string, string> = {
  BASIC: 'Grundläggande',
  DEVELOPING: 'Under utveckling',
  ESTABLISHED: 'Etablerad',
  ADVANCED: 'Avancerad',
}

const WORKFORCE_COMPOSITION_LABELS: Record<string, string> = {
  MOSTLY_WORKERS: 'Mestadels arbetare',
  MOSTLY_SALARIED: 'Mestadels tjänstemän',
  MIXED: 'Blandad',
  UNKNOWN: 'Vet ej',
}

const REVENUE_RANGE_LABELS: Record<string, string> = {
  UNDER_3M: '< 3 MSEK',
  RANGE_3M_TO_40M: '3–40 MSEK',
  RANGE_40M_TO_400M: '40–400 MSEK',
  OVER_400M: '> 400 MSEK',
  UNKNOWN: 'Vet ej',
}

const ACTIVITY_FLAG_LABELS: Record<string, string> = {
  chemicals: 'Hanterar kemikalier',
  construction: 'Bygg- och anläggningsverksamhet',
  food: 'Livsmedelshantering',
  personalData: 'Hanterar personuppgifter (GDPR)',
  publicSector: 'Offentlig sektor',
  heavyMachinery: 'Tunga maskiner / fordon',
  minorEmployees: 'Minderåriga anställda',
  internationalOperations: 'Internationell verksamhet',
}

const ACTIVITY_FLAG_KEYS = [
  'chemicals',
  'construction',
  'food',
  'personalData',
  'publicSector',
  'heavyMachinery',
  'minorEmployees',
  'internationalOperations',
] as const

// ============================================================================
// Form Schema
// ============================================================================

const formSchema = z.object({
  company_name: z.string().min(1, 'Företagsnamn krävs').max(200),
  org_number: z.string().max(20).optional().or(z.literal('')),
  organization_type: z.string().optional().or(z.literal('')),
  sni_code: z.string().max(20).optional().or(z.literal('')),
  industry_label: z.string().max(200).optional().or(z.literal('')),
  employee_count_range: z.string().optional().or(z.literal('')),
  compliance_maturity: z.string().optional().or(z.literal('')),
  has_compliance_officer: z.boolean(),
  chemicals: z.boolean(),
  construction: z.boolean(),
  food: z.boolean(),
  personalData: z.boolean(),
  publicSector: z.boolean(),
  heavyMachinery: z.boolean(),
  minorEmployees: z.boolean(),
  internationalOperations: z.boolean(),
  // Phase 2 fields
  municipality: z.string().max(100).optional().or(z.literal('')),
  website_url: z.string().max(500).optional().or(z.literal('')),
  founded_year: z.string().optional().or(z.literal('')),
  has_collective_agreement: z.boolean(),
  collective_agreement_name: z.string().max(200).optional().or(z.literal('')),
  workforce_composition: z.string().optional().or(z.literal('')),
  revenue_range: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof formSchema>

// ============================================================================
// Helpers
// ============================================================================

interface ActivityFlags {
  chemicals?: boolean
  construction?: boolean
  food?: boolean
  personalData?: boolean
  publicSector?: boolean
  heavyMachinery?: boolean
  minorEmployees?: boolean
  internationalOperations?: boolean
}

function getActivityFlags(profile: CompanyProfile): ActivityFlags {
  if (
    profile.activity_flags &&
    typeof profile.activity_flags === 'object' &&
    !Array.isArray(profile.activity_flags)
  ) {
    return profile.activity_flags as ActivityFlags
  }
  return {}
}

function getCompletionNudge(
  values: FormData,
  certifications: string[]
): string | null {
  if (!values.company_name) return 'Fyll i företagsnamn för att komma igång.'
  if (!values.organization_type)
    return 'Ange organisationsform för att låsa upp branschspecifika regler.'
  if (!values.industry_label)
    return 'Ange bransch för bättre regelverksfiltrering.'
  if (!values.employee_count_range)
    return 'Ange antal anställda — storleken påverkar vilka regler som gäller.'
  if (!values.municipality) return 'Ange kommun för lokala regelverk.'
  if (!values.sni_code)
    return 'Lägg till SNI-kod för mer exakt branschklassificering.'
  const anyFlag = ACTIVITY_FLAG_KEYS.some(
    (key) => values[key as keyof FormData]
  )
  if (!anyFlag)
    return 'Markera verksamhetstyper för att aktivera relevanta regelverk.'
  if (certifications.length === 0)
    return 'Lägg till certifieringar för anpassade rekommendationer.'
  if (!values.compliance_maturity)
    return 'Ange compliance-mognad för anpassad vägledning.'
  return null
}

// ============================================================================
// Component
// ============================================================================

interface CompanyProfileTabProps {
  companyProfile: CompanyProfile
}

export function CompanyProfileTab({ companyProfile }: CompanyProfileTabProps) {
  const [isPending, startTransition] = useTransition()
  const [certifications, setCertifications] = useState<string[]>(
    companyProfile.certifications ?? []
  )
  const [certInput, setCertInput] = useState('')
  const [completeness, setCompleteness] = useState(
    companyProfile.profile_completeness
  )

  const flags = getActivityFlags(companyProfile)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: companyProfile.company_name,
      org_number: companyProfile.org_number ?? '',
      organization_type: companyProfile.organization_type ?? '',
      sni_code: companyProfile.sni_code ?? '',
      industry_label: companyProfile.industry_label ?? '',
      employee_count_range: companyProfile.employee_count_range ?? '',
      compliance_maturity: companyProfile.compliance_maturity ?? '',
      has_compliance_officer: companyProfile.has_compliance_officer,
      chemicals: flags.chemicals ?? false,
      construction: flags.construction ?? false,
      food: flags.food ?? false,
      personalData: flags.personalData ?? false,
      publicSector: flags.publicSector ?? false,
      heavyMachinery: flags.heavyMachinery ?? false,
      minorEmployees: flags.minorEmployees ?? false,
      internationalOperations: flags.internationalOperations ?? false,
      // Phase 2 fields
      municipality: companyProfile.municipality ?? '',
      website_url: companyProfile.website_url ?? '',
      founded_year: companyProfile.founded_year?.toString() ?? '',
      has_collective_agreement: companyProfile.has_collective_agreement,
      collective_agreement_name: companyProfile.collective_agreement_name ?? '',
      workforce_composition: companyProfile.workforce_composition ?? '',
      revenue_range: companyProfile.revenue_range ?? '',
    },
  })

  const watchedValues = form.watch()
  const nudge = getCompletionNudge(watchedValues, certifications)
  const anyFlagSelected = ACTIVITY_FLAG_KEYS.some((key) => watchedValues[key])

  function addCertification() {
    const trimmed = certInput.trim()
    if (
      trimmed &&
      !certifications.includes(trimmed) &&
      certifications.length < 20
    ) {
      setCertifications([...certifications, trimmed])
      setCertInput('')
    }
  }

  function removeCertification(cert: string) {
    setCertifications(certifications.filter((c) => c !== cert))
  }

  function handleCertKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCertification()
    }
  }

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const foundedYear = data.founded_year
        ? parseInt(data.founded_year, 10)
        : null

      const result = await updateCompanyProfile({
        company_name: data.company_name,
        org_number: data.org_number || null,
        organization_type: data.organization_type
          ? (data.organization_type as CompanyProfile['organization_type'])
          : null,
        sni_code: data.sni_code || null,
        industry_label: data.industry_label || null,
        employee_count_range: data.employee_count_range
          ? (data.employee_count_range as CompanyProfile['employee_count_range'])
          : null,
        activity_flags: {
          chemicals: data.chemicals,
          construction: data.construction,
          food: data.food,
          personalData: data.personalData,
          publicSector: data.publicSector,
          heavyMachinery: data.heavyMachinery,
          minorEmployees: data.minorEmployees,
          internationalOperations: data.internationalOperations,
        },
        certifications,
        compliance_maturity: data.compliance_maturity
          ? (data.compliance_maturity as CompanyProfile['compliance_maturity'])
          : null,
        has_compliance_officer: data.has_compliance_officer,
        municipality: data.municipality || null,
        website_url: data.website_url || null,
        founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
        has_collective_agreement: data.has_collective_agreement,
        collective_agreement_name: data.collective_agreement_name || null,
        workforce_composition: data.workforce_composition
          ? (data.workforce_composition as CompanyProfile['workforce_composition'])
          : null,
        revenue_range: data.revenue_range
          ? (data.revenue_range as CompanyProfile['revenue_range'])
          : null,
      })

      if (result.success) {
        toast.success('Företagsprofil uppdaterad')
        if (result.profile_completeness !== undefined) {
          setCompleteness(result.profile_completeness)
        }
      } else {
        toast.error(result.error || 'Något gick fel')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* AI context banner */}
      <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Er företagsprofil styr AI-rådgivningen</p>
          <p className="text-muted-foreground">
            Ju mer vi vet om ert företag, desto bättre kan vår AI identifiera
            relevanta lagar och ge er skräddarsydda rekommendationer.
          </p>
        </div>
      </div>

      {/* Profile completeness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Profilstatus</span>
          <span className="font-medium">{completeness}%</span>
        </div>
        <Progress value={completeness} className="h-2" />
        {nudge && <p className="text-xs text-muted-foreground">{nudge}</p>}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top-left: Företagsinformation */}
          <Card>
            <CardHeader>
              <CardTitle>Företagsinformation</CardTitle>
              <CardDescription>
                Används för att identifiera branschspecifika regelverk
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Företagsnamn</Label>
                <Input
                  id="company_name"
                  {...form.register('company_name')}
                  placeholder="Företagets namn"
                />
                {form.formState.errors.company_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.company_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org_number">Organisationsnummer</Label>
                <Input
                  id="org_number"
                  {...form.register('org_number')}
                  placeholder="XXXXXX-XXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization_type">Organisationsform</Label>
                <Select
                  value={form.watch('organization_type') ?? ''}
                  onValueChange={(v) => form.setValue('organization_type', v)}
                >
                  <SelectTrigger id="organization_type">
                    <SelectValue placeholder="Välj organisationsform" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORGANIZATION_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="municipality">Kommun</Label>
                <Input
                  id="municipality"
                  {...form.register('municipality')}
                  placeholder="t.ex. Stockholm"
                />
                <p className="text-xs text-muted-foreground">
                  Kommunen där verksamheten bedrivs — styr lokala tillsynskrav.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website_url">Webbplats</Label>
                <Input
                  id="website_url"
                  {...form.register('website_url')}
                  placeholder="https://exempel.se"
                  type="url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="founded_year">Grundat år</Label>
                <Input
                  id="founded_year"
                  {...form.register('founded_year')}
                  placeholder="t.ex. 2015"
                  type="number"
                  min={1800}
                  max={2100}
                />
              </div>
            </CardContent>
          </Card>

          {/* Top-right: Bransch & storlek */}
          <Card>
            <CardHeader>
              <CardTitle>Bransch & storlek</CardTitle>
              <CardDescription>
                Styr vilka regelverk och storlekskrav som gäller
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sni_code">SNI-kod</Label>
                <Input
                  id="sni_code"
                  {...form.register('sni_code')}
                  placeholder="t.ex. 62010"
                />
                <p className="text-xs text-muted-foreground">
                  Hittas på Bolagsverket. Styr vilka branschföreskrifter som
                  matchar.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry_label">Bransch</Label>
                <Input
                  id="industry_label"
                  {...form.register('industry_label')}
                  placeholder="t.ex. IT-konsulting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_count_range">Antal anställda</Label>
                <Select
                  value={form.watch('employee_count_range') ?? ''}
                  onValueChange={(v) =>
                    form.setValue('employee_count_range', v)
                  }
                >
                  <SelectTrigger id="employee_count_range">
                    <SelectValue placeholder="Välj antal anställda" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYEE_COUNT_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workforce_composition">
                  Personalsammansättning
                </Label>
                <Select
                  value={form.watch('workforce_composition') ?? ''}
                  onValueChange={(v) =>
                    form.setValue('workforce_composition', v)
                  }
                >
                  <SelectTrigger id="workforce_composition">
                    <SelectValue placeholder="Välj personalsammansättning" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WORKFORCE_COMPOSITION_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Påverkar vilka kollektivavtal och arbetsmiljöregler som
                  gäller.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenue_range">Omsättning</Label>
                <Select
                  value={form.watch('revenue_range') ?? ''}
                  onValueChange={(v) => form.setValue('revenue_range', v)}
                >
                  <SelectTrigger id="revenue_range">
                    <SelectValue placeholder="Välj omsättningsintervall" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REVENUE_RANGE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Styr bokförings- och revisionskrav.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bottom-left: Verksamhet */}
          <Card>
            <CardHeader>
              <CardTitle>Verksamhet</CardTitle>
              <CardDescription>
                Hjälper AI:n filtrera lagar efter era verksamhetsrisker
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Verksamhetstyper</Label>
                  <p className="text-xs text-muted-foreground">
                    Markera alla som stämmer — varje flagga aktiverar ett
                    regelverk.
                  </p>
                </div>
                {ACTIVITY_FLAG_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`flag-${key}`} className="font-normal">
                      {ACTIVITY_FLAG_LABELS[key]}
                    </Label>
                    <Switch
                      id={`flag-${key}`}
                      checked={form.watch(key)}
                      onCheckedChange={(checked) => form.setValue(key, checked)}
                    />
                  </div>
                ))}
                {!anyFlagSelected && (
                  <p className="text-xs text-muted-foreground italic">
                    Inga verksamhetstyper valda — AI:n utgår från generella
                    regler.
                  </p>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="has_collective_agreement"
                    className="font-normal"
                  >
                    Har ni kollektivavtal?
                  </Label>
                  <Switch
                    id="has_collective_agreement"
                    checked={form.watch('has_collective_agreement')}
                    onCheckedChange={(checked) =>
                      form.setValue('has_collective_agreement', checked)
                    }
                  />
                </div>

                {form.watch('has_collective_agreement') && (
                  <div className="space-y-2">
                    <Label htmlFor="collective_agreement_name">
                      Namn på kollektivavtal
                    </Label>
                    <Input
                      id="collective_agreement_name"
                      {...form.register('collective_agreement_name')}
                      placeholder="t.ex. Teknikavtalet"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Label htmlFor="has_compliance_officer" className="font-normal">
                  Har ni en compliance-ansvarig?
                </Label>
                <Switch
                  id="has_compliance_officer"
                  checked={form.watch('has_compliance_officer')}
                  onCheckedChange={(checked) =>
                    form.setValue('has_compliance_officer', checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Bottom-right: Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
              <CardDescription>
                Anpassar rekommendationer till er mognadsnivå
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Certifieringar</Label>
                <div className="flex gap-2">
                  <Input
                    value={certInput}
                    onChange={(e) => setCertInput(e.target.value)}
                    onKeyDown={handleCertKeyDown}
                    placeholder="t.ex. ISO 45001"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCertification}
                    disabled={!certInput.trim()}
                  >
                    Lägg till
                  </Button>
                </div>
                {certifications.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {certifications.map((cert) => (
                      <Badge key={cert} variant="secondary" className="gap-1">
                        {cert}
                        <button
                          type="button"
                          onClick={() => removeCertification(cert)}
                          className="ml-1 rounded-full hover:bg-muted"
                          aria-label={`Ta bort ${cert}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="compliance_maturity">Compliance-mognad</Label>
                <p className="text-xs text-muted-foreground">
                  Påverkar hur detaljerade rekommendationer AI:n ger.
                </p>
                <Select
                  value={form.watch('compliance_maturity') ?? ''}
                  onValueChange={(v) => form.setValue('compliance_maturity', v)}
                >
                  <SelectTrigger id="compliance_maturity">
                    <SelectValue placeholder="Välj mognadsnivå" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPLIANCE_MATURITY_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Spara ändringar
        </Button>
      </form>
    </div>
  )
}
