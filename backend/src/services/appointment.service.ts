import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/auth'
import { calculateEndsAt, getDayBounds } from '@/lib/dates'
import { conflictMessage, findOverlap } from '@/lib/conflicts'
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsInput,
} from '@/schemas/appointment'
import { AppointmentStatus, PaymentMethod } from '@prisma/client'

const ACTIVE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED']

type Db = Pick<typeof prisma, 'appointment'>
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Serializa as gravações de agenda da mesma dona: duas pessoas pedindo o mesmo horário ao mesmo
 * tempo (site público + painel) passam uma de cada vez. Sem isso, a checagem de conflito e o
 * insert eram etapas separadas e os dois pedidos podiam passar, gerando horário duplicado.
 * Trava de transação do Postgres: não cria tabela nem altera o banco, solta sozinha no fim.
 */
async function lockAgenda(tx: Tx, ownerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'agenda:' + ownerId}))`
}

/** Garante que o intervalo está livre. Só conta agendamentos ativos (agendado/confirmado). */
async function assertNoConflict(
  db: Db,
  ownerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
) {
  const candidates = await db.appointment.findMany({
    where: {
      ownerId,
      status: { in: ACTIVE_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true, startsAt: true, endsAt: true, client: { select: { name: true } } },
  })
  const clash = findOverlap(startsAt, endsAt, candidates)
  if (clash) throw new ConflictError(conflictMessage(clash))
}

// Agendamento direto: se vier só o nome, reaproveita o cliente com o mesmo nome
// (ou cria um cadastro simples automaticamente), sem exigir cadastro prévio.
async function resolveClient(
  ownerId: string,
  clientId?: string,
  clientName?: string,
  clientPhone?: string
) {
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, ownerId, archivedAt: null },
    })
    if (!client) throw new NotFoundError('Cliente não encontrado ou arquivado')
    return client
  }

  const name = (clientName ?? '').trim()
  if (!name) throw new ValidationError('Informe o nome do cliente')

  const existing = await prisma.client.findFirst({
    where: { ownerId, archivedAt: null, name: { equals: name, mode: 'insensitive' } },
  })
  const phone = (clientPhone ?? '').trim()
  if (existing) {
    if (phone && !existing.phone) {
      return prisma.client.update({ where: { id: existing.id }, data: { phone } })
    }
    return existing
  }

  return prisma.client.create({ data: { ownerId, name, phone } })
}

const COMPLETE_HINT =
  'Para concluir um atendimento use "Concluir" (informa a forma de pagamento e lança o valor no saldo).'

export async function createAppointment(ownerId: string, input: CreateAppointmentInput) {
  if (input.status === 'COMPLETED') throw new ValidationError(COMPLETE_HINT)

  const client = await resolveClient(ownerId, input.clientId, input.clientName, input.clientPhone)

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
    await lockAgenda(tx, ownerId)
    await assertNoConflict(tx, ownerId, startsAt, endsAt)

    return tx.appointment.create({
      data: {
        ownerId,
        clientId: client.id,
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
  const { page, limit, startDate, endDate, clientId, serviceId, status, upcoming, order, search, statuses } = params

  const where: any = { ownerId }

  if (clientId) where.clientId = clientId
  if (serviceId) where.serviceId = serviceId
  if (status) where.status = status
  if (statuses) {
    const valid = statuses
      .split(',')
      .map((x) => x.trim())
      .filter((x): x is AppointmentStatus => ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(x))
    if (valid.length) where.status = { in: valid }
  }
  if (search) {
    where.OR = [
      { client: { name: { contains: search, mode: 'insensitive' } } },
      { service: { name: { contains: search, mode: 'insensitive' } } },
      { notes: { contains: search, mode: 'insensitive' } },
    ]
  }

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
      orderBy: { startsAt: order },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
        attendance: { select: { id: true, payments: { select: { amountCents: true, method: true } } } },
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
  if (input.status === 'COMPLETED') throw new ValidationError(COMPLETE_HINT)

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

  let newClientId: string | undefined
  if (input.clientId && input.clientId !== existing.clientId) {
    const client = await resolveClient(ownerId, input.clientId)
    newClientId = client.id
  } else if (input.clientName && input.clientName.trim().toLowerCase() !== existing.client.name.trim().toLowerCase()) {
    const client = await resolveClient(ownerId, undefined, input.clientName)
    newClientId = client.id
  }

  return prisma.$transaction(async (tx) => {
    await lockAgenda(tx, ownerId)
    const nextStatus = input.status ?? existing.status
    if (ACTIVE_STATUSES.includes(nextStatus)) {
      await assertNoConflict(tx, ownerId, startsAt, endsAt, id)
    }

    return tx.appointment.update({
      where: { id },
      data: {
        ...(newClientId && { clientId: newClientId }),
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

  if (status === 'COMPLETED') throw new ValidationError(COMPLETE_HINT)

  if (existing.status === 'COMPLETED') {
    // Concluído já gerou atendimento e pagamento: use "Desfazer conclusão" para reabrir.
    throw new ValidationError(
      'Este atendimento já foi concluído. Use "Desfazer conclusão" para corrigir.'
    )
  }

  const include = {
    client: { select: { id: true, name: true, phone: true } },
    service: { select: { id: true, name: true } },
  }

  // Reativar um horário cancelado/falta: só se ninguém ocupou o lugar nesse meio tempo.
  const reactivating = ACTIVE_STATUSES.includes(status) && !ACTIVE_STATUSES.includes(existing.status)
  if (reactivating) {
    return prisma.$transaction(async (tx) => {
      await lockAgenda(tx, ownerId)
      await assertNoConflict(tx, ownerId, existing.startsAt, existing.endsAt, id)
      return tx.appointment.update({ where: { id }, data: { status }, include })
    })
  }

  return prisma.appointment.update({ where: { id }, data: { status }, include })
}

/**
 * Exclui DEFINITIVAMENTE um agendamento (ex.: lançado por engano).
 * Diferente de cancelar, não deixa registro. Agendamento concluído tem atendimento e
 * pagamento ligados ao financeiro, então precisa "Desfazer conclusão" antes.
 */
export async function deleteAppointment(ownerId: string, id: string) {
  const appt = await getAppointmentById(ownerId, id)
  if (appt.status === 'COMPLETED' || appt.attendance) {
    throw new ValidationError(
      'Este atendimento já foi concluído e está no financeiro. Use "Desfazer conclusão" antes de excluir.'
    )
  }
  await prisma.appointment.delete({ where: { id } })
  return { id, deleted: true as const }
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


export type CompleteAppointmentInput = {
  method: PaymentMethod
  /** Valor efetivamente recebido, em centavos. Padrão: preço combinado do agendamento. */
  amountCents?: number
  paidAt?: Date
}

/**
 * Conclui um agendamento: marca COMPLETED, cria o atendimento e lança o pagamento.
 * É isso que faz o dinheiro aparecer no saldo / relatório financeiro.
 * Tudo numa transação; se já houver atendimento, não duplica.
 */
export async function completeAppointment(
  ownerId: string,
  id: string,
  input: CompleteAppointmentInput
) {
  const appt = await getAppointmentById(ownerId, id)

  if (appt.status === 'COMPLETED' || appt.attendance) {
    throw new ConflictError('Este atendimento já foi concluído')
  }
  if (appt.status === 'CANCELLED' || appt.status === 'NO_SHOW') {
    throw new ValidationError('Agendamento cancelado ou sem comparecimento não gera valor')
  }

  const received = input.amountCents ?? appt.agreedPriceCents
  if (!Number.isInteger(received) || received < 0) {
    throw new ValidationError('Valor recebido inválido')
  }

  // Recebeu menos que o combinado => desconto; recebeu mais => o preço sobe (gorjeta/adicional).
  const priceCents = Math.max(appt.agreedPriceCents, received)
  const discountCents = priceCents - received
  const now = input.paidAt ?? new Date()

  return prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.create({
      data: {
        ownerId,
        appointmentId: appt.id,
        clientId: appt.clientId,
        serviceId: appt.serviceId,
        performedAt: appt.startsAt <= now ? appt.startsAt : now,
        priceCents,
        discountCents,
        notes: appt.notes ?? null,
      },
    })

    if (received > 0) {
      await tx.payment.create({
        data: {
          ownerId,
          attendanceId: attendance.id,
          amountCents: received,
          paidAt: now,
          method: input.method,
          description: 'Recebimento do atendimento',
        },
      })
    }

    return tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'COMPLETED' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        attendance: { include: { payments: true } },
      },
    })
  })
}

export type CompleteDayItem = {
  id: string
  method: PaymentMethod
  amountCents?: number
}

/** "Fechar o dia": conclui vários agendamentos de uma vez. Cada um é independente. */
export async function completeAppointments(ownerId: string, items: CompleteDayItem[]) {
  const completed: string[] = []
  const failed: { id: string; message: string }[] = []

  for (const item of items) {
    try {
      await completeAppointment(ownerId, item.id, {
        method: item.method,
        amountCents: item.amountCents,
      })
      completed.push(item.id)
    } catch (e: any) {
      failed.push({ id: item.id, message: e?.message ?? 'Erro ao concluir' })
    }
  }

  return { completed, failed }
}

/** Desfaz a conclusão (ex.: marcou por engano): remove atendimento/pagamentos e volta p/ Confirmado. */
export async function reopenAppointment(ownerId: string, id: string) {
  const appt = await getAppointmentById(ownerId, id)
  if (appt.status !== 'COMPLETED') {
    throw new ValidationError('Só é possível desfazer um atendimento concluído')
  }

  return prisma.$transaction(async (tx) => {
    if (appt.attendance) {
      await tx.payment.deleteMany({ where: { ownerId, attendanceId: appt.attendance.id } })
      await tx.attendance.delete({ where: { id: appt.attendance.id } })
    }
    return tx.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
      },
    })
  })
}
