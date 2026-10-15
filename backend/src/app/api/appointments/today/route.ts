import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import * as appointmentService from '@/services/appointment.service'

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth()
    const appointments = await appointmentService.getTodayAppointments(user.id)
    return success(appointments)
  } catch (error) {
    return handleApiError(error)
  }
}
