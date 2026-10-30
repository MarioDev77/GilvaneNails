import { NextRequest } from 'next/server'
import { handleApiError, created, errorResponse } from '@/lib/api-response'
import { getClientIp, getPublicOwnerId, rateLimit } from '@/lib/public-booking'
import { persistentRateLimit } from '@/lib/rate-limit-db'
import { createPublicBookingSchema } from '@/schemas/public-booking'
import { createPublicBooking } from '@/services/public-booking.service'

// ROTA PÚBLICA (sem login): o cliente envia o pedido de horário.
// O pedido entra como agendamento "Agendado" e aparece em "Solicitações" no painel.
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`booking:${getClientIp(req)}`, 5, 60 * 60_000)) {
      return errorResponse(
        'RATE_LIMITED',
        'Muitas solicitações em pouco tempo. Tente novamente mais tarde.',
        429
      )
    }

    const input = createPublicBookingSchema.parse(await req.json())

    // Honeypot: se o campo escondido veio preenchido, finge sucesso e não salva nada.
    if (input.website) {
      return created({ startsAt: input.startsAt, endsAt: input.startsAt, service: { name: '' } })
    }

    // Segundo limite, guardado no banco: não zera quando o servidor reinicia no deploy.
    if (!(await persistentRateLimit(await getPublicOwnerId(), 'booking', getClientIp(req), 5, 60 * 60_000))) {
      return errorResponse('RATE_LIMITED', 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.', 429)
    }

    return created(await createPublicBooking(input))
  } catch (error) {
    return handleApiError(error)
  }
}
