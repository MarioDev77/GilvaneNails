import { z } from 'zod'

export const updateSettingsSchema = z.object({
  businessName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres').max(100),
})
