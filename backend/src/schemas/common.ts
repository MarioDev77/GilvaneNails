import { z } from 'zod'

/** Boolean vindo de querystring: "false"/"0" => false (z.coerce.boolean() trata "false" como true!). */
export const queryBoolean = z.preprocess((v) => {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(s)) return true
    if (['false', '0', 'no', 'off', ''].includes(s)) return false
  }
  return v
}, z.boolean())

export const idSchema = z.string().cuid({ message: 'ID inválido' })

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const dateRangeSchema = z.object({
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})

export const moneySchema = z.number().int().min(0, 'Valor não pode ser negativo')

export const phoneSchema = z
  .string()
  .min(8, 'Telefone muito curto')
  .max(20, 'Telefone muito longo')
  .regex(/^[\d\s()+-]+$/, 'Telefone inválido')

export const appointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
])

export const paymentMethodSchema = z.enum([
  'CASH',
  'PIX',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'OTHER',
])

export const expenseStatusSchema = z.enum(['PENDING', 'PAID', 'CANCELLED'])
