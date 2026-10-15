import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, noContent } from '@/lib/api-response'
import { updateClientSchema } from '@/schemas/client'
import * as clientService from '@/services/client.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const client = await clientService.getClientById(user.id, id)
    return success(client)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = updateClientSchema.parse(body)
    const client = await clientService.updateClient(user.id, id, input)
    return success(client)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const client = await clientService.archiveClient(user.id, id)
    return success(client)
  } catch (error) {
    return handleApiError(error)
  }
}
