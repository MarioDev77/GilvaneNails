import { addDays, addMinutes } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError, ValidationError } from '@/lib/auth'
import { TIMEZONE, formatLocal, rangesOverlap } from '@/lib/dates'
import {
  BOOKING_REQUEST_MARKER,
  MAX_DAYS_AHEAD,
  MAX_PENDING_PER_CLIENT,
  MIN_LEAD_MINUTES,
  SLOT_STEP_MINUTES,
  getBookingHours,
  getPublicOwnerId,
} from '@/lib/public-booking'
import { createAppointment } from '@/services/appointment.service'
import type { AvailabilityQuery, CreatePublicBookingInput } from '@/schemas/public-booking'

const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const

function localToUtc(date: string, hhmm: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, TIMEZONE)
}

function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function assertDateInWindow(date: string) {
  const today = formatLocal(new Date(), 'yyyy-MM-dd')
  const last = formatLocal(addDays(new Date(), MAX_DAYS_AHEAD), 'yyyy-MM-dd')
  if (date < today || date > last) {
    throw new ValidationError(`Escolha uma data entre hoje e os próximos ${MAX_DAYS_AHEAD} dias.`)
  }
}

async function computeSlots(ownerId: string, durationMinutes: number, date: string) {
  const hours = await getBookingHours(ownerId)
  if (!hours.days.includes(weekday(date))) return []

  const open = localToUtc(date, hours.start)
  const close = localToUtc(date, hours.end)
  const earliest = addMinutes(new Date(), MIN_LEAD_MINUTES).getTime()

  const busy = await prisma.appointment.findMany({
    where: {
      ownerId,
      status: { in: [...ACTIVE_STATUSES] },
      startsAt: { lt: close },
      endsAt: { gt: open },
    },
    select: { startsAt: true, endsAt: true },
  })

  const slots: { startsAt: string; time: string }[] = []
  for (
    let start = open;
    addMinutes(start, durationMinutes).getTime() <= close.getTime();
    start = addMinutes(start, SLOT_STEP_MINUTES)
  ) {
    if (start.getTime() < earliest) continue
    const end = addMinutes(start, durationMinutes)
    if (busy.some((b) => rangesOverlap(start, end, b.startsAt, b.endsAt))) continue
    slots.push({ startsAt: start.toISOString(), time: formatLocal(start, 'HH:mm') })
  }
  return slots
}

export async function listPublicServices() {
  const ownerId = await getPublicOwnerId()
  return prisma.service.findMany({
    where: { ownerId, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      durationMinutes: true,
    },
  })
}

export async function getAvailability({ date, serviceId }: AvailabilityQuery) {
  assertDateInWindow(date)
  const ownerId = await getPublicOwnerId()
  const service = await prisma.service.findFirst({
    where: { id: serviceId, ownerId, isActive: true },
  })
  if (!service) throw new NotFoundError('Serviço não encontrado')

  return { date, slots: await computeSlots(ownerId, service.durationMinutes, date) }
}

export async function createPublicBooking(input: CreatePublicBookingInput) {
  const ownerId = await getPublicOwnerId()

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, ownerId, isActive: true },
  })
  if (!service) throw new NotFoundError('Serviço não encontrado')

  const startsAt = new Date(input.startsAt)
  const date = formatLocal(startsAt, 'yyyy-MM-dd')
  assertDateInWindow(date)

  // O horário precisa ser exatamente um dos horários livres calculados pelo servidor.
  const slots = await computeSlots(ownerId, service.durationMinutes, date)
  const valid = slots.some((s) => new Date(s.startsAt).getTime() === startsAt.getTime())
  if (!valid) {
    throw new ConflictError('Esse horário não está mais disponível. Escolha outro horário.')
  }

  // Reaproveita o cliente pelo telefone; se não existir, cria um cadastro simples.
  let client = await prisma.client.findFirst({
    where: { ownerId, phone: input.phone, archivedAt: null },
  })
  if (!client) {
    client = await prisma.client.create({
      data: { ownerId, name: input.name, phone: input.phone },
    })
  }

  const pending = await prisma.appointment.count({
    where: {
      ownerId,
      clientId: client.id,
      status: 'SCHEDULED',
      notes: { startsWith: BOOKING_REQUEST_MARKER },
    },
  })
  if (pending >= MAX_PENDING_PER_CLIENT) {
    throw new ValidationError(
      'Você já tem solicitações aguardando confirmação. Aguarde o retorno para pedir outro horário.'
    )
  }

  const notes = `${BOOKING_REQUEST_MARKER} ${input.name}${input.notes ? ` — ${input.notes}` : ''}`

  // Reaproveita a criação oficial (valida serviço e confere conflito dentro de transação).
  const appointment = await createAppointment(ownerId, {
    clientId: client.id,
    serviceId: service.id,
    startsAt: startsAt.toISOString(),
    notes,
    status: 'SCHEDULED',
  })

  // Resposta mínima: nada de dados de clientes na rota pública.
  return {
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    service: { name: service.name },
  }
}
