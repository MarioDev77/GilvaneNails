import { z } from 'zod'

/**
 * Horário de atendimento da agenda online.
 * - `week`: modelo semanal que se repete sozinho toda semana (índice 0 = domingo ... 6 = sábado; null = fechado).
 * - `overrides`: exceções feitas à mão para um dia específico ("YYYY-MM-DD"); null = fechado nesse dia.
 * Tudo fica dentro de Settings.openingHours (JSON que já existe): nenhuma tabela nova.
 */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido')

export const dayHoursSchema = z
  .object({
    start: hhmm,
    end: hhmm,
    breakStart: hhmm.optional(),
    breakEnd: hhmm.optional(),
  })
  .refine((d) => d.start < d.end, { message: 'O horário de fechar precisa ser depois do de abrir' })
  .refine(
    (d) => {
      if (!d.breakStart && !d.breakEnd) return true
      return !!d.breakStart && !!d.breakEnd && d.breakStart < d.breakEnd && d.breakStart >= d.start && d.breakEnd <= d.end
    },
    { message: 'O intervalo precisa ter início e fim, dentro do horário de atendimento' }
  )

export type DayHours = z.infer<typeof dayHoursSchema>

const dayOrClosed = dayHoursSchema.nullable()

export const scheduleSchema = z.object({
  week: z.array(dayOrClosed).length(7),
  overrides: z
    .record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'), dayOrClosed)
    .default({})
    .refine((o) => Object.keys(o).length <= 400, { message: 'Exceções demais cadastradas' }),
})

export type Schedule = z.infer<typeof scheduleSchema>

// Padrão: segunda a sábado, das 09:00 às 18:00.
const DEFAULT_DAY: DayHours = { start: '09:00', end: '18:00' }
export const DEFAULT_SCHEDULE: Schedule = {
  week: [null, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY],
  overrides: {},
}

// Formato antigo (um horário só para todos os dias): { start, end, days: [1..6] }
const legacySchema = z.object({
  start: hhmm,
  end: hhmm,
  days: z.array(z.number().int().min(0).max(6)).min(1),
})

/** Lê o que está salvo no banco (novo formato, formato antigo ou vazio) e sempre devolve um horário válido. */
export function parseSchedule(raw: unknown): Schedule {
  const current = scheduleSchema.safeParse(raw)
  if (current.success) return current.data
  const legacy = legacySchema.safeParse(raw)
  if (legacy.success) {
    const day: DayHours = { start: legacy.data.start, end: legacy.data.end }
    return { week: Array.from({ length: 7 }, (_, i) => (legacy.data.days.includes(i) ? day : null)), overrides: {} }
  }
  return DEFAULT_SCHEDULE
}

/** Dia da semana (0 = domingo) de uma data "YYYY-MM-DD". */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

/** Horário daquele dia: exceção manual se existir; senão o modelo semanal. null = fechado. */
export function hoursForDate(schedule: Schedule, date: string): DayHours | null {
  if (Object.prototype.hasOwnProperty.call(schedule.overrides, date)) return schedule.overrides[date]
  return schedule.week[weekdayOf(date)] ?? null
}

/** Remove exceções de datas que já passaram, para o JSON não crescer para sempre. */
export function pruneOverrides(schedule: Schedule, today: string): Schedule {
  const overrides = Object.fromEntries(Object.entries(schedule.overrides).filter(([d]) => d >= today))
  return { ...schedule, overrides }
}
