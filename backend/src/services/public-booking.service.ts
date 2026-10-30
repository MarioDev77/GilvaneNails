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
  getBookingSchedule,
  getPublicOwnerId,
} from '@/lib/public-booking'
import { samePhone } from '@/lib/phone'
import { hoursForDate } from '@/lib/schedule'
import { safeManageToken } from '@/lib/manage-token'
import { createAppointment } from '@/services/appointment.service'
import type { AvailabilityQuery, CreatePublicBookingInput } from '@/schemas/public-booking'

const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const

function localToUtc(date: string, hhmm: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, TIMEZONE)
}

export function assertDateInWindow(date: string) {
  const today = formatLocal(new Date(), 'yyyy-MM-dd')
  const last = formatLocal(addDays(new Date(), MAX_DAYS_AHEAD), 'yyyy-MM-dd')
  if (date < today || date > last) {
    throw new ValidationError(`Escolha uma data entre hoje e os próximos ${MAX_DAYS_AHEAD} dias.`)
  }
}

/** `ignoreAppointmentId`: ao remarcar, o próprio horário da cliente não conta como ocupado. */
export async function computeSlots(ownerId: string, durationMinutes: number, date: string, ignoreAppointmentId?: string) {
  // Modelo semanal + exceções do dia; null = fechado
  const day = hoursForDate(await getBookingSchedule(ownerId), date)
  if (!day) return []

  const open = localToUtc(date, day.start)
  const close = localToUtc(date, day.end)
  const lunch =
    day.breakStart && day.breakEnd
      ? { start: localToUtc(date, day.breakStart), end: localToUtc(date, day.breakEnd) }
      : null
  const earliest = addMinutes(new Date(), MIN_LEAD_MINUTES).getTime()

  const busy = await prisma.appointment.findMany({
    where: {
      ownerId,
      status: { in: [...ACTIVE_STATUSES] },
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
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
    if (lunch && rangesOverlap(start, end, lunch.start, lunch.end)) continue
    if (busy.some((b) => rangesOverlap(start, end, b.startsAt, b.endsAt))) continue
    slots.push({ startsAt: start.toISOString(), time: formatLocal(start, 'HH:mm') })
  }
  return slots
}

/** Acha a cliente pelo telefone comparando só os números (cadastros do painel guardam com máscara). */
async function findClientByPhone(ownerId: string, phone: string) {
  const candidates = await prisma.client.findMany({
    where: { ownerId, archivedAt: null, NOT: { phone: '' } },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  })
  return candidates.find((c) => samePhone(c.phone, phone)) ?? null
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

  // Reaproveita a cliente pelo telefone (ignorando máscara: "(75) 99999-9999" == "75999999999").
  let client = await findClientByPhone(ownerId, input.phone)

  // Limite de pedidos pendentes é checado ANTES de cadastrar alguém (antes ficava cliente órfã no banco).
  if (client) {
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
  }

  if (!client) {
    client = await prisma.client.create({
      data: { ownerId, name: input.name, phone: input.phone },
    })
  }

  const notes = `${BOOKING_REQUEST_MARKER} ${input.name}${input.notes ? ` — ${input.notes}` : ''}`

  // Reaproveita a criação oficial (valida serviço e confere conflito dentro de transação travada).
  let appointment
  try {
    appointment = await createAppointment(ownerId, {
      clientId: client.id,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      notes,
      status: 'SCHEDULED',
    })
  } catch (e) {
    // A mensagem de conflito do painel cita o nome de quem ocupa o horário.
    // Na rota pública isso não pode vazar: dados de outra cliente.
    if (e instanceof ConflictError) {
      throw new ConflictError('Esse horário não está mais disponível. Escolha outro horário.')
    }
    throw e
  }

  // Resposta mínima: nada de dados de clientes na rota pública.
  return {
    id: appointment.id,
    manageToken: safeManageToken(appointment.id), // link de remarcar/cancelar da própria cliente
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    service: { name: service.name },
  }
}
