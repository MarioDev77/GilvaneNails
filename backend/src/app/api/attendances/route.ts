import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createAttendanceSchema, listAttendancesSchema } from '@/schemas/attendance'
import * as attendanceService from '@/services/attendance.service'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const params = listAttendancesSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const result = await attendanceService.listAttendances(user.id, params)
    return success(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const input = createAttendanceSchema.parse(body)
    const attendance = await attendanceService.createAttendance(user.id, input)
    return created(attendance)
  } catch (error) {
    return handleApiError(error)
  }
}
