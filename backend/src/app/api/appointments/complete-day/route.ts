import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { completeDaySchema } from '@/schemas/appointment'
import * as appointmentService from '@/services/appointment.service'

// "Fechar o dia": conclui vários agendamentos de uma vez.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { items } = completeDaySchema.parse(body)
    const result = await appointmentService.completeAppointments(user.id, items)
    return success(result)
  } catch (error) {
    return handleApiError(error)
  }
}
