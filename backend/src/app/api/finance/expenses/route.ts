import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createExpenseSchema, listExpensesSchema } from '@/schemas/finance'
import * as financeService from '@/services/finance.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const params = listExpensesSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const result = await financeService.listExpenses(user.id, params)
    return success(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const input = createExpenseSchema.parse(body)
    const expense = await financeService.createExpense(user.id, input)
    return created(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
