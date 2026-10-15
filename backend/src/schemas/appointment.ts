import { z } from 'zod'
import {
  idSchema,
  moneySchema,
  appointmentStatusSchema,
  paginationSchema,
  dateRangeSchema,
  queryBoolean,
} from './common'

export const createAppointmentSchema = z.object({
  clientId: idSchema,
  serviceId: idSchema,
  startsAt: z.string().datetime({ offset: true }),
  agreedPriceCents: moneySchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: appointmentStatusSchema.optional().default('SCHEDULED'),
})

export const updateAppointmentSchema = z.object({
  clientId: idSchema.optional(),
  serviceId: idSchema.optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  agreedPriceCents: moneySchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: appointmentStatusSchema.optional(),
})

export const changeStatusSchema = z.object({
  status: appointmentStatusSchema,
})

export const listAppointmentsSchema = paginationSchema.merge(dateRangeSchema).extend({
  clientId: idSchema.optional(),
  serviceId: idSchema.optional(),
  status: appointmentStatusSchema.optional(),
  upcoming: queryBoolean.optional(),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>
