'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCheck, Undo2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Row = Record<string, any>
type Api = (path: string, options?: RequestInit) => Promise<any>

export const money = (c: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((c || 0) / 100)

export const METHODS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'DEBIT_CARD', label: 'Débito' },
  { value: 'CREDIT_CARD', label: 'Crédito' },
  { value: 'OTHER', label: 'Outro' },
]
const methodLabel = (m?: string | null) => METHODS.find((x) => x.value === m)?.label ?? '—'

const pad = (n: number) => String(n).padStart(2, '0')
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const brDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : s
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateTimeOf = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const toCents = (v: string) => Math.round(Number(String(v).replace(',', '.')) * 100)

const card = 'rounded-2xl border border-[#f2e4e8] bg-white'
const inputCls =
  'rounded-xl border border-[#ead9de] bg-white px-3 py-2 text-sm text-[#39252b] outline-none focus:border-[#d85f7b]'
const primaryBtn = 'rounded-xl bg-[#d85f7b] text-white hover:bg-[#c94f6c]'

/* ------------------------------------------------------------------ */
/* Fechar o dia: conclui os atendimentos e lança o valor no saldo      */
/* ------------------------------------------------------------------ */
export function CloseDayPanel({
  api,
  onDone,
  notify,
  fail,
}: {
  api: Api
  onDone: () => void
  notify: (m: string) => void
  fail: (m: string) => void
}) {
  const [date, setDate] = useState(toDateStr(new Date()))
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [methods, setMethods] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api(`/api/appointments?startDate=${date}&endDate=${date}&limit=100`)
      const list: Row[] = Array.isArray(r) ? r : r?.items || []
      setItems(list)
      const open = list.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
      setPicked(Object.fromEntries(open.map((a) => [a.id, true])))
      setAmounts(Object.fromEntries(open.map((a) => [a.id, (a.agreedPriceCents / 100).toFixed(2)])))
      setMethods(Object.fromEntries(open.map((a) => [a.id, 'PIX'])))
    } catch (e: any) {
      fail(e.message || 'Não foi possível carregar os atendimentos do dia.')
    } finally {
      setLoading(false)
    }
  }, [api, date, fail])

  useEffect(() => {
    load()
  }, [load])

  const open = items.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
  const done = items.filter((a) => a.status === 'COMPLETED')
  const selected = open.filter((a) => picked[a.id])
  const selectedTotal = selected.reduce((s, a) => s + (toCents(amounts[a.id] || '0') || 0), 0)
  const doneTotal = done.reduce(
    (s, a) => s + (a.attendance?.payments?.reduce((x: number, p: Row) => x + p.amountCents, 0) ?? a.agreedPriceCents),
    0,
  )

  async function finish() {
    if (selected.length === 0) return
    setBusy(true)
    try {
      const result = await api('/api/appointments/complete-day', {
        method: 'POST',
        body: JSON.stringify({
          items: selected.map((a) => ({
            id: a.id,
            method: methods[a.id] || 'PIX',
            amountCents: toCents(amounts[a.id] || '0'),
          })),
        }),
      })
      if (result?.failed?.length) {
        fail(`${result.failed.length} não foi/foram concluído(s): ${result.failed[0].message}`)
      }
      if (result?.completed?.length) {
        notify(`${result.completed.length} atendimento(s) concluído(s). O valor já está no saldo.`)
      }
      await load()
      onDone()
    } catch (e: any) {
      fail(e.message || 'Não foi possível concluir os atendimentos.')
    } finally {
      setBusy(false)
    }
  }

  async function noShow(a: Row) {
    if (!confirm(`Marcar ${a.client?.name || 'cliente'} como não compareceu? Nenhum valor será lançado.`)) return
    try {
      await api(`/api/appointments/${a.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'NO_SHOW' }) })
      await load()
      onDone()
    } catch (e: any) {
      fail(e.message || 'Não foi possível atualizar.')
    }
  }

  async function reopen(a: Row) {
    if (!confirm('Desfazer a conclusão? O valor recebido deste atendimento sai do saldo.')) return
    try {
      await api(`/api/appointments/${a.id}/reopen`, { method: 'POST', body: JSON.stringify({}) })
      notify('Conclusão desfeita. O valor saiu do saldo.')
      await load()
      onDone()
    } catch (e: any) {
      fail(e.message || 'Não foi possível desfazer.')
    }
  }

  return (
    <section className={`${card} mb-5 p-5`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Fechar o dia</h2>
          <p className="mt-1 text-xs text-[#9d858d]">
            Marque o que você já atendeu, escolha a forma de pagamento e confirme. O valor entra no saldo na hora.
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[#9d858d]">Dia</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-[#9d858d]">Carregando…</p>
      ) : open.length === 0 && done.length === 0 ? (
        <p className="rounded-xl bg-[#fff8f9] p-4 text-sm text-[#9d858d]">Nenhum agendamento neste dia.</p>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-2">
              {open.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#f4e9ec] p-3">
                  <input
                    type="checkbox"
                    checked={!!picked[a.id]}
                    onChange={(e) => setPicked((p) => ({ ...p, [a.id]: e.target.checked }))}
                    className="size-5 accent-[#d85f7b]"
                    aria-label="Incluir"
                  />
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-medium">
                      {timeOf(a.startsAt)} · {a.client?.name || 'Cliente'}
                    </p>
                    <p className="text-xs text-[#9d858d]">
                      {a.service?.name || 'Serviço'} · {a.status === 'CONFIRMED' ? 'Confirmado' : 'Agendado'}
                    </p>
                  </div>
                  <label className="text-xs text-[#9d858d]">
                    Valor (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[a.id] ?? ''}
                      onChange={(e) => setAmounts((p) => ({ ...p, [a.id]: e.target.value }))}
                      className={`${inputCls} mt-1 block w-28`}
                    />
                  </label>
                  <label className="text-xs text-[#9d858d]">
                    Pagamento
                    <select
                      value={methods[a.id] || 'PIX'}
                      onChange={(e) => setMethods((p) => ({ ...p, [a.id]: e.target.value }))}
                      className={`${inputCls} mt-1 block`}
                    >
                      {METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    title="Não compareceu"
                    onClick={() => noShow(a)}
                    className="rounded-lg p-2 text-[#9d858d] hover:bg-[#fce8ee] hover:text-red-500"
                  >
                    <UserX size={18} />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-sm">
                  {selected.length} selecionado(s) · <strong>{money(selectedTotal)}</strong>
                </p>
                <Button onClick={finish} disabled={busy || selected.length === 0} className={primaryBtn}>
                  <CheckCheck size={17} /> {busy ? 'Concluindo…' : 'Confirmar atendimentos realizados'}
                </Button>
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div className={open.length > 0 ? 'mt-5 border-t border-[#f4e9ec] pt-4' : ''}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#9d858d]">
                Já concluídos · {money(doneTotal)}
              </p>
              <div className="space-y-1">
                {done.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm">
                    <span>
                      {timeOf(a.startsAt)} · {a.client?.name} · {a.service?.name}
                    </span>
                    <button
                      title="Desfazer conclusão"
                      onClick={() => reopen(a)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#806b72] hover:bg-white"
                    >
                      <Undo2 size={14} /> Desfazer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Seletor de período (compartilhado por Financeiro e Relatórios)      */
/* ------------------------------------------------------------------ */
type Preset = 'hoje' | 'mes' | 'mesPassado' | 'custom'

function usePeriod() {
  const [preset, setPreset] = useState<Preset>('mes')
  const [from, setFrom] = useState(toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(toDateStr(new Date()))

  const range = useMemo(() => {
    const now = new Date()
    if (preset === 'hoje') return { start: toDateStr(now), end: toDateStr(now) }
    if (preset === 'mes')
      return {
        start: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    if (preset === 'mesPassado')
      return {
        start: toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: toDateStr(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    return { start: from, end: to < from ? from : to }
  }, [preset, from, to])

  const picker = (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {([
        ['hoje', 'Hoje'],
        ['mes', 'Este mês'],
        ['mesPassado', 'Mês passado'],
        ['custom', 'Período'],
      ] as [Preset, string][]).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setPreset(id)}
          className={`rounded-xl px-4 py-2 text-sm ${
            preset === id ? 'bg-[#fce8ee] font-semibold text-[#c75d79]' : 'bg-white text-[#806b72] hover:bg-[#fff5f7]'
          } border border-[#f2e4e8]`}
        >
          {label}
        </button>
      ))}
      {preset === 'custom' && (
        <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} min-w-0 flex-1`} />
          <span className="text-sm text-[#9d858d]">até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} min-w-0 flex-1`} />
        </>
      )}
    </div>
  )
  return { range, picker }
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`${card} min-w-0 p-4 sm:p-5`}>
      <p className="text-sm text-[#9d858d]">{label}</p>
      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : ''}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-[#b49da3]">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Financeiro: saldo, entradas, saídas e extrato                       */
/* ------------------------------------------------------------------ */
export function FinanceView({ api, refreshKey }: { api: Api; refreshKey?: number }) {
  const { range, picker } = usePeriod()
  const [summary, setSummary] = useState<Row | null>(null)
  const [moves, setMoves] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    const q = `startDate=${range.start}&endDate=${range.end}`
    Promise.all([api(`/api/finance/summary?${q}`), api(`/api/finance/movements?${q}`)])
      .then(([s, m]) => {
        if (!alive) return
        setSummary(s)
        setMoves(m?.items || [])
      })
      .catch((e: any) => alive && setError(e.message || 'Não foi possível carregar o financeiro.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [api, range.start, range.end, refreshKey])

  const byMethod = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const m of moves) if (m.type === 'IN') acc[m.method || 'OTHER'] = (acc[m.method || 'OTHER'] || 0) + m.amountCents
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [moves])

  const s = summary || {}
  const result = s.cashBalanceCents || 0

  return (
    <>
      {picker}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Saldo do período" value={money(result)} hint="Recebido − despesas pagas" tone={result < 0 ? 'bad' : 'good'} />
        <Stat label="Recebido" value={money(s.incomeReceivedCents)} hint={`${s.attendancesCount ?? 0} atendimento(s)`} />
        <Stat label="Despesas pagas" value={money(s.expensesPaidCents)} />
        <Stat label="Saldo total em caixa" value={money(s.totalBalanceCents)} hint="Desde o início" tone={(s.totalBalanceCents || 0) < 0 ? 'bad' : undefined} />
        <Stat label="A receber (previsto)" value={money(s.expectedCents)} hint={`${s.expectedCount ?? 0} agendamento(s) em aberto`} />
        <Stat label="Despesas pendentes" value={money(s.expensesPendingCents)} hint="Ainda não pagas" />
        <Stat label="Ticket médio" value={money(s.averageTicketCents)} />
        <Stat label="Descontos dados" value={money(s.totalDiscountsCents)} />
      </div>

      {byMethod.length > 0 && (
        <div className={`${card} mb-6 p-5`}>
          <h2 className="mb-3 font-semibold">Recebido por forma de pagamento</h2>
          <div className="flex flex-wrap gap-2">
            {byMethod.map(([m, v]) => (
              <span key={m} className="rounded-full bg-[#fff0f3] px-3 py-1.5 text-sm text-[#c75d79]">
                {methodLabel(m)}: <strong>{money(v)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="border-b border-[#f4e9ec] px-5 py-4">
          <h2 className="font-semibold">Extrato do caixa</h2>
          <p className="mt-1 text-xs text-[#9d858d]">
            {brDate(range.start)} a {brDate(range.end)} · {moves.length} movimentação(ões)
          </p>
        </div>
        {loading && moves.length === 0 ? (
          <p className="p-6 text-sm text-[#9d858d]">Carregando…</p>
        ) : moves.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#9d858d]">
            Nenhuma movimentação neste período. Conclua atendimentos em “Agendamentos” para lançar entradas.
          </p>
        ) : (
          <>
          <ul className="divide-y divide-[#f4e9ec] md:hidden">
            {moves.map((m) => (
              <li key={`${m.type}-${m.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="break-words font-medium leading-5">{m.title}</p>
                  {m.subtitle && <p className="break-words text-xs text-[#9d858d]">{m.subtitle}</p>}
                  <p className="mt-1 text-xs text-[#9d858d]">{dateTimeOf(m.date)} · {methodLabel(m.method)}</p>
                </div>
                <p className={`shrink-0 whitespace-nowrap text-right font-semibold ${m.type === 'IN' ? 'text-green-700' : 'text-red-600'}`}>
                  {m.type === 'IN' ? '+' : '−'} {money(m.amountCents)}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-[#fff8f9] text-xs uppercase tracking-wide text-[#9d858d]">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Forma</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4e9ec]">
                {moves.map((m) => (
                  <tr key={`${m.type}-${m.id}`}>
                    <td className="whitespace-nowrap px-4 py-3">{dateTimeOf(m.date)}</td>
                    <td className="px-4 py-3">
                      {m.title}
                      {m.subtitle && <span className="block text-xs text-[#9d858d]">{m.subtitle}</span>}
                    </td>
                    <td className="px-4 py-3">{methodLabel(m.method)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${m.type === 'IN' ? 'text-green-700' : 'text-red-600'}`}>
                      {m.type === 'IN' ? '+' : '−'} {money(m.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Relatórios: série por dia/mês, serviços, formas e categorias        */
/* ------------------------------------------------------------------ */
export function ReportsView({ api, refreshKey }: { api: Api; refreshKey?: number }) {
  const { range, picker } = usePeriod()
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day')
  const [report, setReport] = useState<Row | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    api(`/api/reports/financial?startDate=${range.start}&endDate=${range.end}&groupBy=${groupBy}`)
      .then((r) => alive && setReport(r))
      .catch((e: any) => alive && setError(e.message || 'Não foi possível carregar o relatório.'))
    return () => {
      alive = false
    }
  }, [api, range.start, range.end, groupBy, refreshKey])

  const series: Row[] = report?.series || []
  const totals = series.reduce(
    (t, r) => ({ income: t.income + r.incomeCents, expense: t.expense + r.expenseCents }),
    { income: 0, expense: 0 },
  )
  const fmtPeriod = (p: string) => (p.length === 7 ? `${p.slice(5)}/${p.slice(0, 4)}` : brDate(p))

  return (
    <>
      {picker}
      <div className="mb-5 flex gap-2">
        {([
          ['day', 'Por dia'],
          ['month', 'Por mês'],
        ] as ['day' | 'month', string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setGroupBy(id)}
            className={`rounded-xl border border-[#f2e4e8] px-4 py-2 text-sm ${groupBy === id ? 'bg-[#fce8ee] font-semibold text-[#c75d79]' : 'bg-white text-[#806b72]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Stat label="Entradas" value={money(totals.income)} />
        <Stat label="Saídas" value={money(totals.expense)} />
        <Stat label="Resultado" value={money(totals.income - totals.expense)} tone={totals.income - totals.expense < 0 ? 'bad' : 'good'} />
      </div>

      <div className={`${card} mb-6 overflow-hidden`}>
        <div className="border-b border-[#f4e9ec] px-5 py-4 font-semibold">Entradas e saídas</div>
        {series.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#9d858d]">Sem movimentações no período.</p>
        ) : (
          <>
          <ul className="divide-y divide-[#f4e9ec] md:hidden">
            {series.map((r) => (
              <li key={r.period} className="px-4 py-3.5">
                <p className="mb-1.5 text-sm font-semibold">{fmtPeriod(r.period)}</p>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-[#9d858d]">Entradas</dt><dd className="font-medium text-green-700">{money(r.incomeCents)}</dd></div>
                  <div><dt className="text-xs text-[#9d858d]">Saídas</dt><dd className="font-medium text-red-600">{money(r.expenseCents)}</dd></div>
                  <div><dt className="text-xs text-[#9d858d]">Resultado</dt><dd className={`font-semibold ${r.resultCents < 0 ? 'text-red-600' : ''}`}>{money(r.resultCents)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-[#fff8f9] text-xs uppercase tracking-wide text-[#9d858d]">
                <tr>
                  <th className="px-4 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 text-right font-medium">Entradas</th>
                  <th className="px-4 py-3 text-right font-medium">Saídas</th>
                  <th className="px-4 py-3 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4e9ec]">
                {series.map((r) => (
                  <tr key={r.period}>
                    <td className="px-4 py-3">{fmtPeriod(r.period)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{money(r.incomeCents)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{money(r.expenseCents)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.resultCents < 0 ? 'text-red-600' : ''}`}>{money(r.resultCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title="Serviços mais feitos" rows={(report?.topServices || []).map((s: Row) => [`${s.name} (${s.count}x)`, money(s.totalCents)])} />
        <ListCard title="Formas de pagamento" rows={(report?.paymentMethods || []).map((m: Row) => [`${methodLabel(m.method)} (${m.count}x)`, money(m.totalCents)])} />
        <ListCard title="Despesas por categoria" rows={(report?.expensesByCategory || []).map((c: Row) => [`${c.name} (${c.count}x)`, money(c.totalCents)])} />
      </div>
    </>
  )
}

function ListCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className={`${card} p-5`}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[#9d858d]">Sem dados no período.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map(([a, b]) => (
            <li key={a} className="flex justify-between gap-3">
              <span className="min-w-0 break-words text-[#806b72]">{a}</span>
              <span className="shrink-0 font-medium">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
