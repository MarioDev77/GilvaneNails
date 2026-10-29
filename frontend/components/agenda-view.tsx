'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, MessageCircle, MoreVertical, Pencil, Plus, Search, Trash2, Undo2, UserX, X, Ban, RotateCcw, CalendarPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDaysKey, formatBRL, formatDateKey, formatLongDate, moneyToInput, parseMoney, toDateKey, toISO, toTimeKey, todayKey, whatsappLink } from '@/lib/format'
import { APPT_STATUS, Btn, ConfirmDialog, Empty, Modal, Pill, inputCls, labelCls } from '@/components/ui-bits'
import { CloseDayPanel, METHODS } from '@/components/admin-finance'

type Row = Record<string, any>
type Api = (path: string, options?: RequestInit) => Promise<any>
type Notify = (text: string, kind?: 'ok' | 'error') => void
type Appt = {
  id: string
  startsAt: string
  endsAt: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  agreedPriceCents: number
  notes: string | null
  serviceId: string
  client: { id: string; name: string; phone: string }
  service: { id: string; name: string; durationMinutes: number }
}

const isOpen = (a: Appt) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED'
const ONLINE = '[Solicitação online]'
const cleanNotes = (n: string | null) => (n ?? '').replace(ONLINE, '').trim()
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function weekOf(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  const start = addDaysKey(key, -((dow + 6) % 7))
  return { start, days: Array.from({ length: 7 }, (_, i) => addDaysKey(start, i)) }
}

/* ============================================================ */
export default function AgendaView({ api, services, clients, notify, onChanged, newSignal }: { api: Api; services: Row[]; clients: Row[]; notify: Notify; onChanged: () => void; newSignal: number }) {
  const [mode, setMode] = useState<'day' | 'all'>('day')
  const [day, setDay] = useState(todayKey())
  const [items, setItems] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'done' | 'off'>('all')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<{ appt?: Appt; rebook?: Appt } | null>(null)
  const [askNext, setAskNext] = useState<Appt | null>(null)
  const [completing, setCompleting] = useState<Appt | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'cancel' | 'noshow' | 'reopen' | 'bulk'; appt?: Appt }>(null)
  const [closeDay, setCloseDay] = useState(false)
  const [version, setVersion] = useState(0)

  const week = useMemo(() => weekOf(day), [day])

  useEffect(() => { if (newSignal > 0) setForm({}) }, [newSignal])
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t) }, [query])
  useEffect(() => { setPage(1) }, [mode, filter, debounced])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        let path: string
        if (mode === 'day') {
          path = `/api/appointments?startDate=${week.start}&endDate=${week.days[6]}&limit=100`
        } else {
          const statuses = filter === 'open' ? '&statuses=SCHEDULED,CONFIRMED' : filter === 'done' ? '&statuses=COMPLETED' : filter === 'off' ? '&statuses=CANCELLED,NO_SHOW' : ''
          path = `/api/appointments?order=desc&limit=30&page=${page}${statuses}${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`
        }
        const r = await api(path)
        if (cancelled) return
        const list: Appt[] = Array.isArray(r) ? r : r?.items ?? []
        setTotalPages(r?.pagination?.totalPages ?? 1)
        setItems((prev) => (mode === 'all' && page > 1 ? [...prev, ...list.filter((x) => !prev.some((p) => p.id === x.id))] : list))
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Não foi possível carregar a agenda.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [api, mode, week.start, filter, debounced, page, version])

  const changed = () => { reload(); onChanged() }

  async function act(fn: () => Promise<any>, ok: string) {
    try {
      await fn()
      notify(ok)
      changed()
      return true
    } catch (e: any) {
      notify(e.message || 'Não foi possível concluir.', 'error')
      return false
    }
  }
  const setStatus = (a: Appt, status: string, ok: string) => act(() => api(`/api/appointments/${a.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }), ok)

  /* ---------- dados do modo "dia" ---------- */
  const countByDay = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of items) if (isOpen(a) || a.status === 'COMPLETED') m[toDateKey(a.startsAt)] = (m[toDateKey(a.startsAt)] ?? 0) + 1
    return m
  }, [items])
  const dayItems = useMemo(() => items.filter((a) => toDateKey(a.startsAt) === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [items, day])
  const dayActive = dayItems.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW')
  const dayTotal = dayActive.reduce((s, a) => s + a.agreedPriceCents, 0)
  const pendingCount = dayItems.filter(isOpen).length

  /* ---------- agrupar modo "todos" ---------- */
  const grouped = useMemo(() => {
    const g: { key: string; rows: Appt[] }[] = []
    for (const a of items) {
      const k = toDateKey(a.startsAt)
      const last = g[g.length - 1]
      if (last && last.key === k) last.rows.push(a)
      else g.push({ key: k, rows: [a] })
    }
    return g
  }, [items])

  async function bulkDelete() {
    const ids = [...selected]
    const res = await Promise.allSettled(ids.map((id) => api(`/api/appointments/${id}`, { method: 'DELETE' })))
    const ok = res.filter((r) => r.status === 'fulfilled').length
    const fail = ids.length - ok
    notify(fail ? `${ok} excluído(s). ${fail} não puderam ser excluídos.` : `${ok} agendamento(s) excluído(s).`, fail ? 'error' : 'ok')
    setSelected(new Set()); setSelecting(false); setConfirm(null); changed()
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const card = (a: Appt, showDate: boolean) => (
    <ApptCard key={a.id} a={a} showDate={showDate} selecting={selecting} checked={selected.has(a.id)} onToggle={() => toggle(a.id)}
      onComplete={() => setCompleting(a)} onRebook={() => setForm({ rebook: a })} onEdit={() => setForm({ appt: a })}
      onConfirmStatus={() => setStatus(a, 'CONFIRMED', 'Agendamento confirmado.')}
      onReactivate={() => setStatus(a, 'SCHEDULED', 'Horário reativado.')}
      onAsk={(kind) => setConfirm({ kind, appt: a })} />
  )

  return (
    <div className="pb-24 md:pb-0">
      {/* topo */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-line" role="tablist" aria-label="Modo de visualização">
          {([['day', 'Por dia', CalendarDays], ['all', 'Todos os registros', ClipboardList]] as const).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => { setMode(id); setSelecting(false); setSelected(new Set()) }}
              className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors', mode === id ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink')}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>
        <Btn size="lg" onClick={() => setForm({})} className="hidden sm:inline-flex"><Plus className="size-5" />Novo agendamento</Btn>
      </div>

      {mode === 'day' ? (
        <>
          {/* semana */}
          <div className="mb-4 rounded-3xl border border-line bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Btn variant="ghost" size="sm" aria-label="Semana anterior" onClick={() => setDay(addDaysKey(day, -7))}><ChevronLeft className="size-4" /></Btn>
              <div className="text-center">
                <p className="text-[15px] font-bold">{formatLongDate(day)}</p>
                <div className="mt-1 flex items-center justify-center gap-3">
                  <label className="text-xs text-ink-mute">
                    <span className="sr-only">Escolher data</span>
                    <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink-soft" />
                  </label>
                  {day !== todayKey() && <button onClick={() => setDay(todayKey())} className="text-xs font-bold text-brand-strong underline-offset-2 hover:underline">Ir para hoje</button>}
                </div>
              </div>
              <Btn variant="ghost" size="sm" aria-label="Próxima semana" onClick={() => setDay(addDaysKey(day, 7))}><ChevronRight className="size-4" /></Btn>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {week.days.map((k) => {
                const sel = k === day
                const n = countByDay[k] ?? 0
                return (
                  <button key={k} onClick={() => setDay(k)} aria-pressed={sel} aria-label={`${formatLongDate(k)}, ${n} atendimento(s)`}
                    className={cn('flex flex-col items-center rounded-2xl px-1 py-2 transition-colors', sel ? 'bg-brand text-white' : 'hover:bg-brand-soft', k === todayKey() && !sel && 'ring-1 ring-brand/40')}>
                    <span className={cn('text-[11px] font-medium', sel ? 'text-white/85' : 'text-ink-mute')}>{formatDateKey(k, { weekday: 'short' }).replace('.', '')}</span>
                    <span className="text-lg font-bold leading-6">{Number(k.slice(8))}</span>
                    <span className={cn('mt-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold', n === 0 ? 'opacity-0' : sel ? 'bg-white/25 text-white' : 'bg-brand-soft text-brand-strong')}>{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* resumo */}
          {dayItems.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-ink-soft">
              <p>
                <strong className="text-ink">{dayActive.length}</strong> {dayActive.length === 1 ? 'atendimento' : 'atendimentos'} · previsto <strong className="text-ink">{formatBRL(dayTotal)}</strong>
                {pendingCount > 0 && <> · <span className="font-semibold text-brand-strong">{pendingCount} em aberto</span></>}
              </p>
              {pendingCount > 0 && <button onClick={() => setCloseDay((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-strong hover:underline"><CheckCheck className="size-4" />{closeDay ? 'Esconder' : 'Fechar o dia'}</button>}
            </div>
          )}
          {closeDay && <CloseDayPanel api={api} onDone={changed} notify={notify} fail={(m) => notify(m, 'error')} />}

          {error ? <ErrorCard text={error} onRetry={reload} /> : loading && items.length === 0 ? <Skeleton /> : dayItems.length === 0 ? (
            <Empty icon={CalendarDays} title="Nenhum horário neste dia" text="Toque em “Novo agendamento” para marcar o primeiro atendimento." action={<Btn size="lg" onClick={() => setForm({})}><Plus className="size-5" />Novo agendamento</Btn>} />
          ) : (
            <div className="space-y-3">{dayItems.map((a) => card(a, false))}</div>
          )}
        </>
      ) : (
        <>
          {/* busca e filtros */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cliente, serviço ou observação" className={cn(inputCls, 'pl-10')} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {([['all', 'Todos'], ['open', 'Em aberto'], ['done', 'Concluídos'], ['off', 'Cancelados e faltas']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
                    className={cn('h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors', filter === id ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-line hover:ring-ink-mute')}>{label}</button>
                ))}
              </div>
              <Btn variant={selecting ? 'soft' : 'outline'} size="sm" onClick={() => { setSelecting((v) => !v); setSelected(new Set()) }}>
                {selecting ? <><X className="size-4" />Sair da seleção</> : <><Check className="size-4" />Selecionar para excluir</>}
              </Btn>
            </div>
          </div>

          {error ? <ErrorCard text={error} onRetry={reload} /> : loading && items.length === 0 ? <Skeleton /> : items.length === 0 ? (
            <Empty icon={ClipboardList} title="Nenhum registro encontrado" text={debounced || filter !== 'all' ? 'Tente outra busca ou outro filtro.' : 'Os agendamentos aparecem aqui.'} />
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => (
                <section key={g.key}>
                  <h3 className="mb-2 px-1 text-sm font-bold text-ink-soft">{formatLongDate(g.key)} <span className="font-normal text-ink-mute">· {formatDateKey(g.key)}</span></h3>
                  <div className="space-y-3">{g.rows.map((a) => card(a, false))}</div>
                </section>
              ))}
              {page < totalPages && <div className="flex justify-center"><Btn variant="outline" size="lg" loading={loading} onClick={() => setPage((p) => p + 1)}>Carregar mais</Btn></div>}
            </div>
          )}
        </>
      )}

      {/* barra de seleção */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-40 flex justify-center px-4 md:bottom-6 md:left-64">
          <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-xl">
            <span className="text-sm font-semibold">{selected.size} selecionado(s)</span>
            <Btn variant="danger" size="sm" disabled={selected.size === 0} onClick={() => setConfirm({ kind: 'bulk' })}><Trash2 className="size-4" />Excluir</Btn>
          </div>
        </div>
      )}

      {/* botão flutuante (celular) */}
      {!selecting && (
        <button onClick={() => setForm({})} aria-label="Novo agendamento" className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand-strong sm:hidden">
          <Plus className="size-6" />
        </button>
      )}

      {form && <ApptForm api={api} services={services} clients={clients} appt={form.appt} rebook={form.rebook} defaultDate={mode === 'day' ? day : todayKey()} onClose={() => setForm(null)} onSaved={(d) => { setForm(null); notify(form.appt ? 'Agendamento atualizado.' : 'Agendamento criado.'); if (d) setDay(d); setMode('day'); changed() }} />}
      {completing && <CompleteModal appt={completing} onClose={() => setCompleting(null)} onDone={async (method, cents) => { const ok = await act(() => api(`/api/appointments/${completing.id}/complete`, { method: 'POST', body: JSON.stringify({ method, amountCents: cents }) }), 'Atendimento concluído. O valor já está no saldo.'); if (ok) { setAskNext(completing); setCompleting(null) } }} />}
      {askNext && (
        <Modal title="Atendimento concluído" subtitle={`${askNext.client.name} · ${askNext.service.name}`} onClose={() => setAskNext(null)}
          footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn variant="outline" size="lg" onClick={() => setAskNext(null)}>Agora não</Btn><Btn size="lg" data-autofocus onClick={() => { setForm({ rebook: askNext }); setAskNext(null) }}><CalendarPlus className="size-5" />Agendar a próxima visita</Btn></div>}>
          <p className="text-[15px] leading-6 text-ink-soft">Quer já deixar marcada a próxima visita de <strong className="text-ink">{askNext.client.name}</strong>? Ela abre com o mesmo serviço, valor e horário.</p>
        </Modal>
      )}

      {confirm?.kind === 'delete' && confirm.appt && (
        <ConfirmDialog danger title="Excluir este agendamento?" confirmLabel="Excluir de vez" onClose={() => setConfirm(null)}
          text={<><p><strong className="text-ink">{confirm.appt.client.name}</strong> · {confirm.appt.service.name}<br />{formatDateKey(toDateKey(confirm.appt.startsAt))} às {toTimeKey(confirm.appt.startsAt)}</p><p className="mt-2">Ele some do sistema e não dá para desfazer. Se só quer liberar o horário, use <strong>Cancelar horário</strong>.</p></>}
          onConfirm={async () => { await act(() => api(`/api/appointments/${confirm.appt!.id}`, { method: 'DELETE' }), 'Agendamento excluído.'); setConfirm(null) }} />
      )}
      {confirm?.kind === 'bulk' && (
        <ConfirmDialog danger title={`Excluir ${selected.size} agendamento(s)?`} confirmLabel="Excluir selecionados" onClose={() => setConfirm(null)}
          text="Eles somem do sistema e não dá para desfazer. Atendimentos já concluídos não podem ser excluídos por aqui." onConfirm={bulkDelete} />
      )}
      {confirm?.kind === 'cancel' && confirm.appt && (
        <ConfirmDialog danger title="Cancelar este horário?" confirmLabel="Cancelar horário" onClose={() => setConfirm(null)}
          text={`${confirm.appt.client.name} às ${toTimeKey(confirm.appt.startsAt)}. O horário fica livre para outra cliente e o registro continua na lista como “Cancelado”.`}
          onConfirm={async () => { await setStatus(confirm.appt!, 'CANCELLED', 'Horário cancelado.'); setConfirm(null) }} />
      )}
      {confirm?.kind === 'noshow' && confirm.appt && (
        <ConfirmDialog title="Marcar como falta?" confirmLabel="Marcar falta" onClose={() => setConfirm(null)}
          text={`${confirm.appt.client.name} não compareceu às ${toTimeKey(confirm.appt.startsAt)}. O horário fica livre.`}
          onConfirm={async () => { await setStatus(confirm.appt!, 'NO_SHOW', 'Falta registrada.'); setConfirm(null) }} />
      )}
      {confirm?.kind === 'reopen' && confirm.appt && (
        <ConfirmDialog title="Desfazer conclusão?" confirmLabel="Desfazer conclusão" onClose={() => setConfirm(null)}
          text="O atendimento volta para “Confirmado” e o valor recebido sai do saldo. Depois disso você pode editar ou excluir."
          onConfirm={async () => { await act(() => api(`/api/appointments/${confirm.appt!.id}/reopen`, { method: 'POST', body: '{}' }), 'Conclusão desfeita.'); setConfirm(null) }} />
      )}
    </div>
  )
}

/* ============================================================ */
function ApptCard({ a, showDate, selecting, checked, onToggle, onComplete, onRebook, onEdit, onConfirmStatus, onReactivate, onAsk }: {
  a: Appt; showDate: boolean; selecting: boolean; checked: boolean; onToggle: () => void
  onComplete: () => void; onRebook: () => void; onEdit: () => void; onConfirmStatus: () => void; onReactivate: () => void
  onAsk: (k: 'delete' | 'cancel' | 'noshow' | 'reopen') => void
}) {
  const [menu, setMenu] = useState(false)
  const st = APPT_STATUS[a.status]
  const open = isOpen(a)
  const dim = a.status === 'CANCELLED' || a.status === 'NO_SHOW'
  const note = cleanNotes(a.notes)
  const online = (a.notes ?? '').startsWith(ONLINE)
  const locked = a.status === 'COMPLETED'

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [menu])

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-paper'
  return (
    <article className={cn('rounded-3xl border bg-white p-4 transition-colors', checked ? 'border-brand ring-2 ring-brand/20' : 'border-line', dim && 'bg-[#fcf9f9]')}
      onClick={selecting && !locked ? onToggle : undefined}>
      <div className="flex items-start gap-3.5">
        {selecting && (
          <input type="checkbox" checked={checked} disabled={locked} onChange={onToggle} onClick={(e) => e.stopPropagation()} aria-label={`Selecionar ${a.client.name}`} className="mt-2 size-5 shrink-0 accent-[#c94f6c] disabled:opacity-30" />
        )}
        <div className="w-[3.75rem] shrink-0 text-center">
          <p className={cn('text-xl font-bold leading-6', dim && 'text-ink-mute line-through decoration-1')}>{toTimeKey(a.startsAt)}</p>
          <p className="mt-0.5 text-[11px] text-ink-mute">até {toTimeKey(a.endsAt)}</p>
        </div>
        <div className="w-px self-stretch bg-line" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn('truncate text-base font-bold', dim && 'text-ink-soft')}>{a.client.name}</p>
            <Pill tone={st.tone}>{st.label}</Pill>
            {online && <Pill tone="gray">Pedido online</Pill>}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{a.service.name} · {a.service.durationMinutes} min</p>
          {showDate && <p className="text-xs text-ink-mute">{formatDateKey(toDateKey(a.startsAt))}</p>}
          {note && <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-mute">“{note}”</p>}
        </div>
        <p className={cn('shrink-0 text-base font-bold', dim && 'text-ink-mute')}>{formatBRL(a.agreedPriceCents)}</p>
      </div>

      {!selecting && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-line pt-3.5">
          {open && <Btn variant="success" size="sm" onClick={onComplete}><CheckCheck className="size-4" />Concluir</Btn>}
          {a.status === 'SCHEDULED' && <Btn variant="soft" size="sm" onClick={onConfirmStatus}><Check className="size-4" />Confirmar</Btn>}
          {dim && <Btn variant="soft" size="sm" onClick={onReactivate}><RotateCcw className="size-4" />Reativar</Btn>}
          {locked && <Btn variant="soft" size="sm" onClick={onRebook}><CalendarPlus className="size-4" />Agendar de novo</Btn>}
          {locked && <span className="hidden text-[13px] text-ink-mute sm:inline">Valor lançado no financeiro</span>}
          <div className="ml-auto flex items-center gap-1">
            {open && a.client.phone && (
              <a href={whatsappLink(a.client.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${a.client.name}`} className="flex size-9 items-center justify-center rounded-xl text-ok hover:bg-ok-soft"><MessageCircle className="size-[18px]" /></a>
            )}
            {open && <Btn variant="ghost" size="sm" aria-label="Editar" onClick={onEdit} className="!px-2.5"><Pencil className="size-4" /></Btn>}
            <div className="relative">
              <button aria-label="Mais ações" aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu((v) => !v) }} className="flex size-9 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-soft hover:text-brand-strong"><MoreVertical className="size-[18px]" /></button>
              {menu && (
                <div role="menu" className="absolute bottom-full right-0 z-20 mb-1 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                  {open && <button role="menuitem" className={item} onClick={() => onAsk('noshow')}><UserX className="size-4 text-warn" />Marcar falta</button>}
                  {open && <button role="menuitem" className={item} onClick={() => onAsk('cancel')}><Ban className="size-4 text-bad" />Cancelar horário</button>}
                  {locked && <button role="menuitem" className={item} onClick={() => onAsk('reopen')}><Undo2 className="size-4 text-brand" />Desfazer conclusão</button>}
                  {!locked && <button role="menuitem" className={cn(item, 'text-bad')} onClick={() => onAsk('delete')}><Trash2 className="size-4" />Excluir de vez</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

/* ============================================================ */
function CompleteModal({ appt, onClose, onDone }: { appt: Appt; onClose: () => void; onDone: (method: string, cents: number) => Promise<void> }) {
  const [amount, setAmount] = useState(moneyToInput(appt.agreedPriceCents))
  const [method, setMethod] = useState('PIX')
  const [busy, setBusy] = useState(false)
  const cents = parseMoney(amount)
  return (
    <Modal title="Concluir atendimento" subtitle={`${appt.client.name} · ${appt.service.name}`} onClose={onClose}
      footer={<Btn variant="success" size="lg" className="w-full" loading={busy} disabled={cents === null} onClick={async () => { setBusy(true); try { await onDone(method, cents!) } finally { setBusy(false) } }}><CheckCheck className="size-5" />Concluir e lançar {cents !== null ? formatBRL(cents) : ''} no saldo</Btn>}>
      <div className="space-y-5">
        <div>
          <label className={labelCls} htmlFor="rec">Valor recebido (R$)</label>
          <input id="rec" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          <p className="mt-1.5 text-xs text-ink-mute">Combinado: {formatBRL(appt.agreedPriceCents)}. Se recebeu menos ou mais, ajuste o valor.</p>
        </div>
        <div>
          <p className={labelCls}>Forma de pagamento</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} aria-pressed={method === m.value}
                className={cn('h-11 rounded-xl text-sm font-semibold ring-1 transition-colors', method === m.value ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-line hover:ring-ink-mute')}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================ */
function rebookDate(from: Appt, days: number) {
  const d = addDaysKey(toDateKey(from.startsAt), days)
  return d < todayKey() ? addDaysKey(todayKey(), days) : d
}

function ApptForm({ api, services, clients, appt, rebook, defaultDate, onClose, onSaved }: { api: Api; services: Row[]; clients: Row[]; appt?: Appt; rebook?: Appt; defaultDate: string; onClose: () => void; onSaved: (day?: string) => void }) {
  const activeServices = services.filter((s) => s.isActive !== false || s.id === (appt ?? rebook)?.serviceId)
  const [name, setName] = useState((appt ?? rebook)?.client.name ?? '')
  const [phone, setPhone] = useState('')
  const [serviceId, setServiceId] = useState((appt ?? rebook)?.serviceId ?? '')
  const [date, setDate] = useState(appt ? toDateKey(appt.startsAt) : rebook ? rebookDate(rebook, 14) : defaultDate)
  const [time, setTime] = useState(appt ? toTimeKey(appt.startsAt) : rebook ? toTimeKey(rebook.startsAt) : '')
  const [price, setPrice] = useState(appt ? moneyToInput(appt.agreedPriceCents) : rebook ? moneyToInput(rebook.agreedPriceCents) : '')
  const [notes, setNotes] = useState(cleanNotes(appt?.notes ?? ''))
  const [confirmed, setConfirmed] = useState(appt?.status === 'CONFIRMED')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dayAppts, setDayAppts] = useState<Appt[] | null>(null)

  const service = activeServices.find((s) => s.id === serviceId)
  const duration: number = service?.durationMinutes ?? appt?.service.durationMinutes ?? 60
  const known = clients.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())

  // Horários já ocupados no dia escolhido (para avisar na hora, antes de salvar)
  useEffect(() => {
    let off = false
    setDayAppts(null)
    api(`/api/appointments?startDate=${date}&endDate=${date}&limit=100&statuses=SCHEDULED,CONFIRMED`)
      .then((r) => { if (!off) setDayAppts((Array.isArray(r) ? r : r?.items ?? []).filter((x: Appt) => x.id !== appt?.id)) })
      .catch(() => { if (!off) setDayAppts([]) })
    return () => { off = true }
  }, [api, date, appt?.id])

  const busyRanges = useMemo(() => (dayAppts ?? []).map((x) => ({ s: minutes(toTimeKey(x.startsAt)), e: minutes(toTimeKey(x.endsAt)) || 1440, who: x.client.name })).sort((a, b) => a.s - b.s), [dayAppts])
  const clash = (start: number) => busyRanges.find((r) => start < r.e && start + duration > r.s)
  const chosen = time ? clash(minutes(time)) : undefined
  const nowMin = date === todayKey() ? minutes(toTimeKey(new Date())) : -1
  const freeTimes = useMemo(() => { const out: string[] = []; for (let m = 8 * 60; m <= 19 * 60; m += 30) if (m > nowMin && !clash(m)) out.push(hhmm(m)); return out }, [busyRanges, duration, nowMin]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickService(id: string) {
    setServiceId(id)
    const s = activeServices.find((x) => x.id === id)
    if (s) setPrice(moneyToInput(s.priceCents))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError('Informe o nome da cliente.')
    if (!serviceId) return setError('Escolha o serviço.')
    if (!time) return setError('Escolha o horário.')
    const cents = parseMoney(price)
    if (cents === null) return setError('Informe um valor válido.')
    setBusy(true)
    try {
      const sameClient = rebook && name.trim().toLowerCase() === rebook.client.name.trim().toLowerCase()
      const base: Row = { ...(sameClient ? { clientId: rebook!.client.id } : { clientName: name.trim() }), serviceId, startsAt: toISO(date, time), agreedPriceCents: cents, notes: notes.trim() || null }
      if (appt) await api(`/api/appointments/${appt.id}`, { method: 'PATCH', body: JSON.stringify({ ...base, status: confirmed ? 'CONFIRMED' : 'SCHEDULED' }) })
      else await api('/api/appointments', { method: 'POST', body: JSON.stringify({ ...base, ...(phone.trim() && !known ? { clientPhone: phone.trim() } : {}), status: confirmed ? 'CONFIRMED' : 'SCHEDULED' }) })
      onSaved(date)
    } catch (err: any) {
      setError(err.message || 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={appt ? 'Editar agendamento' : rebook ? 'Agendar de novo' : 'Novo agendamento'} subtitle={rebook && !appt ? `Próxima visita de ${rebook.client.name}` : undefined} onClose={onClose}
      footer={<Btn type="submit" form="appt-form" size="lg" className="w-full" loading={busy} disabled={!!chosen}>{appt ? 'Salvar alterações' : 'Agendar'}</Btn>}>
      <form id="appt-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="c-name">Cliente</label>
          <input id="c-name" list="clients-list" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da cliente" className={inputCls} />
          <datalist id="clients-list">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          {name.trim().length >= 2 && !known && !appt && <p className="mt-1.5 text-xs text-ink-mute">Cliente nova: será cadastrada automaticamente.</p>}
        </div>
        {!appt && name.trim().length >= 2 && !known && (
          <div>
            <label className={labelCls} htmlFor="c-phone">WhatsApp (opcional)</label>
            <input id="c-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(75) 90000-0000" className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="c-service">Serviço</label>
          <select id="c-service" value={serviceId} onChange={(e) => pickService(e.target.value)} className={inputCls}>
            <option value="">Selecione…</option>
            {activeServices.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatBRL(s.priceCents)} · {s.durationMinutes} min</option>)}
          </select>
        </div>
        {rebook && !appt && (
          <div>
            <p className={labelCls}>Voltar em</p>
            <div className="flex flex-wrap gap-1.5">
              {([['1 semana', 7], ['2 semanas', 14], ['3 semanas', 21], ['1 mês', 30]] as const).map(([label, n]) => (
                <button key={n} type="button" onClick={() => setDate(rebookDate(rebook, n))} aria-pressed={date === rebookDate(rebook, n)}
                  className={cn('h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors', date === rebookDate(rebook, n) ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-line hover:ring-ink-mute')}>{label}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="c-date">Data</label>
            <input id="c-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="c-time">Horário</label>
            <input id="c-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputCls, chosen && 'border-bad focus:border-bad focus:ring-bad/10')} />
          </div>
        </div>

        {/* disponibilidade do dia */}
        <div className="rounded-2xl bg-paper p-3.5">
          {chosen ? (
            <p role="alert" className="text-sm font-medium text-bad">Esse horário está ocupado por {chosen.who} ({hhmm(chosen.s)}–{hhmm(chosen.e)}). Escolha outro.</p>
          ) : (
            <p className="text-sm text-ink-soft">{dayAppts === null ? 'Conferindo a agenda do dia…' : time ? `Horário livre em ${formatDateKey(date)}.` : 'Toque em um horário livre ou digite acima.'}</p>
          )}
          {dayAppts !== null && freeTimes.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {freeTimes.map((t) => (
                <button key={t} type="button" onClick={() => setTime(t)} aria-pressed={time === t} className={cn('h-8 rounded-full px-3 text-[13px] font-semibold ring-1 transition-colors', time === t ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-line hover:ring-brand')}>{t}</button>
              ))}
            </div>
          )}
          {busyRanges.length > 0 && <p className="mt-2.5 text-xs text-ink-mute">Já marcado: {busyRanges.map((r) => `${hhmm(r.s)}–${hhmm(r.e)} ${r.who}`).join(' · ')}</p>}
          {dayAppts !== null && busyRanges.length === 0 && <p className="mt-2.5 text-xs text-ink-mute">Nenhum atendimento marcado neste dia.</p>}
        </div>

        <div>
          <label className={labelCls} htmlFor="c-price">Valor combinado (R$)</label>
          <input id="c-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="c-notes">Observações (opcional)</label>
          <textarea id="c-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'h-auto py-3')} />
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-5 accent-[#c94f6c]" />
          Cliente já confirmou presença
        </label>
        {error && <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm font-medium text-bad">{error}</p>}
      </form>
    </Modal>
  )
}

/* ---------- pequenos ---------- */
function Skeleton() {
  return <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white ring-1 ring-line" />)}</div>
}
function ErrorCard({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-bad/20 bg-bad-soft p-6 text-center">
      <p className="text-sm font-medium text-bad">{text}</p>
      <Btn variant="outline" size="sm" className="mt-3" onClick={onRetry}>Tentar de novo</Btn>
    </div>
  )
}
