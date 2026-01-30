import { z } from 'zod'

export const PasswordSchema = z
  .string()
  .min(12, 'Lösenordet måste vara minst 12 tecken')
  .regex(/[A-Z]/, 'Måste innehålla minst en versal')
  .regex(/[a-z]/, 'Måste innehålla minst en gemen')
  .regex(/[0-9]/, 'Måste innehålla minst en siffra')
  .regex(/[^A-Za-z0-9]/, 'Måste innehålla minst ett specialtecken')

export const SignupSchema = z
  .object({
    email: z.string().email('Ogiltig e-postadress'),
    password: PasswordSchema,
    confirmPassword: z.string(),
    name: z.string().min(2, 'Namnet måste vara minst 2 tecken'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Lösenorden matchar inte',
    path: ['confirmPassword'],
  })

export const LoginSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  password: z.string().min(1, 'Lösenord krävs'),
})

export const ResetPasswordSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
})

export const ConfirmPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Lösenorden matchar inte',
    path: ['confirmPassword'],
  })
