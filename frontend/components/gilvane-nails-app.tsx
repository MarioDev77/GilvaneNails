'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BarChart3, CalendarDays, CircleDollarSign, Clock, Copy, Eye, EyeOff, Home, Inbox, LogOut, Menu, MessageCircle, Plus, Settings, Sparkles, Wallet, Check, ClipboardList, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatDateKey, greeting, toDateKey, toTimeKey, whatsappLink } from '@/lib/format'
import { FinanceView, ReportsView } from '@/components/admin-finance'
import AgendaView from '@/components/agenda-view'
import ScheduleSettings from '@/components/schedule-settings'
import RecordsView from '@/components/records-view'
import { Btn, ConfirmDialog, Empty, Modal, Pill, APPT_STATUS, ToastHost, inputCls, labelCls, type Toast } from '@/components/ui-bits'

type Row = Record<string, any>
type Section = 'inicio' | 'agenda' | 'solicitacoes' | 'atendimentos' | 'servicos' | 'financeiro' | 'despesas' | 'relatorios' | 'configuracoes'

const NAV: { id: Section; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'inicio', label: 'Início', hint: 'Resumo do dia', icon: Home },
  { id: 'agenda', label: 'Agenda', hint: 'Horários marcados, por dia ou todos', icon: CalendarDays },
  { id: 'solicitacoes', label: 'Solicitações', hint: 'Pedidos feitos pelo link de agendamento', icon: Inbox },
  { id: 'atendimentos', label: 'Atendimentos', hint: 'Serviços já realizados', icon: ClipboardList },
  { id: 'servicos', label: 'Serviços', hint: 'Preços e duração', icon: Sparkles },
  { id: 'financeiro', label: 'Financeiro', hint: 'Entradas, saídas e saldo', icon: CircleDollarSign },
  { id: 'despesas', label: 'Despesas', hint: 'Gastos do mês', icon: Wallet },
  { id: 'relatorios', label: 'Relatórios', hint: 'Resultados por período', icon: BarChart3 },
  { id: 'configuracoes', label: 'Configurações', hint: 'Horários, link de agendamento e conta', icon: Settings },
]
const TAB_MAIN: Section[] = ['inicio', 'agenda', 'solicitacoes', 'financeiro']

/* ============================ LOGIN ============================ */
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const csrf = await (await fetch('/api/auth/csrf')).json()
      const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: location.origin, json: 'true' })
      const response = await fetch('/api/auth/callback/credentials?json=true', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, credentials: 'include' })
      const result = await response.json().catch(() => null)
      const errUrl = String(result?.url || '')
      const errCode = result?.error || (errUrl.includes('error=') ? new URL(errUrl, location.origin).searchParams.get('error') : null)
      if (response.status >= 500) setError('O servidor não respondeu corretamente. Verifique se o backend e o banco de dados estão iniciados.')
      else if (errCode === 'CredentialsSignin') setError('E-mail ou senha inválidos. Confira os dados e tente novamente.')
      else if (errCode || !response.ok) setError('Não foi possível entrar. Verifique se o backend e o banco de dados estão funcionando.')
      else location.reload()
    } catch {
      setError('Falha ao conectar ao servidor. Confira se o backend está iniciado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-line bg-white p-7 shadow-[0_20px_60px_-20px_rgba(174,63,91,0.25)]">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand text-white"><Sparkles className="size-7" /></div>
        <h1 className="text-center text-2xl font-extrabold tracking-tight">Gilvane Nails</h1>
        <p className="mb-6 mt-1.5 text-center text-sm text-ink-mute">Entre para ver a agenda e o caixa</p>
        {error && <p role="alert" className="mb-4 rounded-xl bg-bad-soft px-3.5 py-3 text-sm font-medium text-bad">{error}</p>}
        <label htmlFor="email" className={labelCls}>E-mail</label>
        <input id="email" required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputCls, 'mb-4')} placeholder="voce@email.com" />
        <label htmlFor="pw" className={labelCls}>Senha</label>
        <div className="relative mb-6">
          <input id="pw" required type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={cn(inputCls, 'pr-12')} placeholder="Sua senha" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-mute hover:text-brand-strong">{show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button>
        </div>
        <Btn type="submit" size="lg" className="w-full" loading={busy}>{busy ? 'Entrando…' : 'Entrar'}</Btn>
      </form>
    </main>
  )
}

/* ============================ INÍCIO ============================ */
function Dashboard({ api, name, pending, go, newAppt, refreshKey }: { api: Api; name: string; pending: number; go: (s: Section) => void; newAppt: () => void; refreshKey: number }) {
  const [data, setData] = useState<Row | null>(null)
  const [today, setToday] = useState<Row[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    api('/api/dashboard').then(setData).catch((e) => setError(e.message))
    api('/api/appointments/today').then((r) => setToday(Array.isArray(r) ? r : r?.items ?? [])).catch(() => {})
  }, [api, refreshKey])

  const open = today.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
  const kpi = [
    { label: 'Recebido hoje', value: formatBRL(data?.today?.incomeReceivedCents), tone: 'text-ok' },
    { label: 'A receber hoje', value: formatBRL(data?.today?.expectedCents) },
    { label: 'Saldo do mês', value: formatBRL(data?.month?.cashBalanceCents) },
    { label: 'Saldo em caixa', value: formatBRL(data?.totalBalanceCents) },
  ]
  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-mute">{greeting()}, {name.split(' ')[0]}</p>
          <p className="text-lg font-bold">{open.length === 0 ? 'Nenhum atendimento em aberto hoje' : `${open.length} atendimento${open.length > 1 ? 's' : ''} em aberto hoje`}</p>
        </div>
        <Btn size="lg" onClick={newAppt}><Plus className="size-5" />Novo agendamento</Btn>
      </div>

      {pending > 0 && (
        <button onClick={() => go('solicitacoes')} className="flex w-full items-center justify-between rounded-2xl bg-brand-soft px-4 py-3.5 text-left text-sm font-semibold text-brand-strong hover:bg-[#f7dae2]">
          <span>{pending} {pending > 1 ? 'pedidos de horário esperam' : 'pedido de horário espera'} sua resposta</span><span aria-hidden>Ver</span>
        </button>
      )}
      {error && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi.map((k) => (
          <div key={k.label} className="rounded-3xl border border-line bg-white p-4">
            <p className="text-[13px] text-ink-mute">{k.label}</p>
            <p className={cn('mt-1 text-xl font-extrabold tracking-tight sm:text-2xl', k.tone)}>{data ? k.value : '—'}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Hoje na agenda</h2>
          <button onClick={() => go('agenda')} className="text-sm font-bold text-brand-strong hover:underline">Abrir agenda</button>
        </div>
        {today.length === 0 ? (
          <Empty icon={CalendarDays} title="Agenda livre hoje" text="Quando marcar um horário para hoje, ele aparece aqui." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {today.map((a) => {
              const st = APPT_STATUS[a.status]
              return (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3.5">
                  <p className="w-14 text-lg font-bold">{toTimeKey(a.startsAt)}</p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.client?.name}</p>
                    <p className="truncate text-sm text-ink-soft">{a.service?.name}</p>
                  </div>
                  <Pill tone={st?.tone}>{st?.label ?? a.status}</Pill>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

/* ============================ SOLICITAÇÕES ============================ */
function Requests({ api, notify, onChanged, refreshKey }: { api: Api; notify: (t: string, k?: 'ok' | 'error') => void; onChanged: () => void; refreshKey: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [refuse, setRefuse] = useState<Row | null>(null)
  const [tell, setTell] = useState<Row | null>(null)
  const load = useCallback(() => {
    api('/api/booking-requests').then((r) => setRows(Array.isArray(r) ? r : r?.items ?? [])).catch((e) => { setError(e.message); setRows([]) })
  }, [api])
  useEffect(load, [load, refreshKey])

  async function decide(r: Row, status: 'CONFIRMED' | 'CANCELLED') {
    try {
      await api(`/api/appointments/${r.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      notify(status === 'CONFIRMED' ? 'Solicitação confirmada.' : 'Solicitação recusada. O horário ficou livre.')
      if (status === 'CONFIRMED' && r.client?.phone) setTell(r)
      load(); onChanged()
    } catch (e: any) { notify(e.message || 'Não foi possível atualizar.', 'error') }
  }

  if (rows === null) return <div className="h-28 animate-pulse rounded-3xl bg-white ring-1 ring-line" />
  if (error) return <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p>
  if (rows.length === 0) return <Empty icon={Inbox} title="Nenhuma solicitação pendente" text="Quando uma cliente pedir horário pelo link de agendamento, o pedido aparece aqui." />
  return (
    <div className="space-y-3 pb-24 md:pb-0">
      {rows.map((r) => {
        const info = String(r.notes || '').replace('[Solicitação online]', '').trim()
        return (
          <article key={r.id} className="rounded-3xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold">{r.client?.name || 'Cliente'}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft"><Clock className="size-4" />{formatDateKey(toDateKey(r.startsAt))} às {toTimeKey(r.startsAt)} · {r.service?.name}</p>
                {r.client?.phone && <p className="mt-0.5 text-sm text-ink-mute">{r.client.phone}</p>}
                {info && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-[13px] text-ink-soft">{info}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.client?.phone && <a href={whatsappLink(r.client.phone)} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp" className="flex size-10 items-center justify-center rounded-xl text-ok hover:bg-ok-soft"><MessageCircle className="size-5" /></a>}
                <Btn variant="outline" size="md" onClick={() => setRefuse(r)}>Recusar</Btn>
                <Btn size="md" onClick={() => decide(r, 'CONFIRMED')}><Check className="size-4" />Confirmar</Btn>
              </div>
            </div>
          </article>
        )
      })}
      {tell && (() => {
        const first = String(tell.client?.name || '').split(' ')[0]
        const msg = `Oi, ${first}! Seu horário de ${tell.service?.name} está confirmado para ${formatDateKey(toDateKey(tell.startsAt))} às ${toTimeKey(tell.startsAt)}. Te espero!`
        return (
          <Modal title="Horário confirmado" subtitle={`${tell.client?.name} · ${formatDateKey(toDateKey(tell.startsAt))} às ${toTimeKey(tell.startsAt)}`} onClose={() => setTell(null)}
            footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn variant="outline" size="lg" onClick={() => setTell(null)}>Agora não</Btn><a href={whatsappLink(tell.client.phone, msg)} target="_blank" rel="noreferrer" onClick={() => setTell(null)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ok px-5 text-[15px] font-semibold text-white hover:brightness-95"><MessageCircle className="size-5" />Avisar no WhatsApp</a></div>}>
            <p className="text-[15px] leading-6 text-ink-soft">Quer avisar <strong className="text-ink">{tell.client?.name}</strong> que o horário dela foi confirmado? A mensagem já vai pronta no WhatsApp.</p>
          </Modal>
        )
      })()}
      {refuse && <ConfirmDialog danger title="Recusar este pedido?" confirmLabel="Recusar" onClose={() => setRefuse(null)} text="O horário volta a ficar livre para outras clientes." onConfirm={async () => { await decide(refuse, 'CANCELLED'); setRefuse(null) }} />}
    </div>
  )
}

/* ============================ CONFIGURAÇÕES ============================ */
function Config({ api, email, notify, logout }: { api: Api; email?: string; notify: (t: string, k?: 'ok' | 'error') => void; logout: () => void }) {
  const link = typeof location !== 'undefined' ? `${location.origin}/agendar` : '/agendar'
  return (
    <div className="max-w-xl space-y-4 pb-24 md:pb-0">
      <div className="rounded-3xl border border-line bg-white p-5">
        <h2 className="font-bold">Link de agendamento para clientes</h2>
        <p className="mt-1 text-sm text-ink-mute">Envie no WhatsApp ou coloque no Instagram. As clientes escolhem o horário e o pedido chega em Solicitações.</p>
        <p className="mt-3 break-all rounded-xl bg-paper px-3.5 py-3 text-sm font-medium">{link}</p>
        <Btn variant="soft" className="mt-3" onClick={() => { navigator.clipboard?.writeText(link); notify('Link copiado.') }}><Copy className="size-4" />Copiar link</Btn>
      </div>
      <ScheduleSettings api={api} notify={notify} />
      <div className="rounded-3xl border border-line bg-white p-5">
        <h2 className="font-bold">Conta</h2>
        <p className="mt-1 text-sm text-ink-mute">Conectada como {email}</p>
        <Btn variant="outline" className="mt-3" onClick={logout}><LogOut className="size-4" />Sair da conta</Btn>
      </div>
    </div>
  )
}

/* ============================ APP ============================ */
type Api = (path: string, options?: RequestInit) => Promise<any>

function AppContent() {
  const [session, setSession] = useState<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [section, setSection] = useState<Section>('inicio')
  const [clients, setClients] = useState<Row[]>([])
  const [services, setServices] = useState<Row[]>([])
  const [pending, setPending] = useState(0)
  const [ver, setVer] = useState(0)
  const [newSignal, setNewSignal] = useState(0)
  const [more, setMore] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' }).then((r) => r.json()).then((s) => { setSession(s?.user ? s : null); setStatus('ready') }).catch(() => setStatus('ready'))
  }, [])

  const logout = async () => {
    try {
      const c = await (await fetch('/api/auth/csrf')).json()
      await fetch('/api/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: c.csrfToken, callbackUrl: location.origin }), credentials: 'include' })
    } finally { location.href = '/' }
  }

  const api: Api = useCallback(async (path, options = {}) => {
    const r = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, credentials: 'include', cache: 'no-store' })
    const body = r.status === 204 ? null : await r.json().catch(() => null)
    if (!r.ok) {
      const details = Array.isArray(body?.error?.details) ? body.error.details.map((x: any) => x.message).filter(Boolean).join(' • ') : ''
      throw new Error(details || body?.error?.message || body?.message || `Erro ${r.status} ao acessar a API`)
    }
    return body?.data ?? body
  }, [])

  const notify = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])

  const refs = useCallback(async () => {
    if (!session) return
    try {
      const [c, s, rq] = await Promise.all([api('/api/clients?limit=100'), api('/api/services?limit=100'), api('/api/booking-requests').catch(() => null)])
      setClients(Array.isArray(c) ? c : c?.items || [])
      setServices(Array.isArray(s) ? s : s?.items || [])
      setPending(rq?.items?.length ?? (Array.isArray(rq) ? rq.length : 0))
    } catch (e: any) { notify(e.message || 'Não foi possível carregar os dados.', 'error') }
  }, [api, session, notify])
  useEffect(() => { refs() }, [refs, ver])

  const changed = useCallback(() => setVer((v) => v + 1), [])
  const go = (s: Section) => { setSection(s); setMore(false) }
  useEffect(() => { window.scrollTo(0, 0) }, [section])
  const newAppt = () => { setSection('agenda'); setNewSignal((n) => n + 1) }

  if (status === 'loading') return <div className="grid min-h-dvh place-items-center bg-paper text-ink-mute">Carregando…</div>
  if (!session) return <Login />

  const current = NAV.find((n) => n.id === section)!
  const userName = session.user?.name || session.user?.email || ''
  const navBtn = (n: (typeof NAV)[number]) => {
    const I = n.icon
    const active = section === n.id
    return (
      <button key={n.id} onClick={() => go(n.id)} aria-current={active ? 'page' : undefined}
        className={cn('flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] font-medium transition-colors', active ? 'bg-brand-soft font-bold text-brand-strong' : 'text-ink-soft hover:bg-paper hover:text-ink')}>
        <I className="size-[18px]" />{n.label}
        {n.id === 'solicitacoes' && pending > 0 && <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{pending}</span>}
      </button>
    )
  }

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white p-4 md:flex">
        <div className="mb-7 flex items-center gap-3 px-1.5 pt-1">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-white"><Sparkles className="size-5" /></div>
          <div><p className="font-extrabold leading-5">Gilvane Nails</p><p className="text-xs text-ink-mute">Agenda e caixa</p></div>
        </div>
        <nav className="space-y-0.5">{NAV.map(navBtn)}</nav>
        <div className="mt-auto border-t border-line pt-3">
          <p className="truncate px-3.5 pb-2 text-xs text-ink-mute">{userName}</p>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium text-ink-soft hover:bg-paper"><LogOut className="size-[18px]" />Sair da conta</button>
        </div>
      </aside>

      <div className="md:pl-64">
        <main className="mx-auto max-w-4xl px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 md:pt-8">
          <header className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{current.label}</h1>
            <p className="mt-1 text-sm text-ink-mute">{current.hint}</p>
          </header>

          {section === 'inicio' && <Dashboard api={api} name={userName} pending={pending} go={go} newAppt={newAppt} refreshKey={ver} />}
          {section === 'agenda' && <AgendaView api={api} services={services} clients={clients} notify={notify} onChanged={changed} newSignal={newSignal} />}
          {section === 'solicitacoes' && <Requests api={api} notify={notify} onChanged={changed} refreshKey={ver} />}
          {(section === 'servicos' || section === 'atendimentos' || section === 'despesas') && <RecordsView key={section} section={section} api={api} clients={clients} services={services} notify={notify} onChanged={changed} refreshKey={ver} />}
          {section === 'financeiro' && <FinanceView api={api} refreshKey={ver} />}
          {section === 'relatorios' && <ReportsView api={api} refreshKey={ver} />}
          {section === 'configuracoes' && <Config api={api} email={session.user?.email} notify={notify} logout={logout} />}
        </main>
      </div>

      {/* navegação do celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {[...TAB_MAIN.map((id) => NAV.find((n) => n.id === id)!), { id: 'more' as const, label: 'Mais', icon: Menu }].map((n) => {
            const I = n.icon
            const active = n.id === 'more' ? !TAB_MAIN.includes(section) : section === n.id
            return (
              <button key={n.id} onClick={() => (n.id === 'more' ? setMore(true) : go(n.id))} aria-current={active ? 'page' : undefined}
                className={cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-brand-strong' : 'text-ink-mute')}>
                <I className="size-5" />{n.label}
                {n.id === 'solicitacoes' && pending > 0 && <span className="absolute right-[22%] top-2 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">{pending}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      {more && (
        <Modal title="Mais opções" onClose={() => setMore(false)}>
          <div className="space-y-1">
            {NAV.filter((n) => !TAB_MAIN.includes(n.id)).map(navBtn)}
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] font-medium text-bad hover:bg-bad-soft"><LogOut className="size-[18px]" />Sair da conta</button>
          </div>
        </Modal>
      )}

      <ToastHost toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}

export default function GilvaneNailsApp() {
  return <AppContent />
}
