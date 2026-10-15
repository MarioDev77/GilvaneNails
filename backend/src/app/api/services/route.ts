import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createServiceSchema, listServicesSchema } from '@/schemas/service'
import * as serviceService from '@/services/service.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const params = listServicesSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const result = await serviceService.listServices(user.id, params)
    return success(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const input = createServiceSchema.parse(body)
    const service = await serviceService.createService(user.id, input)
    return created(service)
  } catch (error) {
    return handleApiError(error)
  }
}
