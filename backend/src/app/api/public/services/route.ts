import { handleApiError, success } from '@/lib/api-response'
import { listPublicServices } from '@/services/public-booking.service'

// ROTA PÚBLICA (sem login): serviços ativos para a agenda online.
export async function GET() {
  try {
    const res = success(await listPublicServices())
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    return handleApiError(error)
  }
}
