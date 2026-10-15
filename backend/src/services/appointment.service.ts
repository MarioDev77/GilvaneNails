import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/auth'
import { calculateEndsAt, rangesOverlap, getDayBounds } from '@/lib/dates'
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsInput,
} from '@/schemas/appointment'
import { AppointmentStatus } from '@prisma/client'

const ACTIVE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED']

async function assertNoConflict(
  ownerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
) {
  // Use transaction with advisory lock or serializable for safety
  const candidates = await prisma.appointment.findMany({
    where: {
      ownerId,
      status: { in: ACTIVE_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      // Broad filter for performance
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true, startsAt: true, endsAt: true },
  })

  for (const appt of candidates) {
    if (rangesOverlap(startsAt, endsAt, appt.startsAt, appt.endsAt)) {
      throw new ConflictError(
        'Já existe um agendamento ativo neste horário. Escolha outro horário.'
      )
    }
  }
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

  if (agreedPriceCents < 0) {
    throw new ValidationError('Preço não pode ser negativo')
  }

  return prisma.$transaction(async (tx) => {
    // Re-check conflicts inside transaction
    const conflicting = await tx.appointment.findMany({
      where: {
        ownerId,
        status: { in: ACTIVE_STATUSES },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, startsAt: true, endsAt: true },
    })

    for (const appt of conflicting) {
      if (rangesOverlap(startsAt, endsAt, appt.startsAt, appt.endsAt)) {
        throw new ConflictError(
          'Já existe um agendamento ativo neste horário. Escolha outro horário.'
        )
      }
    }

    return tx.appointment.create({
      data: {
        ownerId,
        clientId: input.clientId,
        serviceId: input.serviceId,
        startsAt,
        endsAt,
        agreedPriceCents,
        status: input.status ?? 'SCHEDULED',
        notes: input.notes ?? null,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
    })
  })
}

export async function listAppointments(ownerId: string, params: ListAppointmentsInput) {
  const { page, limit, startDate, endDate, clientId, serviceId, status, upcoming } = params

  const where: any = { ownerId }

  if (clientId) where.clientId = clientId
  if (serviceId) where.serviceId = serviceId
  if (status) where.status = status

  if (upcoming) {
    where.startsAt = { gte: new Date() }
    where.status = { in: ACTIVE_STATUSES }
  } else if (startDate || endDate) {
    where.startsAt = {}
    if (startDate) {
      const { start } = getDayBounds(startDate)
      where.startsAt.gte = start
    }
    if (endDate) {
      const { end } = getDayBounds(endDate)
      where.startsAt.lte = end
    }
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
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
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true, durationMinutes: true, priceCents: true } },
      attendance: true,
    },
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

  let startsAt = existing.startsAt
  let endsAt = existing.endsAt
  let serviceId = existing.serviceId
  let agreedPriceCents = existing.agreedPriceCents

  if (input.serviceId && input.serviceId !== existing.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, ownerId, isActive: true },
    })
    if (!service) throw new NotFoundError('Serviço não encontrado ou inativo')
    serviceId = service.id
    if (input.agreedPriceCents === undefined) {
      agreedPriceCents = service.priceCents
    }
    endsAt = calculateEndsAt(startsAt, service.durationMinutes)
  }

  if (input.startsAt) {
    startsAt = new Date(input.startsAt)
    const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })
    endsAt = calculateEndsAt(startsAt, service.durationMinutes)
  }

  if (input.agreedPriceCents !== undefined) {
    agreedPriceCents = input.agreedPriceCents
  }

  if (input.clientId && input.clientId !== existing.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, ownerId, archivedAt: null },
    })
    if (!client) throw new NotFoundError('Cliente não encontrado ou arquivado')
  }

  return prisma.$transaction(async (tx) => {
    if (input.startsAt || input.serviceId) {
      const conflicting = await tx.appointment.findMany({
        where: {
          ownerId,
          id: { not: id },
          status: { in: ACTIVE_STATUSES },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true, startsAt: true, endsAt: true },
      })

      for (const appt of conflicting) {
        if (rangesOverlap(startsAt, endsAt, appt.startsAt, appt.endsAt)) {
          throw new ConflictError(
            'Já existe um agendamento ativo neste horário. Escolha outro horário.'
          )
        }
      }
    }

    return tx.appointment.update({
      where: { id },
      data: {
        ...(input.clientId && { clientId: input.clientId }),
        serviceId,
        startsAt,
        endsAt,
        agreedPriceCents,
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.status && { status: input.status }),
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
    })
  })
}

export async function changeAppointmentStatus(
  ownerId: string,
  id: string,
  status: AppointmentStatus
) {
  const existing = await getAppointmentById(ownerId, id)

  if (existing.status === 'COMPLETED' && status !== 'COMPLETED') {
    // Allow only if no attendance yet? But safer to prevent
    if (existing.attendance) {
      throw new ValidationError('Agendamento já possui atendimento vinculado')
    }
  }

  return prisma.appointment.update({
    where: { id },
    data: { status },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true } },
    },
  })
}

export async function cancelAppointment(ownerId: string, id: string) {
  return changeAppointmentStatus(ownerId, id, 'CANCELLED')
}

export async function getTodayAppointments(ownerId: string) {
  const { start, end } = getDayBounds(new Date())
  return prisma.appointment.findMany({
    where: {
      ownerId,
      startsAt: { gte: start, lte: end },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
    },
  })
}

export async function getUpcomingAppointments(ownerId: string, limit = 10) {
  return prisma.appointment.findMany({
    where: {
      ownerId,
      startsAt: { gte: new Date() },
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { startsAt: 'asc' },
    take: limit,
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
    },
  })
}
