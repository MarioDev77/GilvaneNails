import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { updateAppointmentSchema } from '@/schemas/appointment'
import * as appointmentService from '@/services/appointment.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const appointment = await appointmentService.getAppointmentById(user.id, id)
    return success(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = updateAppointmentSchema.parse(body)
    const appointment = await appointmentService.updateAppointment(user.id, id, input)
    return success(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const appointment = await appointmentService.cancelAppointment(user.id, id)
    return success(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}
