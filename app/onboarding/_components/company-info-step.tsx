'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  WorkspaceOnboardingSchema,
  LEGAL_FORM_OPTIONS,
  type WorkspaceOnboardingData,
} from '@/lib/validation/workspace'
import { useCompanyLookup } from '@/lib/hooks/use-company-lookup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface CompanyInfoStepProps {
  defaultValues: Partial<WorkspaceOnboardingData>
  onNext: (_data: WorkspaceOnboardingData) => void
}

export function CompanyInfoStep({
  defaultValues,
  onNext,
}: CompanyInfoStepProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WorkspaceOnboardingData>({
    resolver: zodResolver(WorkspaceOnboardingSchema),
    defaultValues: {
      companyName: '',
      orgNumber: '',
      streetAddress: '',
      postalCode: '',
      city: '',
      sniCode: '',
      legalForm: '',
      ...defaultValues,
    },
  })

  const legalFormValue = watch('legalForm')
  const orgNumberValue = watch('orgNumber')
  const companyNameValue = watch('companyName')

  const { data, isLoading, error, isAutoFilled } =
    useCompanyLookup(orgNumberValue)

  // Track whether the badge should show (auto-filled and user hasn't edited companyName)
  const [showBadge, setShowBadge] = useState(false)
  const [lastAutoFilledName, setLastAutoFilledName] = useState<string | null>(
    null
  )

  // Auto-fill form fields on successful lookup
  useEffect(() => {
    if (!data) return

    const { profile, address } = data

    // Visible form fields
    if (profile.company_name) {
      setValue('companyName', profile.company_name as string)
      setLastAutoFilledName(profile.company_name as string)
      setShowBadge(true)
    }
    if (address.street) setValue('streetAddress', address.street)
    if (address.postal_code) setValue('postalCode', address.postal_code)
    if (address.city) setValue('city', address.city)
    if (profile.sni_code) setValue('sniCode', profile.sni_code as string)
    if (profile.legal_form) {
      setValue(
        'legalForm',
        profile.legal_form as WorkspaceOnboardingData['legalForm'],
        { shouldValidate: true }
      )
    }

    // Enrichment fields (hidden — flow through data model)
    if (profile.municipality)
      setValue('municipality', profile.municipality as string)
    if (profile.industry_label)
      setValue('industryLabel', profile.industry_label as string)
    if (profile.founded_year)
      setValue('foundedYear', String(profile.founded_year))
    if (profile.website_url)
      setValue('websiteUrl', profile.website_url as string)
    if (profile.business_description)
      setValue('businessDescription', profile.business_description as string)
    if (profile.tax_status)
      setValue('taxStatus', JSON.stringify(profile.tax_status))
    if (profile.foreign_owned !== undefined)
      setValue('foreignOwned', profile.foreign_owned as boolean)
    if (profile.parent_company_name)
      setValue('parentCompanyName', profile.parent_company_name as string)
    if (profile.parent_company_orgnr)
      setValue('parentCompanyOrgnr', profile.parent_company_orgnr as string)
    if (profile.fi_regulated !== undefined)
      setValue('fiRegulated', profile.fi_regulated as boolean)
    if (profile.active_status)
      setValue('activeStatus', profile.active_status as string)
    if (profile.ongoing_procedures)
      setValue('ongoingProcedures', JSON.stringify(profile.ongoing_procedures))
    if (profile.registered_date) {
      const d = profile.registered_date
      setValue(
        'registeredDate',
        d instanceof Date ? d.toISOString() : String(d)
      )
    }
    setValue('dataSource', 'bolagsapi')
  }, [data, setValue])

  // Remove badge if user manually edits companyName
  useEffect(() => {
    if (lastAutoFilledName && companyNameValue !== lastAutoFilledName) {
      setShowBadge(false)
    }
  }, [companyNameValue, lastAutoFilledName])

  // Detect deregistered company
  const activeStatus = data?.profile?.active_status as string | undefined
  const isDeregistered = activeStatus === 'deregistered'

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5" noValidate>
      <div>
        <h2 className="font-safiro text-2xl font-semibold tracking-tight">
          Foretagsinformation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fyll i uppgifterna om ditt foretag.
        </p>
      </div>

      <div className="space-y-4">
        {/* Foretagsnamn — required */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="companyName">
              Foretagsnamn <span className="text-destructive">*</span>
            </Label>
            {showBadge && isAutoFilled && (
              <Badge variant="secondary" className="text-xs" role="status">
                Hamtat fran Bolagsverket
              </Badge>
            )}
          </div>
          <Input
            id="companyName"
            placeholder="t.ex. Mitt Foretag AB"
            autoComplete="organization"
            className={
              isAutoFilled && showBadge ? 'transition-opacity duration-300' : ''
            }
            aria-describedby={
              errors.companyName ? 'companyName-error' : undefined
            }
            {...register('companyName')}
          />
          {errors.companyName && (
            <p id="companyName-error" className="text-sm text-destructive">
              {errors.companyName.message}
            </p>
          )}
        </div>

        {/* Organisationsnummer — required */}
        <div className="space-y-2">
          <Label htmlFor="orgNumber">
            Organisationsnummer <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="orgNumber"
              placeholder="XXXXXX-XXXX"
              aria-describedby={
                errors.orgNumber
                  ? 'orgNumber-error'
                  : error === 'not_found'
                    ? 'orgNumber-notfound'
                    : undefined
              }
              {...register('orgNumber')}
            />
            {isLoading && (
              <Loader2
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-label="Soker foretagsinfo"
              />
            )}
          </div>
          {isLoading && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Hamtar foretagsinfo...
            </p>
          )}
          {error === 'not_found' && (
            <p id="orgNumber-notfound" className="text-sm text-destructive">
              Inget foretag hittades med detta organisationsnummer
            </p>
          )}
          {isDeregistered && (
            <p className="text-sm text-amber-600">
              Detta foretag ar avregistrerat hos Bolagsverket
            </p>
          )}
          {errors.orgNumber && (
            <p id="orgNumber-error" className="text-sm text-destructive">
              {errors.orgNumber.message}
            </p>
          )}
        </div>

        {/* Gatuadress — optional */}
        <div className="space-y-2">
          <Label htmlFor="streetAddress">Gatuadress</Label>
          <Input
            id="streetAddress"
            placeholder="t.ex. Storgatan 1"
            autoComplete="street-address"
            className={isAutoFilled ? 'transition-opacity duration-300' : ''}
            {...register('streetAddress')}
          />
        </div>

        {/* Postnummer + Ort — side by side */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postnummer</Label>
            <Input
              id="postalCode"
              placeholder="XXX XX"
              autoComplete="postal-code"
              className={isAutoFilled ? 'transition-opacity duration-300' : ''}
              aria-describedby={
                errors.postalCode ? 'postalCode-error' : undefined
              }
              {...register('postalCode')}
            />
            {errors.postalCode && (
              <p id="postalCode-error" className="text-sm text-destructive">
                {errors.postalCode.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ort</Label>
            <Input
              id="city"
              placeholder="t.ex. Stockholm"
              autoComplete="address-level2"
              className={isAutoFilled ? 'transition-opacity duration-300' : ''}
              {...register('city')}
            />
          </div>
        </div>

        {/* Bransch / SNI-kod — optional */}
        <div className="space-y-2">
          <Label htmlFor="sniCode">Bransch / SNI-kod</Label>
          <Input
            id="sniCode"
            placeholder="t.ex. 62010 Dataprogrammering"
            className={isAutoFilled ? 'transition-opacity duration-300' : ''}
            {...register('sniCode')}
          />
        </div>

        {/* Juridisk form — optional dropdown */}
        <div className="space-y-2">
          <Label htmlFor="legalForm">Juridisk form</Label>
          <Select
            value={legalFormValue || ''}
            onValueChange={(val) =>
              setValue(
                'legalForm',
                val as WorkspaceOnboardingData['legalForm'],
                {
                  shouldValidate: true,
                }
              )
            }
          >
            <SelectTrigger id="legalForm">
              <SelectValue placeholder="Valj juridisk form" />
            </SelectTrigger>
            <SelectContent>
              {LEGAL_FORM_OPTIONS.map((form) => (
                <SelectItem key={form.value} value={form.value}>
                  {form.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Antal anstallda — optional */}
        <div className="space-y-2">
          <Label htmlFor="employeeCount">Antal anstallda</Label>
          <Input
            id="employeeCount"
            type="number"
            min="0"
            placeholder="t.ex. 25"
            {...register('employeeCount')}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
      >
        Nasta
      </Button>
    </form>
  )
}
