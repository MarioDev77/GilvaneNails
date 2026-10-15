import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/auth'
import { parseDateInput } from '@/lib/dates'
import type { CreateClientInput, UpdateClientInput, ListClientsInput } from '@/schemas/client'

export async function createClient(ownerId: string, input: CreateClientInput) {
  return prisma.client.create({
    data: {
      ownerId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      birthday: input.birthday ? parseDateInput(input.birthday) : null,
      notes: input.notes ?? null,
    },
  })
}

export async function listClients(ownerId: string, params: ListClientsInput) {
  const { page, limit, search, includeArchived } = params
  const where: any = {
    ownerId,
    ...(includeArchived ? {} : { archivedAt: null }),
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getClientById(ownerId: string, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, ownerId },
  })
  if (!client) throw new NotFoundError('Cliente não encontrado')
  return client
}

export async function updateClient(ownerId: string, id: string, input: UpdateClientInput) {
  await getClientById(ownerId, id)
  return prisma.client.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.phone !== undefined && { phone: input.phone.trim() }),
      ...(input.birthday !== undefined && {
        birthday: input.birthday ? parseDateInput(input.birthday) : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  })
}

export async function archiveClient(ownerId: string, id: string) {
  await getClientById(ownerId, id)
  return prisma.client.update({
    where: { id },
    data: { archivedAt: new Date() },
  })
}

export async function getClientHistory(ownerId: string, id: string) {
  await getClientById(ownerId, id)

  const [attendances, futureAppointments, payments] = await Promise.all([
    prisma.attendance.findMany({
      where: { ownerId, clientId: id },
      orderBy: { performedAt: 'desc' },
      take: 50,
      include: {
        service: { select: { id: true, name: true } },
        payments: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        ownerId,
        clientId: id,
        startsAt: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      orderBy: { startsAt: 'asc' },
      include: {
        service: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        ownerId,
        attendance: { clientId: id },
      },
      orderBy: { paidAt: 'desc' },
      take: 50,
    }),
  ])

  const pendingBalance = attendances.reduce((sum, att) => {
    const paid = att.payments.reduce((s, p) => s + p.amountCents, 0)
    const due = att.priceCents - att.discountCents
    return sum + Math.max(0, due - paid)
  }, 0)

  return {
    attendances,
    futureAppointments,
    payments,
    pendingBalanceCents: pendingBalance,
  }
}
