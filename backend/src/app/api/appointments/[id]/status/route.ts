import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { changeStatusSchema } from '@/schemas/appointment'
import * as appointmentService from '@/services/appointment.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const { status } = changeStatusSchema.parse(body)
    const appointment = await appointmentService.changeAppointmentStatus(
      user.id,
      id,
      status
    )
    return success(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}
