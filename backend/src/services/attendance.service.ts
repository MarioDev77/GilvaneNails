import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/auth'
import type {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  CreatePaymentInput,
  ListAttendancesInput,
} from '@/schemas/attendance'
import { getDayBounds } from '@/lib/dates'

export async function createAttendance(ownerId: string, input: CreateAttendanceInput) {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, ownerId },
  })
  if (!client) throw new NotFoundError('Cliente não encontrado')

  if (input.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, ownerId },
    })
    if (!service) throw new NotFoundError('Serviço não encontrado')
  }

  if (input.discountCents > input.priceCents) {
    throw new ValidationError('Desconto não pode ser maior que o preço')
  }

  return prisma.$transaction(async (tx) => {
    if (input.appointmentId) {
      const appt = await tx.appointment.findFirst({
        where: { id: input.appointmentId, ownerId },
        include: { attendance: true },
      })
      if (!appt) throw new NotFoundError('Agendamento não encontrado')
      if (appt.attendance) {
        throw new ConflictError('Este agendamento já possui um atendimento vinculado')
      }

      // Mark appointment as COMPLETED
      await tx.appointment.update({
        where: { id: input.appointmentId },
        data: { status: 'COMPLETED' },
      })
    }

    const attendance = await tx.attendance.create({
      data: {
        ownerId,
        appointmentId: input.appointmentId ?? null,
        clientId: input.clientId,
        serviceId: input.serviceId ?? null,
        performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
        priceCents: input.priceCents,
        discountCents: input.discountCents ?? 0,
        notes: input.notes ?? null,
      },
    })

    const due = input.priceCents - (input.discountCents ?? 0)
    if (input.paymentMethod && due > 0) {
      await tx.payment.create({
        data: {
          ownerId,
          attendanceId: attendance.id,
          amountCents: due,
          paidAt: new Date(),
          method: input.paymentMethod,
          description: 'Recebimento do atendimento',
        },
      })
    }

    return tx.attendance.findUniqueOrThrow({
      where: { id: attendance.id },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        appointment: { select: { id: true, startsAt: true } },
        payments: true,
      },
    })
  })
}

export async function listAttendances(ownerId: string, params: ListAttendancesInput) {
  const { page, limit, startDate, endDate, clientId, serviceId } = params
  const where: any = { ownerId }

  if (clientId) where.clientId = clientId
  if (serviceId) where.serviceId = serviceId

  if (startDate || endDate) {
    where.performedAt = {}
    if (startDate) {
      const { start } = getDayBounds(startDate)
      where.performedAt.gte = start
    }
    if (endDate) {
      const { end } = getDayBounds(endDate)
      where.performedAt.lte = end
    }
  }

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        payments: true,
      },
    }),
    prisma.attendance.count({ where }),
  ])

  // Enrich with balance
  const enriched = items.map((att) => {
    const paid = att.payments.reduce((s, p) => s + p.amountCents, 0)
    const due = att.priceCents - att.discountCents
    return {
      ...att,
      paidCents: paid,
      dueCents: due,
      balanceCents: due - paid,
    }
  })

  return {
    items: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getAttendanceById(ownerId: string, id: string) {
  const att = await prisma.attendance.findFirst({
    where: { id, ownerId },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true } },
      appointment: true,
      payments: { orderBy: { paidAt: 'asc' } },
    },
  })
  if (!att) throw new NotFoundError('Atendimento não encontrado')

  const paid = att.payments.reduce((s, p) => s + p.amountCents, 0)
  const due = att.priceCents - att.discountCents
  return {
    ...att,
    paidCents: paid,
    dueCents: due,
    balanceCents: due - paid,
  }
}

export async function updateAttendance(
  ownerId: string,
  id: string,
  input: UpdateAttendanceInput
) {
  const existing = await getAttendanceById(ownerId, id)

  if (input.discountCents !== undefined && input.priceCents !== undefined) {
    if (input.discountCents > input.priceCents) {
      throw new ValidationError('Desconto não pode ser maior que o preço')
    }
  } else if (input.discountCents !== undefined && input.discountCents > existing.priceCents) {
    throw new ValidationError('Desconto não pode ser maior que o preço')
  }

  return prisma.attendance.update({
    where: { id },
    data: {
      ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
      ...(input.discountCents !== undefined && { discountCents: input.discountCents }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.performedAt && { performedAt: new Date(input.performedAt) }),
    },
    include: {
      client: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      payments: true,
    },
  })
}

export async function addPayment(
  ownerId: string,
  attendanceId: string,
  input: CreatePaymentInput
) {
  const attendance = await getAttendanceById(ownerId, attendanceId)

  // Idempotency check
  if (input.idempotencyKey) {
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: {
        ownerId_key: { ownerId, key: input.idempotencyKey },
      },
    })
    if (existingKey?.response) {
      return existingKey.response as any
    }
  }

  const paid = attendance.paidCents
  const due = attendance.dueCents
  if (paid + input.amountCents > due + 100) {
    // Allow small overpayment tolerance? Or strict
    // For now allow but warn via balance
  }

  const result = await prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.idempotencyKey.findUnique({
        where: { ownerId_key: { ownerId, key: input.idempotencyKey } },
      })
      if (existing?.response) return existing.response as any
    }

    const payment = await tx.payment.create({
      data: {
        ownerId,
        attendanceId,
        amountCents: input.amountCents,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        method: input.method,
        description: input.description ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    })

    if (input.idempotencyKey) {
      await tx.idempotencyKey.create({
        data: {
          ownerId,
          key: input.idempotencyKey,
          response: payment as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    }

    return payment
  })

  return result
}

export async function getAttendancePayments(ownerId: string, attendanceId: string) {
  await getAttendanceById(ownerId, attendanceId)
  return prisma.payment.findMany({
    where: { ownerId, attendanceId },
    orderBy: { paidAt: 'asc' },
  })
}
