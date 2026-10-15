import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import * as financeService from '@/services/finance.service'

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth()
    const dashboard = await financeService.getDashboard(user.id)
    return success(dashboard)
  } catch (error) {
    return handleApiError(error)
  }
}
