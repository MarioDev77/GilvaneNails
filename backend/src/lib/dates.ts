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

export function getDayBounds(date: Date | string, timezone = TIMEZONE) {
  const local = typeof date === 'string' ? toZonedTime(new Date(date), timezone) : toZonedTime(date, timezone)
  const start = fromZonedTime(startOfDay(local), timezone)
  const end = fromZonedTime(endOfDay(local), timezone)
  return { start, end }
}

export function getMonthBounds(date: Date | string, timezone = TIMEZONE) {
  const local = typeof date === 'string' ? toZonedTime(new Date(date), timezone) : toZonedTime(date, timezone)
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
