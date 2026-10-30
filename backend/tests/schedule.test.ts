import { describe, it, expect } from 'vitest'
import { DEFAULT_SCHEDULE, hoursForDate, parseSchedule, pruneOverrides, scheduleSchema } from '../src/lib/schedule'

// 2026-11-02 é segunda-feira; 2026-11-01 é domingo
describe('horário de atendimento', () => {
  it('padrão: segunda a sábado 13–19, domingo fechado', () => {
    expect(hoursForDate(DEFAULT_SCHEDULE, '2026-11-02')).toEqual({ start: '13:00', end: '19:00' })
    expect(hoursForDate(DEFAULT_SCHEDULE, '2026-11-01')).toBeNull()
  })
  it('o modelo semanal se repete em todas as semanas', () => {
    expect(hoursForDate(DEFAULT_SCHEDULE, '2026-11-09')).toEqual(hoursForDate(DEFAULT_SCHEDULE, '2026-11-02'))
  })
  it('exceção manual vale só naquele dia (fechado ou outro horário)', () => {
    const s = { ...DEFAULT_SCHEDULE, overrides: { '2026-11-02': null, '2026-11-03': { start: '08:00', end: '12:00' } } }
    expect(hoursForDate(s, '2026-11-02')).toBeNull()
    expect(hoursForDate(s, '2026-11-03')).toEqual({ start: '08:00', end: '12:00' })
    expect(hoursForDate(s, '2026-11-09')).toEqual({ start: '13:00', end: '19:00' })
  })
  it('lê o formato antigo { start, end, days }', () => {
    const s = parseSchedule({ start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5] })
    expect(hoursForDate(s, '2026-11-02')).toEqual({ start: '08:00', end: '17:00' })
    expect(hoursForDate(s, '2026-11-07')).toBeNull() // sábado
  })
  it('vazio ou lixo cai no padrão', () => {
    expect(parseSchedule(null)).toEqual(DEFAULT_SCHEDULE)
    expect(parseSchedule({ x: 1 })).toEqual(DEFAULT_SCHEDULE)
  })
  it('valida fechar depois de abrir e intervalo dentro do expediente', () => {
    const week = (d: any) => ({ week: [null, d, null, null, null, null, null] })
    expect(scheduleSchema.safeParse(week({ start: '18:00', end: '09:00' })).success).toBe(false)
    expect(scheduleSchema.safeParse(week({ start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' })).success).toBe(true)
    expect(scheduleSchema.safeParse(week({ start: '09:00', end: '12:00', breakStart: '12:00', breakEnd: '13:00' })).success).toBe(false)
    expect(scheduleSchema.safeParse(week({ start: '09:00', end: '18:00', breakStart: '12:00' })).success).toBe(false)
  })
  it('apaga exceções de datas que já passaram', () => {
    const s = { ...DEFAULT_SCHEDULE, overrides: { '2026-10-01': null, '2026-11-02': null } }
    expect(Object.keys(pruneOverrides(s, '2026-10-29').overrides)).toEqual(['2026-11-02'])
  })
})
