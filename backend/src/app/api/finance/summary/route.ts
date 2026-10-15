import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import * as financeService from '@/services/finance.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const startDate = req.nextUrl.searchParams.get('startDate') ?? undefined
    const endDate = req.nextUrl.searchParams.get('endDate') ?? undefined
    const summary = await financeService.getFinancialSummary(
      user.id,
      startDate,
      endDate
    )
    return success(summary)
  } catch (error) {
    return handleApiError(error)
  }
}
