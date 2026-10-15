import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import * as financeService from '@/services/finance.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const expense = await financeService.cancelExpense(user.id, id)
    return success(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
