import { describe, it, expect } from 'vitest'
import { rangesOverlap, calculateEndsAt } from '../src/lib/dates'

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    const aStart = new Date('2025-01-01T10:00:00Z')
    const aEnd = new Date('2025-01-01T11:00:00Z')
    const bStart = new Date('2025-01-01T10:30:00Z')
    const bEnd = new Date('2025-01-01T11:30:00Z')
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
  })

  it('allows back-to-back appointments', () => {
    const aStart = new Date('2025-01-01T10:00:00Z')
    const aEnd = new Date('2025-01-01T11:00:00Z')
    const bStart = new Date('2025-01-01T11:00:00Z')
    const bEnd = new Date('2025-01-01T12:00:00Z')
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
  })

  it('detects no overlap when far apart', () => {
    const aStart = new Date('2025-01-01T10:00:00Z')
    const aEnd = new Date('2025-01-01T11:00:00Z')
    const bStart = new Date('2025-01-01T14:00:00Z')
    const bEnd = new Date('2025-01-01T15:00:00Z')
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
  })
})

describe('calculateEndsAt', () => {
  it('adds duration correctly', () => {
    const start = new Date('2025-01-01T10:00:00Z')
    const end = calculateEndsAt(start, 90)
    expect(end.getTime()).toBe(start.getTime() + 90 * 60 * 1000)
  })
})

import { getDayBounds, getMonthBounds, parseDateInput } from '../src/lib/dates'

describe('datas no fuso America/Bahia (UTC-3)', () => {
  it('"YYYY-MM-DD" vira meia-noite da Bahia, não de UTC', () => {
    expect(parseDateInput('2026-10-15').toISOString()).toBe('2026-10-15T03:00:00.000Z')
  })

  it('instantes com offset são respeitados', () => {
    expect(parseDateInput('2026-10-15T10:00:00-03:00').toISOString()).toBe('2026-10-15T13:00:00.000Z')
  })

  it('getDayBounds de uma data simples cobre o dia local inteiro (bug: pegava o dia anterior)', () => {
    const { start, end } = getDayBounds('2026-10-15')
    expect(start.toISOString()).toBe('2026-10-15T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-16T02:59:59.999Z')
  })

  it('um pagamento às 22h locais pertence ao mesmo dia', () => {
    const { start, end } = getDayBounds('2026-10-15')
    const pay = new Date('2026-10-15T22:00:00-03:00')
    expect(pay >= start && pay <= end).toBe(true)
  })

  it('getMonthBounds respeita o fuso', () => {
    const { start, end } = getMonthBounds('2026-02-10')
    expect(start.toISOString()).toBe('2026-02-01T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-01T02:59:59.999Z')
  })
})
