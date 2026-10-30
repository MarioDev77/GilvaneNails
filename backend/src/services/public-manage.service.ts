import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError, ValidationError } from '@/lib/auth'
import { formatLocal } from '@/lib/dates'
import { BOOKING_REQUEST_MARKER, MANAGE_MIN_LEAD_MINUTES, getPublicOwnerId } from '@/lib/public-booking'
import { isValidManageToken } from '@/lib/manage-token'
import { notifyOwner, prettyPhone } from '@/lib/notify'
import { assertDateInWindow, computeSlots } from '@/services/public-booking.service'
import { updateAppointment } from '@/services/appointment.service'

/**
 * Remarcar / cancelar pela própria cliente (rotas /api/public/manage/*, sem login).
 * Acesso só com id + token assinado. Nenhum dado de outra cliente sai daqui.
 */

const INVALID_LINK = 'Link inválido ou expirado. Peça um novo link para a Gilvane.'
const OPEN_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const
const MIN_LEAD_HOURS = MANAGE_MIN_LEAD_MINUTES / 60

type Reason = 'closed' | 'past' | 'too_late' | null

async function loadManaged(id: string, token: string) {
  // Mesma resposta para token errado e para agendamento inexistente: não revela qual dos dois falhou.
  if (!isValidManageToken(id, token)) throw new NotFoundError(INVALID_LINK)
  const ownerId = await getPublicOwnerId()
  const appt = await prisma.appointment.findFirst({
    where: { id, ownerId },
    include: {
      service: { select: { name: true, durationMinutes: true } },
      client: { select: { name: true, phone: true } },
    },
  })
  if (!appt) throw new NotFoundError(INVALID_LINK)
  return { ownerId, appt }
}

function changeState(appt: { status: string; startsAt: Date }): { canChange: boolean; reason: Reason } {
  if (!(OPEN_STATUSES as readonly string[]).includes(appt.status)) return { canChange: false, reason: 'closed' }
  const ms = appt.startsAt.getTime() - Date.now()
  if (ms < 0) return { canChange: false, reason: 'past' }
  if (ms < MANAGE_MIN_LEAD_MINUTES * 60_000) return { canChange: false, reason: 'too_late' }
  return { canChange: true, reason: null }
}

function assertChangeable(appt: { status: string; startsAt: Date }) {
  const { canChange, reason } = changeState(appt)
  if (canChange) return
  if (reason === 'closed') throw new ValidationError('Este horário não pode mais ser alterado por aqui.')
  throw new ValidationError(
    `Só dá para remarcar ou cancelar por aqui com pelo menos ${MIN_LEAD_HOURS} horas de antecedência. Fale diretamente com a Gilvane.`
  )
}

export async function getManagedBooking(id: string, token: string) {
  const { appt } = await loadManaged(id, token)
  return {
    id: appt.id,
    status: appt.status,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    firstName: appt.client.name.trim().split(' ')[0],
    service: { name: appt.service.name, durationMinutes: appt.service.durationMinutes },
    ...changeState(appt),
    minLeadHours: MIN_LEAD_HOURS,
  }
}

export async function getManagedSlots(id: string, token: string, date: string) {
  const { ownerId, appt } = await loadManaged(id, token)
  assertChangeable(appt)
  assertDateInWindow(date)
  const slots = await computeSlots(ownerId, appt.service.durationMinutes, date, appt.id)
  // O horário atual não é uma opção de "novo" horário.
  return { date, slots: slots.filter((s) => new Date(s.startsAt).getTime() !== appt.startsAt.getTime()) }
}

export async function cancelManagedBooking(id: string, token: string) {
  const { ownerId, appt } = await loadManaged(id, token)
  assertChangeable(appt)

  const notes = `${appt.notes ? `${appt.notes} · ` : ''}Cancelado pela cliente em ${formatLocal(new Date(), 'dd/MM HH:mm')}`
  // updateMany com o status na condição: se a dona mexeu nesse meio tempo, não sobrescreve.
  const res = await prisma.appointment.updateMany({
    where: { id: appt.id, ownerId, status: { in: [...OPEN_STATUSES] } },
    data: { status: 'CANCELLED', notes },
  })
  if (res.count === 0) throw new ConflictError('Este horário já foi alterado. Atualize a página.')
  await notifyOwner(
    '❌ Cliente cancelou o horário',
    `${appt.client.name} (${prettyPhone(appt.client.phone)})\n${appt.service.name} · ${formatLocal(appt.startsAt, 'dd/MM')} às ${formatLocal(appt.startsAt, 'HH:mm')}\nO horário já ficou livre.`
  ).catch(() => {})
  return { status: 'CANCELLED' as const }
}

export async function rescheduleManagedBooking(id: string, token: string, startsAtIso: string) {
  const { ownerId, appt } = await loadManaged(id, token)
  assertChangeable(appt)

  const startsAt = new Date(startsAtIso)
  if (startsAt.getTime() === appt.startsAt.getTime()) {
    throw new ValidationError('Esse já é o seu horário atual. Escolha outro.')
  }
  assertDateInWindow(formatLocal(startsAt, 'yyyy-MM-dd'))

  // O novo horário precisa ser exatamente um dos livres calculados pelo servidor.
  const slots = await computeSlots(ownerId, appt.service.durationMinutes, formatLocal(startsAt, 'yyyy-MM-dd'), appt.id)
  if (!slots.some((s) => new Date(s.startsAt).getTime() === startsAt.getTime())) {
    throw new ConflictError('Esse horário não está mais disponível. Escolha outro horário.')
  }

  // Volta para "Agendado" e entra em Solicitações: a Gilvane precisa confirmar o novo horário.
  const previous = (appt.notes ?? '')
    .replace(BOOKING_REQUEST_MARKER, '')
    .replace(/^\s*Remarcado pela cliente \(era [^)]*\)\s*(—\s*)?/, '')
    .trim()
  const notes = `${BOOKING_REQUEST_MARKER} Remarcado pela cliente (era ${formatLocal(appt.startsAt, 'dd/MM')} às ${formatLocal(appt.startsAt, 'HH:mm')})${previous ? ` — ${previous}` : ''}`.slice(0, 2000)

  try {
    const updated = await updateAppointment(ownerId, appt.id, {
      startsAt: startsAt.toISOString(),
      status: 'SCHEDULED',
      notes,
    })
    await notifyOwner(
      '🔁 Cliente remarcou o horário',
      `${appt.client.name} (${prettyPhone(appt.client.phone)})\n${appt.service.name}\nDe ${formatLocal(appt.startsAt, 'dd/MM')} às ${formatLocal(appt.startsAt, 'HH:mm')} para ${formatLocal(startsAt, 'dd/MM')} às ${formatLocal(startsAt, 'HH:mm')}\nAguardando sua confirmação em Solicitações.`
    ).catch(() => {})
    return { status: updated.status, startsAt: updated.startsAt, endsAt: updated.endsAt, service: { name: updated.service.name } }
  } catch (e) {
    // A mensagem de conflito do painel cita o nome de quem ocupa o horário: não pode vazar na rota pública.
    if (e instanceof ConflictError) throw new ConflictError('Esse horário não está mais disponível. Escolha outro horário.')
    throw e
  }
}
