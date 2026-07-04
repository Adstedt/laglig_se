'use client'

/**
 * Story 7.3: Personalkort tabbed form — Personalinformation / Anställning
 * (compliance subset; no Skatt/ATK/Ingående Saldo). Semester is a section on
 * the Anställning tab — a one-field tab collapsed the modal (user checkpoint).
 *
 * react-hook-form + zodResolver over the co-located schema (form-schema.ts).
 * Only förnamn + efternamn block save; personnummer is validated inline when
 * present (format + Luhn). Save goes through the Story 7.3 server actions and
 * lifts the returned sanitized row via `onSaved` for the register's
 * optimistic update.
 *
 * Read-only mode (`employees:view` without manage): every control disabled,
 * save hidden — the server action remains the real permission boundary.
 */

import { useCallback, useState } from 'react'
import { useForm, Controller, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  createEmployee,
  updateEmployee,
  type CollectiveAgreementOption,
} from '@/app/actions/employees'
import { KollektivavtalUploadDialog } from '@/components/features/kollektivavtal/kollektivavtal-upload-dialog'
import type { EmploymentForm, PersonelType, SalaryForm } from '@prisma/client'
import {
  EMPLOYMENT_FORM_LABELS,
  PERSONEL_TYPE_LABELS,
  SALARY_FORM_LABELS,
} from '../labels'
import type { EmployeeRow } from '../employee-row'
import {
  personalkortFormSchema,
  emptyFormValues,
  formValuesFromRow,
  toEmployeeInput,
  NONE_VALUE,
  type PersonalkortFormValues,
} from './form-schema'
import { EmployeeStatusBadge } from './status-badge'

// User-checkpoint change: the Semester tab collapsed the modal (single field),
// so semester lives as a section on the Anställning tab instead.
type PersonalkortTab = 'personalinformation' | 'anstallning'

/** Which tab each field lives on — used to jump to the first invalid tab. */
const ANSTALLNING_FIELDS: (keyof PersonalkortFormValues)[] = [
  'employment_date',
  'employed_to',
  'employment_form',
  'personel_type',
  'salary_form',
  'monthly_salary',
  'hourly_pay',
  'employment_percent',
  'average_weekly_hours',
  'manager_id',
  'collective_agreement_id',
  'inactive',
  'vacation_days_paid', // Semester section on the Anställning tab
]

interface PersonalkortFormProps {
  mode: 'create' | 'edit'
  /** Register row for edit prefill (null in create mode). */
  row: EmployeeRow | null
  /** All register rows — source for the manager select (active, non-self). */
  employees: EmployeeRow[]
  /** Workspace kollektivavtal; null while loading. */
  agreements: CollectiveAgreementOption[] | null
  /**
   * True when the agreements fetch FAILED (QA UX-001) — renders a muted
   * error hint instead of the empty-state upload placeholder, so a transient
   * error never masquerades as "no agreements exist".
   */
  agreementsFailed: boolean
  readOnly: boolean
  /**
   * Story 7.5: called after a kollektivavtal was uploaded via the empty-state
   * affordance — the modal refetches its agreements list so the new agreement
   * is immediately selectable.
   */
  onAgreementUploaded?: (() => void) | undefined
  onSaved: (_row: EmployeeRow, _mode: 'created' | 'updated') => void
  onClose: () => void
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

export function PersonalkortForm({
  mode,
  row,
  employees,
  agreements,
  agreementsFailed,
  readOnly,
  onAgreementUploaded,
  onSaved,
  onClose,
}: PersonalkortFormProps) {
  const [activeTab, setActiveTab] = useState<PersonalkortTab>(
    'personalinformation'
  )
  // Story 7.5: the real upload flow behind the (former "kommer snart")
  // empty-state affordance — a small dialog wrapping the shared upload form.
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PersonalkortFormValues>({
    resolver: zodResolver(personalkortFormSchema),
    defaultValues: row ? formValuesFromRow(row) : emptyFormValues(),
  })

  const employmentForm = watch('employment_form')
  const personelType = watch('personel_type')
  const salaryForm = watch('salary_form')
  const managerId = watch('manager_id')
  const agreementId = watch('collective_agreement_id')
  const inactive = watch('inactive')

  // Manager options: active employees, self excluded (no self-management).
  // The currently assigned manager stays listed even if inactive so the
  // stored value renders (deviation-safe display; saving keeps it).
  const managerOptions = employees.filter(
    (e) => (e.id !== row?.id && !e.inactive) || e.id === managerId
  )

  // QA DATA-001: a masked prefill (view role, or an undecryptable ciphertext
  // under manage) starts the field empty — an untouched/empty submit must
  // KEEP the stored value, never clear it. Typing a value replaces it.
  const personnummerMasked =
    mode === 'edit' && row?.personnummer_masked === true

  // Story 7.10: same masked-prefill three-state for salary — an empty submit
  // on a masked (view or undecryptable-manage) prefill keeps the stored value.
  const salaryMasked = mode === 'edit' && row?.salary_masked === true

  const onSubmit = useCallback(
    async (values: PersonalkortFormValues) => {
      if (mode === 'edit' && !row) return
      try {
        const input = toEmployeeInput(values, row?.group_id ?? null, {
          personnummerMasked,
          salaryMasked,
        })
        const result =
          mode === 'create' || !row
            ? await createEmployee(input)
            : await updateEmployee(row.id, input)

        if (result.success && result.data) {
          toast.success(
            mode === 'create' ? 'Anställd tillagd.' : 'Ändringarna sparades.'
          )
          onSaved(result.data, mode === 'create' ? 'created' : 'updated')
          onClose()
        } else {
          toast.error(result.error ?? 'Kunde inte spara. Försök igen.')
        }
      } catch {
        toast.error('Något gick fel. Försök igen.')
      }
    },
    [mode, row, personnummerMasked, salaryMasked, onSaved, onClose]
  )

  // Jump to the first tab containing a validation error (errors on a hidden
  // tab would otherwise be invisible).
  const onInvalid = useCallback((formErrors: FieldErrors) => {
    const keys = Object.keys(formErrors) as (keyof PersonalkortFormValues)[]
    // Personalinformation wins if it has any error; otherwise Anställning.
    if (keys.some((k) => !ANSTALLNING_FIELDS.includes(k))) {
      setActiveTab('personalinformation')
      return
    }
    setActiveTab('anstallning')
  }, [])

  const selectValueOrNone = (value: string) =>
    value === '' ? NONE_VALUE : value

  const title =
    mode === 'create'
      ? 'Ny anställd'
      : row
        ? `${row.first_name} ${row.last_name}`.trim()
        : 'Anställd'

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="flex h-full flex-col"
      noValidate
    >
      {/* DESIGN-004/005: fields scroll inside the panel (with the law-modal
          overflow guards); the action footer below sits OUTSIDE the scroll
          region so Spara/Avbryt never scroll out of view. */}
      <ScrollArea className="h-full min-w-0 flex-1 [&>div>div]:!block [&>div>div]:!min-w-0">
        <div className="p-6">
          {/* DESIGN-002: entity header, mirroring the law modal's law-header —
              Safiro Medium only (weight 500; font-semibold would faux-bold). */}
          <div className="mb-6 space-y-3">
            <h2 className="font-safiro text-xl font-medium leading-tight tracking-[-0.01em]">
              {title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <EmployeeStatusBadge inactive={inactive} />
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as PersonalkortTab)}
            className="w-full"
          >
            <TabsList className="w-full justify-start overflow-x-auto flex gap-1 h-auto p-1 bg-muted/60">
              <TabsTrigger
                value="personalinformation"
                className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
              >
                Personalinformation
              </TabsTrigger>
              <TabsTrigger
                value="anstallning"
                className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
              >
                Anställning
              </TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------------------- */}
            {/* Personalinformation                                            */}
            {/* ------------------------------------------------------------- */}
            <TabsContent
              value="personalinformation"
              className="mt-4 min-h-[45vh] space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-first-name">Förnamn *</Label>
                  <Input
                    id="pk-first-name"
                    {...register('first_name')}
                    disabled={readOnly}
                    aria-invalid={!!errors.first_name}
                  />
                  <FieldError message={errors.first_name?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-last-name">Efternamn *</Label>
                  <Input
                    id="pk-last-name"
                    {...register('last_name')}
                    disabled={readOnly}
                    aria-invalid={!!errors.last_name}
                  />
                  <FieldError message={errors.last_name?.message} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-personnummer">Personnummer</Label>
                  <Input
                    id="pk-personnummer"
                    placeholder="ÅÅMMDD-XXXX"
                    {...register('personnummer')}
                    disabled={readOnly}
                    aria-invalid={!!errors.personnummer}
                  />
                  <FieldError message={errors.personnummer?.message} />
                  {personnummerMasked && !readOnly && (
                    <p className="text-sm text-muted-foreground">
                      Befintligt personnummer behålls om fältet lämnas tomt.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-employee-id-ref">Anställnings-ID</Label>
                  <Input
                    id="pk-employee-id-ref"
                    {...register('employee_id_ref')}
                    disabled={readOnly}
                    aria-invalid={!!errors.employee_id_ref}
                  />
                  <FieldError message={errors.employee_id_ref?.message} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pk-email">E-post</Label>
                <Input
                  id="pk-email"
                  type="email"
                  {...register('email')}
                  disabled={readOnly}
                  aria-invalid={!!errors.email}
                />
                <FieldError message={errors.email?.message} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-phone1">Telefon 1</Label>
                  <Input
                    id="pk-phone1"
                    {...register('phone1')}
                    disabled={readOnly}
                  />
                  <FieldError message={errors.phone1?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-phone2">Telefon 2</Label>
                  <Input
                    id="pk-phone2"
                    {...register('phone2')}
                    disabled={readOnly}
                  />
                  <FieldError message={errors.phone2?.message} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pk-address1">Adress 1</Label>
                <Input
                  id="pk-address1"
                  {...register('address1')}
                  disabled={readOnly}
                />
                <FieldError message={errors.address1?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pk-address2">Adress 2</Label>
                <Input
                  id="pk-address2"
                  {...register('address2')}
                  disabled={readOnly}
                />
                <FieldError message={errors.address2?.message} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-post-code">Postnummer</Label>
                  <Input
                    id="pk-post-code"
                    {...register('post_code')}
                    disabled={readOnly}
                  />
                  <FieldError message={errors.post_code?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-city">Ort</Label>
                  <Input
                    id="pk-city"
                    {...register('city')}
                    disabled={readOnly}
                  />
                  <FieldError message={errors.city?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-country">Land</Label>
                  <Input
                    id="pk-country"
                    {...register('country')}
                    disabled={readOnly}
                  />
                  <FieldError message={errors.country?.message} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pk-job-title">Befattning</Label>
                <Input
                  id="pk-job-title"
                  maxLength={30}
                  {...register('job_title')}
                  disabled={readOnly}
                  aria-invalid={!!errors.job_title}
                />
                <FieldError message={errors.job_title?.message} />
              </div>
            </TabsContent>

            {/* ------------------------------------------------------------- */}
            {/* Anställning                                                    */}
            {/* ------------------------------------------------------------- */}
            <TabsContent
              value="anstallning"
              className="mt-4 min-h-[45vh] space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-employment-date">Anställningsdatum</Label>
                  <Controller
                    control={control}
                    name="employment_date"
                    render={({ field }) => (
                      <DatePicker
                        id="pk-employment-date"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={readOnly}
                      />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-employed-to">Slutdatum</Label>
                  <Controller
                    control={control}
                    name="employed_to"
                    render={({ field }) => (
                      <DatePicker
                        id="pk-employed-to"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={readOnly}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-employment-form">Anställningsform</Label>
                  <Select
                    value={selectValueOrNone(employmentForm)}
                    onValueChange={(v) =>
                      setValue(
                        'employment_form',
                        v === NONE_VALUE ? '' : (v as EmploymentForm),
                        { shouldDirty: true }
                      )
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger id="pk-employment-form">
                      <SelectValue placeholder="Ej ifylld" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Ej ifylld</SelectItem>
                      {Object.entries(EMPLOYMENT_FORM_LABELS).map(
                        ([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-personel-type">Personaltyp</Label>
                  <Select
                    value={selectValueOrNone(personelType)}
                    onValueChange={(v) =>
                      setValue(
                        'personel_type',
                        v === NONE_VALUE ? '' : (v as PersonelType),
                        { shouldDirty: true }
                      )
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger id="pk-personel-type">
                      <SelectValue placeholder="Ej ifylld" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Ej ifylld</SelectItem>
                      {Object.entries(PERSONEL_TYPE_LABELS).map(
                        ([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-salary-form">Löneform</Label>
                  <Select
                    value={selectValueOrNone(salaryForm)}
                    onValueChange={(v) =>
                      setValue(
                        'salary_form',
                        v === NONE_VALUE ? '' : (v as SalaryForm),
                        { shouldDirty: true }
                      )
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger id="pk-salary-form">
                      <SelectValue placeholder="Ej ifylld" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Ej ifylld</SelectItem>
                      {Object.entries(SALARY_FORM_LABELS).map(
                        ([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-employment-percent">
                    Sysselsättningsgrad (%)
                  </Label>
                  <Input
                    id="pk-employment-percent"
                    inputMode="decimal"
                    placeholder="100"
                    {...register('employment_percent')}
                    disabled={readOnly}
                    aria-invalid={!!errors.employment_percent}
                  />
                  <FieldError message={errors.employment_percent?.message} />
                </div>
              </div>

              {/* Story 7.10: salary amount, shown by the chosen Löneform
                  (MAN → Månadslön, TIM → Timlön; both hidden until a form is
                  picked). Encrypted at rest, manage-only — read-only + masked
                  helper text for view roles / undecryptable ciphertext. */}
              {salaryForm === 'MAN' || salaryForm === 'TIM' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {salaryForm === 'MAN' ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="pk-monthly-salary">Månadslön</Label>
                      <div className="relative">
                        <Input
                          id="pk-monthly-salary"
                          inputMode="decimal"
                          placeholder="45 000"
                          className="pr-10"
                          {...register('monthly_salary')}
                          disabled={readOnly}
                          aria-invalid={!!errors.monthly_salary}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          kr
                        </span>
                      </div>
                      <FieldError message={errors.monthly_salary?.message} />
                      {salaryMasked && !readOnly && (
                        <p className="text-sm text-muted-foreground">
                          Befintlig lön behålls om fältet lämnas tomt.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="pk-hourly-pay">Timlön</Label>
                      <div className="relative">
                        <Input
                          id="pk-hourly-pay"
                          inputMode="decimal"
                          placeholder="185,50"
                          className="pr-14"
                          {...register('hourly_pay')}
                          disabled={readOnly}
                          aria-invalid={!!errors.hourly_pay}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          kr/tim
                        </span>
                      </div>
                      <FieldError message={errors.hourly_pay?.message} />
                      {salaryMasked && !readOnly && (
                        <p className="text-sm text-muted-foreground">
                          Befintlig lön behålls om fältet lämnas tomt.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pk-average-weekly-hours">
                    Veckoarbetstid (timmar)
                  </Label>
                  <Input
                    id="pk-average-weekly-hours"
                    inputMode="decimal"
                    placeholder="40"
                    {...register('average_weekly_hours')}
                    disabled={readOnly}
                    aria-invalid={!!errors.average_weekly_hours}
                  />
                  <FieldError message={errors.average_weekly_hours?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pk-manager">Chef</Label>
                  <Select
                    value={selectValueOrNone(managerId)}
                    onValueChange={(v) =>
                      setValue('manager_id', v === NONE_VALUE ? '' : v, {
                        shouldDirty: true,
                      })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger id="pk-manager">
                      <SelectValue placeholder="Ingen chef" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Ingen chef</SelectItem>
                      {managerOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.first_name} {employee.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pk-collective-agreement">Kollektivavtal</Label>
                {agreementsFailed ? (
                  // QA UX-001: a FAILED fetch is not an empty state — keep the
                  // select (disabled, current assignment still readable) and say
                  // that loading failed instead of implying no agreements exist.
                  <>
                    <Select value={selectValueOrNone(agreementId)} disabled>
                      <SelectTrigger id="pk-collective-agreement">
                        <SelectValue placeholder="Inget avtal" />
                      </SelectTrigger>
                      <SelectContent>
                        {row?.collective_agreement && (
                          <SelectItem value={row.collective_agreement.id}>
                            {row.collective_agreement.name}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Kollektivavtal kunde inte laddas.
                    </p>
                  </>
                ) : agreements !== null && agreements.length === 0 ? (
                  // Story 7.5: real upload flow (shared form in a small
                  // dialog). Upload is gated employees:manage server-side;
                  // view-only roles get a plain empty-state text instead.
                  readOnly ? (
                    <p className="text-sm text-muted-foreground">
                      Inga kollektivavtal har laddats upp.
                    </p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setUploadDialogOpen(true)}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Ladda upp kollektivavtal
                      </Button>
                      <KollektivavtalUploadDialog
                        open={uploadDialogOpen}
                        onOpenChange={setUploadDialogOpen}
                        onUploaded={() => {
                          // Refetch so the new agreement is immediately
                          // selectable in this select.
                          onAgreementUploaded?.()
                        }}
                      />
                    </>
                  )
                ) : (
                  <Select
                    value={selectValueOrNone(agreementId)}
                    onValueChange={(v) =>
                      setValue(
                        'collective_agreement_id',
                        v === NONE_VALUE ? '' : v,
                        {
                          shouldDirty: true,
                        }
                      )
                    }
                    disabled={readOnly || agreements === null}
                  >
                    <SelectTrigger id="pk-collective-agreement">
                      <SelectValue
                        placeholder={
                          agreements === null ? 'Laddar…' : 'Inget avtal'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Inget avtal</SelectItem>
                      {(agreements ?? []).map((agreement) => (
                        <SelectItem key={agreement.id} value={agreement.id}>
                          {agreement.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <Label htmlFor="pk-active">Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {inactive ? 'Inaktiv' : 'Aktiv'}
                  </p>
                </div>
                <Switch
                  id="pk-active"
                  checked={!inactive}
                  onCheckedChange={(checked) =>
                    setValue('inactive', !checked, { shouldDirty: true })
                  }
                  disabled={readOnly}
                  aria-label="Aktiv"
                />
              </div>

              {/* Semester — section, not a tab: a single field collapsed the
                  modal height (user checkpoint). Safiro Medium section label. */}
              <div className="mt-2 border-t pt-4">
                <h3 className="font-safiro mb-3 text-sm font-medium">
                  Semester
                </h3>
                <div className="space-y-1.5 sm:max-w-[50%]">
                  <Label htmlFor="pk-vacation-days-paid">
                    Betalda semesterdagar
                  </Label>
                  <Input
                    id="pk-vacation-days-paid"
                    inputMode="decimal"
                    placeholder="25"
                    {...register('vacation_days_paid')}
                    disabled={readOnly}
                    aria-invalid={!!errors.vacation_days_paid}
                  />
                  <FieldError message={errors.vacation_days_paid?.message} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {!readOnly && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Lägg till anställd' : 'Spara ändringar'}
          </Button>
        </div>
      )}
    </form>
  )
}
