import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError, success, created } from '@/lib/api-response'
import { createPaymentSchema } from '@/schemas/attendance'
import * as attendanceService from '@/services/attendance.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const payments = await attendanceService.getAttendancePayments(user.id, id)
    return success(payments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const input = createPaymentSchema.parse(body)
    const payment = await attendanceService.addPayment(user.id, id, input)
    return created(payment)
  } catch (error) {
    return handleApiError(error)
  }
}
