import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { addMinutes, endOfDay, endOfMonth, isAfter, isBefore, startOfDay, startOfMonth } from 'date-fns'

export const TIMEZONE = 'America/Bahia'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Converte a entrada de data da API em um instante UTC correto.
 * - "2026-10-15"            → 00:00 do dia 15 NO FUSO DA BAHIA (e não em UTC!)
 * - "2026-10-15T10:00:00-03:00" / "...Z" → o instante informado
 */
export function parseDateInput(value: string | Date, timezone = TIMEZONE): Date {
  if (value instanceof Date) return value
  if (DATE_ONLY.test(value)) return fromZonedTime(`${value}T00:00:00`, timezone)
  return new Date(value)
}

export function formatLocal(date: Date, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX") {
  return formatInTimeZone(date, TIMEZONE, pattern)
}

/** Início e fim (UTC) do dia local ao qual `date` pertence. */
export function getDayBounds(date: Date | string, timezone = TIMEZONE) {
  const instant = parseDateInput(date, timezone)
  const local = toZonedTime(instant, timezone)
  return {
    start: fromZonedTime(startOfDay(local), timezone),
    end: fromZonedTime(endOfDay(local), timezone),
  }
}

/** Início e fim (UTC) do mês local ao qual `date` pertence. */
export function getMonthBounds(date: Date | string, timezone = TIMEZONE) {
  const instant = parseDateInput(date, timezone)
  const local = toZonedTime(instant, timezone)
  return {
    start: fromZonedTime(startOfMonth(local), timezone),
    end: fromZonedTime(endOfMonth(local), timezone),
  }
}

export function calculateEndsAt(startsAt: Date, durationMinutes: number): Date {
  return addMinutes(startsAt, durationMinutes)
}

/** Sobreposição: encostar (fim = início do outro) NÃO conta como conflito. */
export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return isBefore(startA, endB) && isAfter(endA, startB)
}
