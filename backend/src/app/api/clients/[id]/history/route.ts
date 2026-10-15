import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import * as clientService from '@/services/client.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const history = await clientService.getClientHistory(user.id, id)
    return success(history)
  } catch (error) {
    return handleApiError(error)
  }
}
