import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { listBookingRequests } from '@/services/booking-request.service'

// ROTA DO PAINEL (privada): lista as solicitações online pendentes.
// Para confirmar/recusar use PATCH /api/appointments/:id/status (CONFIRMED / CANCELLED).
export async function GET() {
  try {
    const user = await requireAuth()
    return success(await listBookingRequests(user.id))
  } catch (error) {
    return handleApiError(error)
  }
}
