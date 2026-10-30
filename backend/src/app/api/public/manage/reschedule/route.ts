import { NextRequest } from 'next/server'
import { handleApiError, success, errorResponse } from '@/lib/api-response'
import { getClientIp, rateLimit } from '@/lib/public-booking'
import { manageRescheduleSchema } from '@/schemas/public-booking'
import { rescheduleManagedBooking } from '@/services/public-manage.service'

// ROTA PÚBLICA (sem login): a cliente pede outro horário pelo link assinado.
// O agendamento volta para "Agendado" e aparece em Solicitações até a Gilvane confirmar.
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`manage-write:${getClientIp(req)}`, 10, 60 * 60_000)) {
      return errorResponse('RATE_LIMITED', 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.', 429)
    }
    const { id, t, startsAt } = manageRescheduleSchema.parse(await req.json())
    return success(await rescheduleManagedBooking(id, t, startsAt))
  } catch (error) {
    return handleApiError(error)
  }
}
