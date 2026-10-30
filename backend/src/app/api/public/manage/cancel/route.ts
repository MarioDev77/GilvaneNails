import { NextRequest } from 'next/server'
import { handleApiError, success, errorResponse } from '@/lib/api-response'
import { getClientIp, rateLimit } from '@/lib/public-booking'
import { manageCancelSchema } from '@/schemas/public-booking'
import { cancelManagedBooking } from '@/services/public-manage.service'

// ROTA PÚBLICA (sem login): a cliente cancela o próprio horário pelo link assinado.
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`manage-write:${getClientIp(req)}`, 10, 60 * 60_000)) {
      return errorResponse('RATE_LIMITED', 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.', 429)
    }
    const { id, t } = manageCancelSchema.parse(await req.json())
    return success(await cancelManagedBooking(id, t))
  } catch (error) {
    return handleApiError(error)
  }
}
