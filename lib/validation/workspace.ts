import { z } from 'zod'

export const LEGAL_FORM_OPTIONS = [
  { value: 'AB', label: 'AB (Aktiebolag)' },
  { value: 'HB', label: 'HB (Handelsbolag)' },
  { value: 'KB', label: 'KB (Kommanditbolag)' },
  { value: 'EF', label: 'EF (Enskild firma)' },
  { value: 'IDEELL', label: 'Ideell förening' },
  { value: 'STIFTELSE', label: 'Stiftelse' },
  { value: 'OVRIGT', label: 'Övrigt' },
] as const

export const LEGAL_FORM_LABELS: Record<string, string> = Object.fromEntries(
  LEGAL_FORM_OPTIONS.map((o) => [o.value, o.label])
)

export const WorkspaceOnboardingSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Företagsnamn krävs')
    .max(100, 'Max 100 tecken'),
  orgNumber: z
    .string()
    .regex(/^\d{6}-?\d{4}$/, 'Ogiltigt format. Ange XXXXXX-XXXX'),
  streetAddress: z.string().optional(),
  postalCode: z
    .string()
    .regex(/^\d{3}\s?\d{2}$/, 'Ogiltigt format. Ange XXX XX')
    .optional()
    .or(z.literal('')),
  city: z.string().optional(),
  sniCode: z.string().optional(),
  legalForm: z
    .enum(['AB', 'HB', 'KB', 'EF', 'IDEELL', 'STIFTELSE', 'OVRIGT'])
    .or(z.literal(''))
    .optional(),
  employeeCount: z
    .string()
    .regex(/^\d+$/, 'Ange ett giltigt antal')
    .optional()
    .or(z.literal('')),
})

export type WorkspaceOnboardingData = z.infer<typeof WorkspaceOnboardingSchema>
