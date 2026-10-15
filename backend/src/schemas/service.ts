import { z } from 'zod'
import { moneySchema, paginationSchema } from './common'

export const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  priceCents: moneySchema,
  durationMinutes: z.number().int().min(5).max(480),
  isActive: z.boolean().default(true),
})

export const updateServiceSchema = createServiceSchema.partial()

export const listServicesSchema = paginationSchema.extend({
  activeOnly: z.coerce.boolean().default(false),
  search: z.string().max(100).optional(),
})

export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
export type ListServicesInput = z.infer<typeof listServicesSchema>
