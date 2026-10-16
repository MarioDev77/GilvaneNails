import { z } from 'zod'
import { phoneSchema, paginationSchema } from './common'

export const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120),
  phone: phoneSchema.optional(),
  birthday: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const updateClientSchema = createClientSchema.partial()

export const listClientsSchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  includeArchived: z.coerce.boolean().default(false),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ListClientsInput = z.infer<typeof listClientsSchema>
