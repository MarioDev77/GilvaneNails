import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createAppointmentSchema, listAppointmentsSchema } from '@/schemas/appointment'
import * as appointmentService from '@/services/appointment.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const params = listAppointmentsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const result = await appointmentService.listAppointments(user.id, params)
    return success(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const input = createAppointmentSchema.parse(body)
    const appointment = await appointmentService.createAppointment(user.id, input)
    return created(appointment)
  } catch (error) {
    return handleApiError(error)
  }
}
