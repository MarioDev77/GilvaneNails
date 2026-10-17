import { z } from 'zod'
import {
  idSchema,
  moneySchema,
  paymentMethodSchema,
  appointmentStatusSchema,
  paginationSchema,
  dateRangeSchema,
} from './common'

export const createAppointmentSchema = z.object({
  clientId: idSchema.optional(),
  clientName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120).optional(),
  serviceId: idSchema,
  startsAt: z.string().datetime({ offset: true }),
  agreedPriceCents: moneySchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: appointmentStatusSchema.optional().default('SCHEDULED'),
}).refine((d) => d.clientId || d.clientName, {
  message: 'Informe o nome do cliente',
  path: ['clientName'],
})

export const updateAppointmentSchema = z.object({
  clientId: idSchema.optional(),
  clientName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120).optional(),
  serviceId: idSchema.optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  agreedPriceCents: moneySchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: appointmentStatusSchema.optional(),
})

export const changeStatusSchema = z.object({
  status: appointmentStatusSchema,
})

export const completeAppointmentSchema = z.object({
  method: paymentMethodSchema,
  amountCents: moneySchema.optional(),
})

export const completeDaySchema = z.object({
  items: z
    .array(
      z.object({
        id: idSchema,
        method: paymentMethodSchema,
        amountCents: moneySchema.optional(),
      })
    )
    .min(1, 'Selecione ao menos um atendimento')
    .max(100),
})

export const listAppointmentsSchema = paginationSchema.merge(dateRangeSchema).extend({
  clientId: idSchema.optional(),
  serviceId: idSchema.optional(),
  status: appointmentStatusSchema.optional(),
  upcoming: z.coerce.boolean().optional(),
})

export type CompleteAppointmentBody = z.infer<typeof completeAppointmentSchema>
export type CompleteDayBody = z.infer<typeof completeDaySchema>
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>
