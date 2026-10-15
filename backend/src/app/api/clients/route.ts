import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createClientSchema, listClientsSchema } from '@/schemas/client'
import * as clientService from '@/services/client.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const params = listClientsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const result = await clientService.listClients(user.id, params)
    return success(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const input = createClientSchema.parse(body)
    const client = await clientService.createClient(user.id, input)
    return created(client)
  } catch (error) {
    return handleApiError(error)
  }
}
