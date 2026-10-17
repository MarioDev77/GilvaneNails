import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import * as appointmentService from '@/services/appointment.service'

type Params = { params: Promise<{ id: string }> }

// Desfaz a conclusão (remove atendimento e pagamento, volta para Confirmado).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const appointment = await appointmentService.reopenAppointment(user.id, id)
    return success(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}
