import { formatLocal, rangesOverlap } from '@/lib/dates'

export type ConflictCandidate = {
  startsAt: Date
  endsAt: Date
  client?: { name: string } | null
}

/** Primeiro agendamento que realmente se sobrepõe ao intervalo (encostar no fim/início não conta). */
export function findOverlap<T extends ConflictCandidate>(
  startsAt: Date,
  endsAt: Date,
  candidates: T[]
): T | undefined {
  return candidates.find((c) => rangesOverlap(startsAt, endsAt, c.startsAt, c.endsAt))
}

/** Mensagem que diz exatamente QUEM está ocupando o horário e de que hora a que hora. */
export function conflictMessage(c: ConflictCandidate): string {
  const day = formatLocal(c.startsAt, 'dd/MM')
  const from = formatLocal(c.startsAt, 'HH:mm')
  const to = formatLocal(c.endsAt, 'HH:mm')
  const who = c.client?.name ? ` (${c.client.name})` : ''
  return `Esse horário conflita com outro agendamento${who} em ${day}, das ${from} às ${to}. Escolha outro horário ou cancele/exclua o que está ocupando.`
}
