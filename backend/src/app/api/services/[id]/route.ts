import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { updateServiceSchema } from '@/schemas/service'
import * as serviceService from '@/services/service.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const service = await serviceService.getServiceById(user.id, id)
    return success(service)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = updateServiceSchema.parse(body)
    const service = await serviceService.updateService(user.id, id, input)
    return success(service)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const service = await serviceService.deactivateService(user.id, id)
    return success(service)
  } catch (error) {
    return handleApiError(error)
  }
}
