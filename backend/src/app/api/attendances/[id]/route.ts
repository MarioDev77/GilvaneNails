import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success } from '@/lib/api-response'
import { updateAttendanceSchema } from '@/schemas/attendance'
import * as attendanceService from '@/services/attendance.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const attendance = await attendanceService.getAttendanceById(user.id, id)
    return success(attendance)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = updateAttendanceSchema.parse(body)
    const attendance = await attendanceService.updateAttendance(user.id, id, input)
    return success(attendance)
  } catch (error) {
    return handleApiError(error)
  }
}
