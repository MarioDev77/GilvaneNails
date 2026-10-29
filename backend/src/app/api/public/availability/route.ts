import { NextRequest } from 'next/server'
import { handleApiError, success, errorResponse } from '@/lib/api-response'
import { getClientIp, rateLimit } from '@/lib/public-booking'
import { availabilityQuerySchema } from '@/schemas/public-booking'
import { getAvailability } from '@/services/public-booking.service'

// ROTA PÚBLICA (sem login): horários livres de um dia para um serviço.
export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(`availability:${getClientIp(req)}`, 60, 60_000)) {
      return errorResponse('RATE_LIMITED', 'Muitas consultas. Aguarde um instante.', 429)
    }
    const query = availabilityQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const res = success(await getAvailability(query))
    // Horários livres mudam a cada pedido: nunca guardar em cache (celular/CDN)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    return handleApiError(error)
  }
}
