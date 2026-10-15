import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { payExpenseSchema } from '@/schemas/finance'
import * as financeService from '@/services/finance.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const input = payExpenseSchema.parse(body)
    const expense = await financeService.payExpense(
      user.id,
      id,
      input.paidAt,
      input.paymentMethod
    )
    return success(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
