import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { updateExpenseSchema } from '@/schemas/finance'
import * as financeService from '@/services/finance.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const expense = await financeService.getExpenseById(user.id, id)
    return success(expense)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = updateExpenseSchema.parse(body)
    const expense = await financeService.updateExpense(user.id, id, input)
    return success(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
