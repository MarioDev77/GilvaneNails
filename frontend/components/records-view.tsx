'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Check, ClipboardList, Pencil, Plus, Search, Sparkles, Trash2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatDateKey, toDateKey, toISO, toTimeKey } from '@/lib/format'
import { APPT_STATUS, Btn, ConfirmDialog, Empty, Modal, Pill, inputCls, labelCls } from '@/components/ui-bits'
import { METHODS } from '@/components/admin-finance'

type Row = Record<string, any>
type Api = (path: string, options?: RequestInit) => Promise<any>
type Notify = (text: string, kind?: 'ok' | 'error') => void
export type RecordSection = 'servicos' | 'atendimentos' | 'despesas'

const paths: Record<RecordSection, string> = { servicos: '/api/services', atendimentos: '/api/attendances', despesas: '/api/finance/expenses' }
const dt = (iso?: string) => (iso ? `${formatDateKey(toDateKey(iso))} às ${toTimeKey(iso)}` : '—')
const d = (iso?: string) => (iso ? formatDateKey(toDateKey(iso)) : '—')
const localInput = (iso?: string) => (iso ? `${toDateKey(iso)}T${toTimeKey(iso)}` : '')

type Field = { key: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; wide?: boolean }

const META: Record<RecordSection, { newLabel: string; emptyTitle: string; emptyText: string; icon: React.ElementType }> = {
  servicos: { newLabel: 'Novo serviço', emptyTitle: 'Nenhum serviço cadastrado', emptyText: 'Cadastre os serviços com preço e duração para agendar mais rápido.', icon: Sparkles },
  atendimentos: { newLabel: 'Novo atendimento', emptyTitle: 'Nenhum atendimento registrado', emptyText: 'Os atendimentos concluídos na agenda aparecem aqui.', icon: ClipboardList },
  despesas: { newLabel: 'Nova despesa', emptyTitle: 'Nenhuma despesa lançada', emptyText: 'Lance materiais, aluguel e outros gastos para ver o saldo real.', icon: Wallet },
}

export default function RecordsView({ section, api, clients, services, notify, onChanged, refreshKey }: { section: RecordSection; api: Api; clients: Row[]; services: Row[]; notify: Notify; onChanged: () => void; refreshKey: number }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ row?: Row } | null>(null)
  const [ask, setAsk] = useState<null | { kind: 'remove' | 'cancel'; row: Row }>(null)
  const meta = META[section]

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api(paths[section] + (section === 'servicos' ? '' : '?limit=100'))
      setRows(Array.isArray(r) ? r : r?.items || r?.data || [])
    } catch (e: any) {
      setRows([])
      setError(e.message || 'Não foi possível carregar.')
    } finally {
      setLoading(false)
    }
  }, [api, section])
  useEffect(() => { load() }, [load, refreshKey])

  const fields: Field[] = useMemo(() => {
    if (section === 'servicos') return [
      { key: 'name', label: 'Nome do serviço', required: true, wide: true },
      { key: 'price', label: 'Preço (R$)', type: 'number', required: true },
      { key: 'durationMinutes', label: 'Duração (minutos)', type: 'number', required: true },
      { key: 'description', label: 'Descrição (opcional)', type: 'textarea', wide: true },
      { key: 'isActive', label: 'Serviço ativo (aparece na agenda e no link de agendamento)', type: 'checkbox', wide: true },
    ]
    if (section === 'atendimentos') return [
      { key: 'clientId', label: 'Cliente', type: 'select', required: true, wide: true, options: clients.map((x) => ({ value: x.id, label: x.name })) },
      { key: 'serviceId', label: 'Serviço', type: 'select', wide: true, options: services.map((x) => ({ value: x.id, label: x.name })) },
      { key: 'performedAt', label: 'Data e hora', type: 'datetime-local', required: true, wide: true },
      { key: 'price', label: 'Valor (R$)', type: 'number', required: true },
      { key: 'discount', label: 'Desconto (R$)', type: 'number' },
      { key: 'paymentMethod', label: 'Forma de pagamento (lança no saldo)', type: 'select', wide: true, options: METHODS },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ]
    return [
      { key: 'description', label: 'Descrição da despesa', required: true, wide: true },
      { key: 'amount', label: 'Valor (R$)', type: 'number', required: true },
      { key: 'incurredAt', label: 'Data da despesa', type: 'date', required: true },
      { key: 'dueAt', label: 'Vencimento', type: 'date' },
      { key: 'paidNow', label: 'Já foi paga (sai do saldo agora)', type: 'checkbox', wide: true },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ]
  }, [section, clients, services])

  const filtered = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))

  async function run(fn: () => Promise<any>, ok: string) {
    try { await fn(); notify(ok); await load(); onChanged(); return true } catch (e: any) { notify(e.message || 'Não foi possível concluir.', 'error'); return false }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar" className={cn(inputCls, 'pl-10')} />
        </div>
        <Btn size="lg" onClick={() => setForm({})}><Plus className="size-5" />{meta.newLabel}</Btn>
      </div>

      {error ? (
        <div className="rounded-3xl bg-bad-soft p-6 text-center text-sm font-medium text-bad">{error}<div className="mt-3"><Btn variant="outline" size="sm" onClick={load}>Tentar de novo</Btn></div></div>
      ) : loading && rows.length === 0 ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-white ring-1 ring-line" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty icon={meta.icon} title={query ? 'Nada encontrado' : meta.emptyTitle} text={query ? 'Tente buscar com outras palavras.' : meta.emptyText} />
      ) : (
        <>
          <p className="mb-2 px-1 text-sm text-ink-mute">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</p>
          <div className="space-y-3">
            {filtered.map((r) => (
              <article key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-line bg-white p-4">
                <div className="min-w-0 flex-1 basis-48">
                  {section === 'servicos' && <>
                    <p className="truncate text-base font-bold">{r.name}</p>
                    <p className="text-sm text-ink-soft">{r.durationMinutes} min{r.description ? ` · ${r.description}` : ''}</p>
                  </>}
                  {section === 'atendimentos' && <>
                    <p className="truncate text-base font-bold">{r.client?.name || clients.find((c) => c.id === r.clientId)?.name || '—'}</p>
                    <p className="truncate text-sm text-ink-soft">{r.service?.name || services.find((s) => s.id === r.serviceId)?.name || 'Sem serviço'} · {dt(r.performedAt)}</p>
                  </>}
                  {section === 'despesas' && <>
                    <p className="truncate text-base font-bold">{r.description}</p>
                    <p className="text-sm text-ink-soft">{d(r.incurredAt)}{r.dueAt ? ` · vence ${d(r.dueAt)}` : ''}</p>
                  </>}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold">{formatBRL(section === 'servicos' ? r.priceCents : section === 'atendimentos' ? r.dueCents ?? r.priceCents : r.amountCents)}</p>
                  {section === 'atendimentos' && <p className="text-xs text-ink-mute">Pago {formatBRL(r.paidCents)}</p>}
                </div>
                {section === 'servicos' && <Pill tone={r.isActive ? 'ok' : 'gray'}>{r.isActive ? 'Ativo' : 'Inativo'}</Pill>}
                {section === 'despesas' && <Pill tone={APPT_STATUS[r.status]?.tone ?? 'gray'}>{APPT_STATUS[r.status]?.label ?? r.status}</Pill>}
                <div className="flex items-center gap-1">
                  {section === 'despesas' && r.status === 'PENDING' && (
                    <Btn variant="success" size="sm" onClick={() => run(() => api(`/api/finance/expenses/${r.id}/pay`, { method: 'PATCH', body: '{}' }), 'Despesa paga. O valor saiu do saldo.')}><Check className="size-4" />Pagar</Btn>
                  )}
                  {!(section === 'despesas' && r.status !== 'PENDING') && <Btn variant="ghost" size="sm" aria-label="Editar" onClick={() => setForm({ row: r })} className="!px-2.5"><Pencil className="size-4" /></Btn>}
                  {section === 'servicos' && <Btn variant="ghost" size="sm" aria-label="Arquivar serviço" onClick={() => setAsk({ kind: 'remove', row: r })} className="!px-2.5 hover:!bg-bad-soft hover:!text-bad"><Trash2 className="size-4" /></Btn>}
                  {section === 'despesas' && r.status === 'PENDING' && <Btn variant="ghost" size="sm" aria-label="Cancelar despesa" onClick={() => setAsk({ kind: 'cancel', row: r })} className="!px-2.5 hover:!bg-bad-soft hover:!text-bad"><Ban className="size-4" /></Btn>}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {form && <RecordForm section={section} fields={fields} row={form.row} api={api} onClose={() => setForm(null)} onSaved={async () => { setForm(null); notify('Salvo com sucesso.'); await load(); onChanged() }} />}
      {ask?.kind === 'remove' && <ConfirmDialog danger title="Arquivar este serviço?" confirmLabel="Arquivar" onClose={() => setAsk(null)} text={`“${ask.row.name}” deixa de aparecer ao agendar. Agendamentos antigos continuam intactos.`} onConfirm={async () => { await run(() => api(`${paths[section]}/${ask.row.id}`, { method: 'DELETE' }), 'Serviço arquivado.'); setAsk(null) }} />}
      {ask?.kind === 'cancel' && <ConfirmDialog danger title="Cancelar esta despesa?" confirmLabel="Cancelar despesa" onClose={() => setAsk(null)} text={`“${ask.row.description}” não será mais contada.`} onConfirm={async () => { await run(() => api(`${paths[section]}/${ask.row.id}/cancel`, { method: 'PATCH', body: '{}' }), 'Despesa cancelada.'); setAsk(null) }} />}
    </div>
  )
}

function RecordForm({ section, fields, row, api, onClose, onSaved }: { section: RecordSection; fields: Field[]; row?: Row; api: Api; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = !!row

  const initial = (f: Field) => {
    const r = row ?? {}
    switch (f.key) {
      case 'price': return r.priceCents != null ? r.priceCents / 100 : ''
      case 'discount': return r.discountCents != null ? r.discountCents / 100 : ''
      case 'amount': return r.amountCents != null ? r.amountCents / 100 : ''
      case 'performedAt': return localInput(r.performedAt)
      case 'incurredAt': case 'dueAt': return r[f.key] ? String(r[f.key]).slice(0, 10) : ''
      case 'isActive': return row ? !!r.isActive : true
      default: return r[f.key] ?? ''
    }
  }

  async function save(form: FormData) {
    const data: Row = {}
    for (const f of fields) {
      if (editing && (f.key === 'paymentMethod' || f.key === 'paidNow')) continue
      const v = form.get(f.key)
      if (f.type === 'checkbox') { data[f.key] = v === 'on'; continue }
      if (v === null || v === '') continue
      if (['price', 'discount', 'amount'].includes(f.key)) data[f.key] = Math.round(Number(v) * 100)
      else if (f.key === 'durationMinutes') data[f.key] = Number(v)
      else if (f.key === 'performedAt') data[f.key] = toISO(String(v).slice(0, 10), String(v).slice(11, 16))
      else data[f.key] = String(v)
    }
    if (section === 'servicos' && 'price' in data) { data.priceCents = data.price; delete data.price }
    if (section === 'atendimentos') {
      if ('price' in data) { data.priceCents = data.price; delete data.price }
      if ('discount' in data) { data.discountCents = data.discount; delete data.discount }
    }
    if (section === 'despesas' && 'amount' in data) { data.amountCents = data.amount; delete data.amount }
    setBusy(true)
    setError('')
    try {
      if (editing) await api(`${paths[section]}/${row!.id}`, { method: 'PATCH', body: JSON.stringify(data) })
      else await api(paths[section], { method: 'POST', body: JSON.stringify(data) })
      onSaved()
    } catch (e: any) {
      setError(e.message || 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  const visible = fields.filter((f) => !(editing && (f.key === 'paymentMethod' || f.key === 'paidNow')))
  return (
    <Modal title={editing ? 'Editar registro' : META[section].newLabel} onClose={onClose}
      footer={<Btn type="submit" form="rec-form" size="lg" className="w-full" loading={busy}>Salvar</Btn>}>
      <form id="rec-form" action={save} className="grid gap-4 sm:grid-cols-2">
        {visible.map((f) => (
          <div key={f.key} className={f.wide || f.type === 'textarea' || f.type === 'checkbox' ? 'sm:col-span-2' : ''}>
            {f.type === 'checkbox' ? (
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <input name={f.key} type="checkbox" defaultChecked={!!initial(f)} className="size-5 accent-[#c94f6c]" />{f.label}
              </label>
            ) : (
              <>
                <label className={labelCls} htmlFor={`f-${f.key}`}>{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'textarea' ? <textarea id={`f-${f.key}`} name={f.key} rows={3} defaultValue={initial(f)} className={cn(inputCls, 'h-auto py-3')} />
                  : f.type === 'select' ? (
                    <select id={`f-${f.key}`} name={f.key} defaultValue={initial(f)} required={f.required} className={inputCls}>
                      <option value="">Selecione…</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : <input id={`f-${f.key}`} name={f.key} type={f.type || 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} min={f.type === 'number' ? '0' : undefined} step={f.type === 'number' ? (f.key === 'durationMinutes' ? '5' : '0.01') : undefined} defaultValue={initial(f)} required={f.required} className={inputCls} />}
              </>
            )}
          </div>
        ))}
        {error && <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm font-medium text-bad sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  )
}
