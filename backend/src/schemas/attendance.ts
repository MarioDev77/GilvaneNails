import { z } from 'zod'
import {
  idSchema,
  moneySchema,
  paymentMethodSchema,
  paginationSchema,
  dateRangeSchema,
} from './common'

export const createAttendanceSchema = z.object({
  appointmentId: idSchema.optional().nullable(),
  clientId: idSchema,
  serviceId: idSchema.optional().nullable(),
  performedAt: z.string().datetime({ offset: true }).optional(),
  priceCents: moneySchema,
  discountCents: moneySchema.default(0),
  notes: z.string().max(2000).optional().nullable(),
  // Se informado, já lança o recebimento (preço - desconto) no saldo.
  paymentMethod: paymentMethodSchema.optional(),
})

export const updateAttendanceSchema = z.object({
  priceCents: moneySchema.optional(),
  discountCents: moneySchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  performedAt: z.string().datetime({ offset: true }).optional(),
})

export const createPaymentSchema = z.object({
  amountCents: moneySchema.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  paidAt: z.string().datetime({ offset: true }).optional(),
  method: paymentMethodSchema,
  description: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128).optional(),
})

export const listAttendancesSchema = paginationSchema.merge(dateRangeSchema).extend({
  clientId: idSchema.optional(),
  serviceId: idSchema.optional(),
})

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type ListAttendancesInput = z.infer<typeof listAttendancesSchema>
