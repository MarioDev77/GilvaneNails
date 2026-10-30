'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarDays, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Booking = {
  id: string
  status: string
  startsAt: string
  firstName: string
  service: { name: string; durationMinutes: number }
  canChange: boolean
  reason: 'closed' | 'past' | 'too_late' | null
  minLeadHours: number
}
type Slot = { startsAt: string; time: string }
type View = 'home' | 'reschedule' | 'cancel'
type Result = { kind: 'cancelled' } | { kind: 'rescheduled'; startsAt: string }

const TZ = 'America/Bahia'
const bahiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const niceWhen = (iso: string) => {
  const s = new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function request(path: string, options: RequestInit = {}) {
  let res: Response
  try {
    res = await fetch(path, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  } catch {
    throw new Error('Sem conexão com a internet. Confira o sinal e tente de novo.')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const details = Array.isArray(body?.error?.details) ? body.error.details.map((x: any) => x.message).filter(Boolean).join(' • ') : ''
    throw new Error(details || body?.error?.message || 'Não foi possível concluir. Tente novamente.')
  }
  return body?.data
}

const STATUS_TEXT: Record<string, string> = {
  SCHEDULED: 'Aguardando confirmação da Gilvane',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Atendimento concluído',
  NO_SHOW: 'Horário encerrado',
}

const inputClass =
  'w-full rounded-xl border border-[#ead9de] bg-white p-3 text-[#39252b] outline-none focus:border-[#d85f7b]'
const primary = 'w-full rounded-xl bg-[#d85f7b] py-6 text-base text-white hover:bg-[#c94f6c] disabled:opacity-50'
const outline = 'w-full rounded-xl border border-[#ead9de] bg-white py-6 text-base text-[#39252b] hover:bg-[#fff8f9]'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fff7f8] p-4 text-[#39252b] sm:p-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 text-center">
          <img src="/logo-circle.png" alt="" width={112} height={112} className="mx-auto mb-2 size-24 sm:size-28" />
          <h1 className="sr-only">Gilvane Nails</h1>
        </header>
        {children}
      </div>
    </main>
  )
}

export default function ManageBooking() {
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const token = params.get('t') ?? ''
  const q = `id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState<View>('home')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [slot, setSlot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const { minDate, maxDate } = useMemo(() => {
    const today = bahiaToday()
    return { minDate: today, maxDate: addDaysKey(today, 60) }
  }, [])

  useEffect(() => {
    if (!id || !token) {
      setLoadError('Este link está incompleto. Abra o link exatamente como a Gilvane enviou.')
      setLoading(false)
      return
    }
    request(`/api/public/manage?${q}`)
      .then(setBooking)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [id, token, q])

  useEffect(() => {
    setSlot('')
    setSlots([])
    if (view !== 'reschedule' || !date) return
    let cancelled = false
    setLoadingSlots(true)
    setSlotsError('')
    request(`/api/public/manage/slots?${q}&date=${date}`)
      .then((data) => !cancelled && setSlots(data?.slots || []))
      .catch((e) => !cancelled && setSlotsError(e.message))
      .finally(() => !cancelled && setLoadingSlots(false))
    return () => {
      cancelled = true
    }
  }, [view, date, q])

  function fail(message: string) {
    setError(message)
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  async function cancel() {
    setError('')
    setBusy(true)
    try {
      await request('/api/public/manage/cancel', { method: 'POST', body: JSON.stringify({ id, t: token }) })
      setResult({ kind: 'cancelled' })
    } catch (e: any) {
      fail(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function reschedule() {
    if (!slot) return fail('Escolha o novo dia e horário.')
    setError('')
    setBusy(true)
    try {
      const data = await request('/api/public/manage/reschedule', { method: 'POST', body: JSON.stringify({ id, t: token, startsAt: slot }) })
      setResult({ kind: 'rescheduled', startsAt: data?.startsAt || slot })
    } catch (e: any) {
      fail(e.message)
      // Se o horário foi ocupado por outra pessoa, recarrega a lista.
      if (date) request(`/api/public/manage/slots?${q}&date=${date}`).then((d) => { setSlots(d?.slots || []); setSlot('') }).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Shell><p className="text-center text-sm text-[#9d858d]">Carregando seu horário…</p></Shell>

  if (loadError || !booking) {
    return (
      <Shell>
        <div className="rounded-3xl border border-[#f2dfe5] bg-white p-8 text-center shadow-xl">
          <h2 className="text-xl font-bold">Não encontramos esse horário</h2>
          <p role="alert" className="mt-3 text-sm text-[#806b72]">{loadError || 'Link inválido ou expirado.'}</p>
          <a href="/agendar" className="mt-5 block rounded-xl bg-[#d85f7b] py-3 font-semibold text-white hover:bg-[#c94f6c]">Agendar um horário</a>
        </div>
      </Shell>
    )
  }

  if (result) {
    const cancelled = result.kind === 'cancelled'
    return (
      <Shell>
        <div className="rounded-3xl border border-[#f2dfe5] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-green-50 text-green-600"><Check size={30} /></div>
          <h2 className="text-2xl font-bold">{cancelled ? 'Horário cancelado' : 'Novo horário enviado!'}</h2>
          {cancelled ? (
            <p className="mt-3 text-sm text-[#806b72]">Tudo certo, o horário foi liberado. Quando quiser, é só agendar outro.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-[#806b72]"><strong>{booking.service.name}</strong><br />{niceWhen((result as { startsAt: string }).startsAt)}</p>
              <p className="mt-4 rounded-xl bg-[#fff5f7] p-3 text-sm text-[#806b72]">O novo horário está reservado e aguardando a confirmação da Gilvane. Ela vai te avisar.</p>
            </>
          )}
          {cancelled && <a href="/agendar" className="mt-5 block rounded-xl bg-[#d85f7b] py-3 font-semibold text-white hover:bg-[#c94f6c]">Agendar outro horário</a>}
        </div>
      </Shell>
    )
  }

  const lockedText =
    booking.reason === 'closed'
      ? STATUS_TEXT[booking.status] === 'Cancelado' ? 'Este horário já foi cancelado.' : 'Este horário não pode mais ser alterado por aqui.'
      : `Só dá para remarcar ou cancelar por aqui com pelo menos ${booking.minLeadHours} horas de antecedência. Fale diretamente com a Gilvane.`

  return (
    <Shell>
      <section className="rounded-2xl border border-[#f2e4e8] bg-white p-5">
        <p className="text-sm text-[#9d858d]">Olá, {booking.firstName}! Este é o seu horário:</p>
        <p className="mt-2 text-lg font-bold">{booking.service.name}</p>
        <p className="mt-0.5 text-[#806b72]">{niceWhen(booking.startsAt)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-[#9d858d]"><Clock size={12} /> {booking.service.durationMinutes} min</p>
        <p className="mt-3 inline-block rounded-full bg-[#fff0f3] px-3 py-1 text-xs font-semibold text-[#c94f6c]">{STATUS_TEXT[booking.status] ?? booking.status}</p>
      </section>

      {!booking.canChange && <p role="status" className="mt-4 rounded-xl border border-[#f2dfe5] bg-[#fff5f7] p-4 text-sm text-[#806b72]">{lockedText}</p>}

      {booking.canChange && view === 'home' && (
        <div className="mt-4 space-y-3">
          <Button className={primary} onClick={() => setView('reschedule')}>Remarcar horário</Button>
          <Button className={outline} variant="outline" onClick={() => setView('cancel')}>Cancelar horário</Button>
        </div>
      )}

      {booking.canChange && view === 'cancel' && (
        <section className="mt-4 rounded-2xl border border-[#f2e4e8] bg-white p-5">
          <h2 className="font-semibold">Cancelar este horário?</h2>
          <p className="mt-1 text-sm text-[#806b72]">O horário volta a ficar livre para outras clientes.</p>
          {error && <p ref={errorRef} role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-4 space-y-3">
            <Button className={primary} disabled={busy} onClick={cancel}>{busy ? 'Cancelando…' : 'Sim, cancelar'}</Button>
            <Button className={outline} variant="outline" disabled={busy} onClick={() => { setView('home'); setError('') }}>Voltar</Button>
          </div>
        </section>
      )}

      {booking.canChange && view === 'reschedule' && (
        <section className="mt-4 rounded-2xl border border-[#f2e4e8] bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays size={17} className="text-[#d85f7b]" /> Novo dia e horário</h2>
          <input type="date" aria-label="Novo dia" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          {date && (
            <div className="mt-4">
              {slotsError && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{slotsError}</p>}
              {loadingSlots ? (
                <p className="text-sm text-[#9d858d]">Buscando horários…</p>
              ) : slots.length === 0 && !slotsError ? (
                <p className="text-sm text-[#9d858d]">Sem horários livres nesse dia. Tente outra data.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      type="button"
                      key={s.startsAt}
                      onClick={() => { setSlot(s.startsAt); setError('') }}
                      aria-pressed={slot === s.startsAt}
                      className={`rounded-xl border py-2.5 text-sm font-medium transition ${slot === s.startsAt ? 'border-[#d85f7b] bg-[#d85f7b] text-white' : 'border-[#ead9de] bg-white hover:bg-[#fff0f3]'}`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {slot && <p className="mt-4 rounded-xl bg-[#fff5f7] p-3 text-sm text-[#806b72]">Novo horário: <strong>{niceWhen(slot)}</strong></p>}
          {error && <p ref={errorRef} role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-4 space-y-3">
            <Button className={primary} disabled={busy || !slot} onClick={reschedule}>{busy ? 'Enviando…' : 'Pedir este horário'}</Button>
            <Button className={outline} variant="outline" disabled={busy} onClick={() => { setView('home'); setError('') }}>Voltar</Button>
          </div>
          <p className="mt-3 text-center text-xs text-[#b49da3]">O novo horário fica reservado até a Gilvane confirmar.</p>
        </section>
      )}
    </Shell>
  )
}
