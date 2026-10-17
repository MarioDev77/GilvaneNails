import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { completeAppointmentSchema } from '@/schemas/appointment'
import * as appointmentService from '@/services/appointment.service'

type Params = { params: Promise<{ id: string }> }

// Conclui o atendimento e lança o valor no saldo.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = completeAppointmentSchema.parse(body)
    const appointment = await appointmentService.completeAppointment(user.id, id, input)
    return success(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}
