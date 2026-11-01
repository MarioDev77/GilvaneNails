import { describe, it, expect } from 'vitest'
import { rangesOverlap, calculateEndsAt, getDayBounds, getMonthBounds } from '../src/lib/dates'

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

describe('getDayBounds / getMonthBounds (America/Bahia, UTC-3)', () => {
  it('trata YYYY-MM-DD como o dia local, sem voltar um dia', () => {
    const { start, end } = getDayBounds('2026-10-16')
    expect(start.toISOString()).toBe('2026-10-16T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-17T02:59:59.999Z')
  })

  it('limites do mês a partir de data simples', () => {
    const { start, end } = getMonthBounds('2026-10-16')
    expect(start.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-01T02:59:59.999Z')
  })
})

describe('getDayBounds: dia local independe do fuso do servidor', () => {
  it('2026-11-03 vai de 00:00 a 23:59:59.999 da Bahia (03:00Z → 02:59:59.999Z do dia seguinte)', () => {
    const { start, end } = getDayBounds('2026-11-03')
    expect(start.toISOString()).toBe('2026-11-03T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-04T02:59:59.999Z')
  })
  it('dias consecutivos não se sobrepõem (mesmo horário em outro dia não entra no dia)', () => {
    const d1 = getDayBounds('2026-11-03')
    const d2 = getDayBounds('2026-11-04')
    const at14 = new Date('2026-11-03T17:00:00Z') // 14:00 da Bahia no dia 3
    expect(at14 >= d1.start && at14 <= d1.end).toBe(true)
    expect(at14 >= d2.start && at14 <= d2.end).toBe(false)
  })
})
