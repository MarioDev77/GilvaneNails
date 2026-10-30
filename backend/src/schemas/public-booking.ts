import { z } from 'zod'
import { idSchema } from './common'

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  serviceId: idSchema,
})

const publicPhoneSchema = z
  .string()
  .max(25, 'Telefone inválido')
  .transform((v) => v.replace(/\D/g, ''))
  .transform((v) => (v.length > 11 && v.startsWith('55') ? v.slice(2) : v))
  .refine((v) => v.length === 10 || v.length === 11, 'Informe um telefone com DDD')

export const createPublicBookingSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
  phone: publicPhoneSchema,
  serviceId: idSchema,
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).optional(),
  // Campo isca (honeypot): pessoas não preenchem, robôs sim.
  website: z.string().max(200).optional(),
})

// Remarcar / cancelar pelo link: id do agendamento + token assinado (ver lib/manage-token.ts)
const manageToken = z.string().trim().min(16, 'Link inválido').max(64, 'Link inválido')

export const manageQuerySchema = z.object({ id: idSchema, t: manageToken })

export const manageSlotsQuerySchema = manageQuerySchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
})

export const manageCancelSchema = z.object({ id: idSchema, t: manageToken })

export const manageRescheduleSchema = z.object({
  id: idSchema,
  t: manageToken,
  startsAt: z.string().datetime({ offset: true }),
})

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>
export type CreatePublicBookingInput = z.infer<typeof createPublicBookingSchema>
export type ManageRescheduleInput = z.infer<typeof manageRescheduleSchema>
