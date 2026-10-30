'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarOff, Check, Copy, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDaysKey, formatDateKey, todayKey } from '@/lib/format'
import { Btn, inputCls } from '@/components/ui-bits'

type Day = { start: string; end: string; breakStart?: string; breakEnd?: string } | null
type Schedule = { week: Day[]; overrides: Record<string, Day> }
type Api = (path: string, options?: RequestInit) => Promise<any>

const DAYS: { idx: number; label: string }[] = [
  { idx: 1, label: 'Segunda-feira' }, { idx: 2, label: 'Terça-feira' }, { idx: 3, label: 'Quarta-feira' },
  { idx: 4, label: 'Quinta-feira' }, { idx: 5, label: 'Sexta-feira' }, { idx: 6, label: 'Sábado' }, { idx: 0, label: 'Domingo' },
]
const NEW_DAY = { start: '09:00', end: '18:00' }

/** Mensagem de erro para um dia, ou null se estiver certo. */
function check(d: NonNullable<Day>): string | null {
  if (!d.start || !d.end) return 'Preencha o horário de abrir e de fechar.'
  if (d.start >= d.end) return 'O horário de fechar precisa ser depois do de abrir.'
  if (d.breakStart || d.breakEnd) {
    if (!d.breakStart || !d.breakEnd) return 'Preencha o início e o fim do intervalo.'
    if (d.breakStart >= d.breakEnd) return 'O fim do intervalo precisa ser depois do início.'
    if (d.breakStart < d.start || d.breakEnd > d.end) return 'O intervalo precisa estar dentro do horário de atendimento.'
  }
  return null
}
const summary = (d: Day) => (!d ? 'Fechado' : `${d.start}–${d.end}${d.breakStart ? ` · intervalo ${d.breakStart}–${d.breakEnd}` : ''}`)

function Times({ value, onChange }: { value: NonNullable<Day>; onChange: (d: NonNullable<Day>) => void }) {
  const hasBreak = value.breakStart !== undefined
  const set = (k: 'start' | 'end' | 'breakStart' | 'breakEnd', v: string) => onChange({ ...value, [k]: v })
  const err = check(value)
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-ink-soft">Abre<input type="time" value={value.start} onChange={(e) => set('start', e.target.value)} className={cn(inputCls, 'mt-1')} /></label>
        <label className="text-xs font-medium text-ink-soft">Fecha<input type="time" value={value.end} onChange={(e) => set('end', e.target.value)} className={cn(inputCls, 'mt-1')} /></label>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" checked={hasBreak} className="size-5 accent-[#c94f6c]"
          onChange={(e) => onChange(e.target.checked ? { ...value, breakStart: '12:00', breakEnd: '13:00' } : { start: value.start, end: value.end })} />
        Pausa para o almoço
      </label>
      {hasBreak && (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-ink-soft">Pausa começa<input type="time" value={value.breakStart ?? ''} onChange={(e) => set('breakStart', e.target.value)} className={cn(inputCls, 'mt-1')} /></label>
          <label className="text-xs font-medium text-ink-soft">Pausa termina<input type="time" value={value.breakEnd ?? ''} onChange={(e) => set('breakEnd', e.target.value)} className={cn(inputCls, 'mt-1')} /></label>
        </div>
      )}
      {err && <p role="alert" className="text-sm font-medium text-bad">{err}</p>}
    </div>
  )
}

export default function ScheduleSettings({ api, notify }: { api: Api; notify: (t: string, k?: 'ok' | 'error') => void }) {
  const [sch, setSch] = useState<Schedule | null>(null)
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  // formulário de exceção por data
  const [exDate, setExDate] = useState('')
  const [exClosed, setExClosed] = useState(true)
  const [exDay, setExDay] = useState<NonNullable<Day>>(NEW_DAY)

  useEffect(() => {
    api('/api/settings')
      .then((s) => { setSch(s.openingHours); setSaved(JSON.stringify(s.openingHours)) })
      .catch((e) => setLoadError(e.message || 'Não foi possível carregar os horários.'))
  }, [api])

  const today = todayKey()
  const upcoming = useMemo(() => Object.entries(sch?.overrides ?? {}).filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b)), [sch, today])
  const dirty = sch !== null && JSON.stringify(sch) !== saved

  if (loadError) return <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{loadError}</p>
  if (!sch) return <div className="h-40 animate-pulse rounded-3xl bg-white ring-1 ring-line" />

  const setWeek = (idx: number, d: Day) => setSch({ ...sch, week: sch.week.map((x, i) => (i === idx ? d : x)) })
  const copyToAll = (from: NonNullable<Day>) => setSch({ ...sch, week: sch.week.map((x) => (x ? { ...from } : x)) })

  function addException() {
    if (!exDate) return notify('Escolha a data da exceção.', 'error')
    if (exDate < today) return notify('Essa data já passou.', 'error')
    if (!exClosed) { const e = check(exDay); if (e) return notify(e, 'error') }
    setSch({ ...sch!, overrides: { ...sch!.overrides, [exDate]: exClosed ? null : { ...exDay } } })
    setExDate('')
  }
  const removeException = (d: string) => { const o = { ...sch!.overrides }; delete o[d]; setSch({ ...sch!, overrides: o }) }

  async function save() {
    for (const d of DAYS) {
      const day = sch!.week[d.idx]
      const e = day && check(day)
      if (e) return notify(`${d.label}: ${e}`, 'error')
    }
    if (!sch!.week.some(Boolean)) return notify('Deixe pelo menos um dia aberto na semana.', 'error')
    setBusy(true)
    try {
      const r = await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ openingHours: sch }) })
      setSch(r.openingHours); setSaved(JSON.stringify(r.openingHours))
      notify('Horários salvos. A agenda online já usa os novos horários.')
    } catch (e: any) { notify(e.message || 'Não foi possível salvar.', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-white p-5">
        <h2 className="font-bold">Horário de atendimento</h2>
        <p className="mt-1 text-sm text-ink-mute">Configure a semana uma vez: ela se repete sozinha toda semana. Os horários de cada dia voltam livres automaticamente, só ficam ocupados os que já foram marcados.</p>
        <div className="mt-4 space-y-3">
          {DAYS.map(({ idx, label }) => {
            const day = sch.week[idx]
            return (
              <div key={idx} className={cn('rounded-2xl border p-4', day ? 'border-line' : 'border-line bg-paper')}>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-3 font-semibold">
                    <input type="checkbox" checked={!!day} onChange={(e) => setWeek(idx, e.target.checked ? { ...NEW_DAY } : null)} className="size-5 accent-[#c94f6c]" />
                    {label}
                  </label>
                  {day ? <button type="button" onClick={() => copyToAll(day)} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong hover:underline"><Copy className="size-3.5" />Usar em todos os dias abertos</button> : <span className="text-sm text-ink-mute">Fechado</span>}
                </div>
                {day && <Times value={day} onChange={(d) => setWeek(idx, d)} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-bold"><CalendarOff className="size-4 text-brand" />Mudar um dia específico</h2>
        <p className="mt-1 text-sm text-ink-mute">Folga, feriado ou horário diferente só numa data. Vale só para aquele dia; a semana continua igual.</p>
        <div className="mt-4 space-y-3">
          <input type="date" aria-label="Data da exceção" value={exDate} min={today} max={addDaysKey(today, 365)} onChange={(e) => setExDate(e.target.value)} className={inputCls} />
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" checked={exClosed} onChange={(e) => setExClosed(e.target.checked)} className="size-5 accent-[#c94f6c]" />
            Fechado o dia todo
          </label>
          {!exClosed && <Times value={exDay} onChange={setExDay} />}
          <Btn variant="soft" onClick={addException}><Plus className="size-4" />Adicionar exceção</Btn>
        </div>
        {upcoming.length > 0 && (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {upcoming.map(([d, day]) => (
              <li key={d} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{formatDateKey(d, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  <p className={cn('text-ink-soft', !day && 'text-bad')}>{summary(day)}</p>
                </div>
                <button type="button" aria-label="Remover exceção" onClick={() => removeException(d)} className="flex size-9 items-center justify-center rounded-xl text-ink-soft hover:bg-bad-soft hover:text-bad"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dirty ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-2 pl-4 shadow-lg">
            <p className="min-w-0 text-sm font-medium text-ink-soft">Você mudou os horários</p>
            <Btn size="md" className="shrink-0" loading={busy} onClick={save}>Salvar horários</Btn>
          </div>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-ok"><Check className="size-4" />Horários salvos</p>
      )}
    </div>
  )
}
