import { z } from 'zod'
import {
  idSchema,
  moneySchema,
  paymentMethodSchema,
  expenseStatusSchema,
  paginationSchema,
  dateRangeSchema,
} from './common'

export const createExpenseSchema = z.object({
  categoryId: idSchema.optional().nullable(),
  description: z.string().min(2).max(300),
  amountCents: moneySchema.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  incurredAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dueAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  paymentMethod: paymentMethodSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // Despesa já paga no ato do cadastro: entra direto no saldo.
  paidNow: z.boolean().optional(),
})

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  status: expenseStatusSchema.optional(),
})

export const payExpenseSchema = z.object({
  paidAt: z.string().datetime({ offset: true }).optional(),
  paymentMethod: paymentMethodSchema.optional(),
})

export const listExpensesSchema = paginationSchema.merge(dateRangeSchema).extend({
  status: expenseStatusSchema.optional(),
  categoryId: idSchema.optional(),
})

export const financialReportSchema = dateRangeSchema.extend({
  groupBy: z.enum(['day', 'month']).default('day'),
  categoryId: idSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
})

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type ListExpensesInput = z.infer<typeof listExpensesSchema>
export type FinancialReportInput = z.infer<typeof financialReportSchema>
