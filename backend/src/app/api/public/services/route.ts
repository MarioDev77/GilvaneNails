import { handleApiError, success } from '@/lib/api-response'
import { listPublicServices } from '@/services/public-booking.service'

// ROTA PÚBLICA (sem login): serviços ativos para a agenda online.
export async function GET() {
  try {
    return success(await listPublicServices())
  } catch (error) {
    return handleApiError(error)
  }
}
