import { describe, it, expect } from 'vitest'
import { findOverlap, conflictMessage } from '../src/lib/conflicts'

const at = (iso: string) => new Date(iso)

describe('findOverlap', () => {
  const today = { startsAt: at('2026-10-29T17:00:00Z'), endsAt: at('2026-10-29T18:00:00Z'), client: { name: 'Jô' } }

  it('mesmo horário em OUTRO dia não conflita', () => {
    expect(findOverlap(at('2026-10-30T17:00:00Z'), at('2026-10-30T18:00:00Z'), [today])).toBeUndefined()
  })
  it('mesmo horário no mesmo dia conflita', () => {
    expect(findOverlap(at('2026-10-29T17:00:00Z'), at('2026-10-29T18:00:00Z'), [today])).toBe(today)
  })
  it('um logo depois do outro (encostando) é permitido', () => {
    expect(findOverlap(at('2026-10-29T18:00:00Z'), at('2026-10-29T19:00:00Z'), [today])).toBeUndefined()
  })
})

describe('conflictMessage', () => {
  it('diz quem, dia e horas (fuso da Bahia)', () => {
    const msg = conflictMessage({ startsAt: at('2026-10-29T17:00:00Z'), endsAt: at('2026-10-29T18:30:00Z'), client: { name: 'Jô' } })
    expect(msg).toContain('Jô')
    expect(msg).toContain('29/10')
    expect(msg).toContain('14:00')
    expect(msg).toContain('15:30')
  })
})
