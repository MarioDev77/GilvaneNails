import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addMinutes,
  isBefore,
  isAfter,
  isEqual,
} from 'date-fns'

export const TIMEZONE = 'America/Bahia'

export function nowInTimezone(): Date {
  return toZonedTime(new Date(), TIMEZONE)
}

export function toUTC(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return fromZonedTime(d, TIMEZONE)
}

export function toLocal(date: Date): Date {
  return toZonedTime(date, TIMEZONE)
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Datas "YYYY-MM-DD" são interpretadas como dia local (America/Bahia).
// Antes, new Date('2026-10-16') virava 15/10 21:00 no fuso e o dia ficava errado.
function toLocalReference(date: Date | string, timezone: string): Date {
  if (typeof date === 'string') {
    if (DATE_ONLY.test(date)) return new Date(`${date}T12:00:00`)
    return toZonedTime(new Date(date), timezone)
  }
  return toZonedTime(date, timezone)
}

export function getDayBounds(date: Date | string, timezone = TIMEZONE) {
  // "YYYY-MM-DD": limites do dia calculados direto no fuso da Bahia, sem depender do fuso do servidor.
  if (typeof date === 'string' && DATE_ONLY.test(date)) {
    return {
      start: fromZonedTime(`${date}T00:00:00.000`, timezone),
      end: fromZonedTime(`${date}T23:59:59.999`, timezone),
    }
  }
  const local = toLocalReference(date, timezone)
  const start = fromZonedTime(startOfDay(local), timezone)
  const end = fromZonedTime(endOfDay(local), timezone)
  return { start, end }
}

export function getMonthBounds(date: Date | string, timezone = TIMEZONE) {
  const local = toLocalReference(date, timezone)
  const start = fromZonedTime(startOfMonth(local), timezone)
  const end = fromZonedTime(endOfMonth(local), timezone)
  return { start, end }
}

export function formatLocal(date: Date, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX") {
  return formatInTimeZone(date, TIMEZONE, pattern)
}

export function calculateEndsAt(startsAt: Date, durationMinutes: number): Date {
  return addMinutes(startsAt, durationMinutes)
}

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  // Overlap if A starts before B ends AND A ends after B starts
  // Equal boundaries do not overlap (back-to-back is allowed)
  return isBefore(startA, endB) && isAfter(endA, startB)
}
