import { NextRequest } from 'next/server'
import { handleApiError, success, errorResponse } from '@/lib/api-response'
import { getClientIp, rateLimit } from '@/lib/public-booking'
import { manageQuerySchema } from '@/schemas/public-booking'
import { getManagedBooking } from '@/services/public-manage.service'

// ROTA PÚBLICA (sem login): dados do agendamento da própria cliente, acessado pelo link assinado.
export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(`manage:${getClientIp(req)}`, 60, 60_000)) {
      return errorResponse('RATE_LIMITED', 'Muitas consultas. Aguarde um instante.', 429)
    }
    const { id, t } = manageQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const res = success(await getManagedBooking(id, t))
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    return handleApiError(error)
  }
}
