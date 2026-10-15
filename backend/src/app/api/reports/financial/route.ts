import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { financialReportSchema } from '@/schemas/finance'
import * as financeService from '@/services/finance.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const params = financialReportSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const report = await financeService.getFinancialReport(user.id, params)
    return success(report)
  } catch (error) {
    return handleApiError(error)
  }
}
