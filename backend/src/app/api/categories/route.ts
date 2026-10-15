import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createCategorySchema } from '@/schemas/finance'
import * as financeService from '@/services/finance.service'

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth()
    const categories = await financeService.listCategories(user.id)
    return success(categories)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { name } = createCategorySchema.parse(body)
    const category = await financeService.createCategory(user.id, name)
    return created(category)
  } catch (error) {
    return handleApiError(error)
  }
}
