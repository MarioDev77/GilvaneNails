import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/auth'
import { calculateEndsAt, getDayBounds } from '@/lib/dates'
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsInput,
} from '@/schemas/appointment'
import { AppointmentStatus, Prisma } from '@prisma/client'

const ACTIVE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED']

const appointmentInclude = {
  client: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true, durationMinutes: true, priceCents: true } },
  attendance: { select: { id: true } },
} satisfies Prisma.AppointmentInclude

/**
 * Garante que não existe outro agendamento ativo sobrepondo [startsAt, endsAt).
 * Deve ser chamado DENTRO de uma transação, depois de lockOwner().
 * Encostar (fim == início do outro) é permitido.
 */
async function assertNoConflict(
  tx: Prisma.TransactionClient,
  ownerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
) {
  const conflict = await tx.appointment.findFirst({
    where: {
      ownerId,
      status: { in: ACTIVE_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    include: { client: { select: { name: true } } },
  })
  if (conflict) {
    throw new ConflictError(
      `Já existe um agendamento neste horário (${conflict.client.name}). Escolha outro horário.`
    )
  }
}

/** Serializa operações de agenda por proprietária (evita duas marcações simultâneas no mesmo horário). */
async function lockOwner(tx: Prisma.TransactionClient, ownerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`
}

export async function createAppointment(ownerId: string, input: CreateAppointmentInput) {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, ownerId, archivedAt: null },
  })
  if (!client) throw new NotFoundError('Cliente não encontrado ou arquivado')

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, ownerId, isActive: true },
  })
  if (!service) throw new NotFoundError('Serviço não encontrado ou inativo')

  const startsAt = new Date(input.startsAt)
  const endsAt = calculateEndsAt(startsAt, service.durationMinutes)
  const agreedPriceCents = input.agreedPriceCents ?? service.priceCents
  const status = input.status ?? 'SCHEDULED'

  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId)
    if (ACTIVE_STATUSES.includes(status)) {
      await assertNoConflict(tx, ownerId, startsAt, endsAt)
    }
    return tx.appointment.create({
      data: {
        ownerId,
        clientId: input.clientId,
        serviceId: input.serviceId,
        startsAt,
        endsAt,
        agreedPriceCents,
        status,
        notes: input.notes ?? null,
      },
      include: appointmentInclude,
    })
  })
}

export async function listAppointments(ownerId: string, params: ListAppointmentsInput) {
  const { page, limit, startDate, endDate, clientId, serviceId, status, upcoming } = params

  const where: Prisma.AppointmentWhereInput = { ownerId }

  if (clientId) where.clientId = clientId
  if (serviceId) where.serviceId = serviceId
  if (status) where.status = status

  if (upcoming) {
    where.startsAt = { gte: new Date() }
    where.status = { in: ACTIVE_STATUSES }
  } else if (startDate || endDate) {
    where.startsAt = {
      ...(startDate ? { gte: getDayBounds(startDate).start } : {}),
      ...(endDate ? { lte: getDayBounds(endDate).end } : {}),
    }
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: appointmentInclude,
    }),
    prisma.appointment.count({ where }),
  ])

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getAppointmentById(ownerId: string, id: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id, ownerId },
    include: { ...appointmentInclude, attendance: true },
  })
  if (!appt) throw new NotFoundError('Agendamento não encontrado')
  return appt
}

export async function updateAppointment(
  ownerId: string,
  id: string,
  input: UpdateAppointmentInput
) {
  const existing = await getAppointmentById(ownerId, id)

  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    throw new ValidationError('Não é possível editar agendamento concluído ou cancelado')
  }

  let serviceId = existing.serviceId
  let agreedPriceCents = existing.agreedPriceCents
  let durationMinutes = existing.service.durationMinutes

  if (input.serviceId && input.serviceId !== existing.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, ownerId, isActive: true },
    })
    if (!service) throw new NotFoundError('Serviço não encontrado ou inativo')
    serviceId = service.id
    durationMinutes = service.durationMinutes
    if (input.agreedPriceCents === undefined) agreedPriceCents = service.priceCents
  }
  if (input.agreedPriceCents !== undefined) agreedPriceCents = input.agreedPriceCents

  if (input.clientId && input.clientId !== existing.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, ownerId, archivedAt: null },
    })
    if (!client) throw new NotFoundError('Cliente não encontrado ou arquivado')
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt
  const endsAt = calculateEndsAt(startsAt, durationMinutes)
  const status = input.status ?? existing.status

  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId)
    if (ACTIVE_STATUSES.includes(status)) {
      await assertNoConflict(tx, ownerId, startsAt, endsAt, id)
    }
    return tx.appointment.update({
      where: { id },
      data: {
        ...(input.clientId && { clientId: input.clientId }),
        serviceId,
        startsAt,
        endsAt,
        agreedPriceCents,
        status,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: appointmentInclude,
    })
  })
}

export async function changeAppointmentStatus(
  ownerId: string,
  id: string,
  status: AppointmentStatus
) {
  const existing = await getAppointmentById(ownerId, id)

  if (existing.attendance && status !== 'COMPLETED') {
    throw new ValidationError('Este agendamento já possui atendimento registrado.')
  }

  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId)
    // Reativar um agendamento cancelado/faltou: o horário pode já ter sido ocupado.
    if (ACTIVE_STATUSES.includes(status) && !ACTIVE_STATUSES.includes(existing.status)) {
      await assertNoConflict(tx, ownerId, existing.startsAt, existing.endsAt, id)
    }
    return tx.appointment.update({
      where: { id },
      data: { status },
      include: appointmentInclude,
    })
  })
}

export async function cancelAppointment(ownerId: string, id: string) {
  return changeAppointmentStatus(ownerId, id, 'CANCELLED')
}

export async function getTodayAppointments(ownerId: string) {
  const { start, end } = getDayBounds(new Date())
  return prisma.appointment.findMany({
    where: { ownerId, startsAt: { gte: start, lte: end } },
    orderBy: { startsAt: 'asc' },
    include: appointmentInclude,
  })
}

export async function getUpcomingAppointments(ownerId: string, limit = 10) {
  return prisma.appointment.findMany({
    where: { ownerId, startsAt: { gte: new Date() }, status: { in: ACTIVE_STATUSES } },
    orderBy: { startsAt: 'asc' },
    take: limit,
    include: appointmentInclude,
  })
}

