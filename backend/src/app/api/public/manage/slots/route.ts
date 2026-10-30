import { NextRequest } from 'next/server'
import { handleApiError, success, errorResponse } from '@/lib/api-response'
import { getClientIp, rateLimit } from '@/lib/public-booking'
import { manageSlotsQuerySchema } from '@/schemas/public-booking'
import { getManagedSlots } from '@/services/public-manage.service'

// ROTA PÚBLICA (sem login): horários livres para remarcar (o próprio horário da cliente não conta como ocupado).
export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(`manage-slots:${getClientIp(req)}`, 60, 60_000)) {
      return errorResponse('RATE_LIMITED', 'Muitas consultas. Aguarde um instante.', 429)
    }
    const { id, t, date } = manageSlotsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const res = success(await getManagedSlots(id, t, date))
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    return handleApiError(error)
  }
}
