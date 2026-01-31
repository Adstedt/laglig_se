'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  WorkspaceOnboardingSchema,
  LEGAL_FORM_OPTIONS,
  type WorkspaceOnboardingData,
} from '@/lib/validation/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5" noValidate>
      <div>
        <h2 className="font-safiro text-2xl font-semibold tracking-tight">
          Företagsinformation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fyll i uppgifterna om ditt företag.
        </p>
      </div>

      <div className="space-y-4">
        {/* Företagsnamn — required */}
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Företagsnamn <span className="text-destructive">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder="t.ex. Mitt Företag AB"
            autoComplete="organization"
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
          <Input
            id="orgNumber"
            placeholder="XXXXXX-XXXX"
            aria-describedby={errors.orgNumber ? 'orgNumber-error' : undefined}
            {...register('orgNumber')}
          />
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
              <SelectValue placeholder="Välj juridisk form" />
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

        {/* Antal anställda — optional */}
        <div className="space-y-2">
          <Label htmlFor="employeeCount">Antal anställda</Label>
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
        Nästa
      </Button>
    </form>
  )
}
