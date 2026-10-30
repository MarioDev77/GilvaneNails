'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, Check, Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Service = { id: string; name: string; description?: string | null; priceCents: number; durationMinutes: number }
type Slot = { startsAt: string; time: string }
type Done = { startsAt: string; service: { name: string }; manageUrl?: string }

const money = (c: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((c || 0) / 100)

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

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

const inputClass =
  'w-full rounded-xl border border-[#ead9de] bg-white p-3 text-[#39252b] placeholder:text-[#b49da3] outline-none focus:border-[#d85f7b]'

export default function PublicBooking() {
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slot, setSlot] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // campo isca anti-robô
  const [busy, setBusy] = useState(false)
  const [servicesError, setServicesError] = useState('')
  const [slotsError, setSlotsError] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const dataRef = useRef<HTMLElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const { minDate, maxDate } = useMemo(() => {
    const today = bahiaToday()
    return { minDate: today, maxDate: addDaysKey(today, 60) }
  }, [])

  const service = services.find((s) => s.id === serviceId)

  useEffect(() => {
    request('/api/public/services')
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch((e) => setServicesError(e.message))
      .finally(() => setLoadingServices(false))
  }, [])

  useEffect(() => {
    setSlot('')
    setSlots([])
    if (!serviceId || !date) return
    let cancelled = false
    setLoadingSlots(true)
    setSlotsError('')
    request(`/api/public/availability?date=${date}&serviceId=${serviceId}`)
      .then((data) => !cancelled && setSlots(data?.slots || []))
      .catch((e) => !cancelled && setSlotsError(e.message))
      .finally(() => !cancelled && setLoadingSlots(false))
    return () => {
      cancelled = true
    }
  }, [serviceId, date])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!serviceId || !slot) return setError('Escolha o serviço, o dia e o horário.')
    setBusy(true)
    try {
      const data = await request('/api/public/bookings', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          serviceId,
          startsAt: slot,
          notes: notes || undefined,
          website: website || undefined,
        }),
      })
      setDone({
        startsAt: data?.startsAt || slot,
        service: { name: data?.service?.name || service?.name || '' },
        manageUrl: data?.id && data?.manageToken ? `/agendar/meu-horario?id=${encodeURIComponent(data.id)}&t=${encodeURIComponent(data.manageToken)}` : undefined,
      })
    } catch (err: any) {
      setError(err.message)
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      // Se o horário foi ocupado por outra pessoa, recarrega a lista de horários.
      if (date && serviceId) {
        request(`/api/public/availability?date=${date}&serviceId=${serviceId}`)
          .then((data) => {
            setSlots(data?.slots || [])
            setSlot('')
          })
          .catch(() => {})
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const when = new Date(done.startsAt).toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Bahia',
    })
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7f8] p-4 text-[#39252b]">
        <div className="w-full max-w-md rounded-3xl border border-[#f2dfe5] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-green-50 text-green-600">
            <Check size={30} />
          </div>
          <h1 className="text-2xl font-bold">Pedido enviado!</h1>
          <p className="mt-3 text-sm text-[#806b72]">
            {done.service.name && <><strong>{done.service.name}</strong><br /></>}
            {when}
          </p>
          <p className="mt-4 rounded-xl bg-[#fff5f7] p-3 text-sm text-[#806b72]">
            Seu horário está reservado e aguardando a confirmação da Gilvane. Ela vai entrar em contato pelo telefone informado.
          </p>
          {done.manageUrl && (
            <p className="mt-4 text-sm text-[#806b72]">
              Precisa mudar de ideia?{' '}
              <a href={done.manageUrl} className="font-semibold text-[#c94f6c] underline">Remarcar ou cancelar meu horário</a>
              <span className="mt-1 block text-xs text-[#b49da3]">Salve esta página nos favoritos: o link é só seu.</span>
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#fff7f8] p-4 text-[#39252b] sm:p-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 text-center">
          <img src="/logo-circle.png" alt="" width={144} height={144} className="mx-auto mb-2 size-32 sm:size-36" />
          <h1 className="sr-only">Gilvane Nails</h1>
          <p className="mt-1 text-sm text-[#9d858d]">Escolha o serviço, o dia e o horário que prefere</p>
        </header>

        <form onSubmit={submit} className="space-y-5">
          <section className="rounded-2xl border border-[#f2e4e8] bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Sparkles size={17} className="text-[#d85f7b]" /> 1. Serviço</h2>
            {servicesError && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{servicesError}</p>}
            {loadingServices ? (
              <p className="text-sm text-[#9d858d]">Carregando serviços…</p>
            ) : services.length === 0 && !servicesError ? (
              <p className="text-sm text-[#9d858d]">Nenhum serviço disponível no momento.</p>
            ) : (
              <div className="grid gap-2">
                {services.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setServiceId(s.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      serviceId === s.id ? 'border-[#d85f7b] bg-[#fff0f3]' : 'border-[#ead9de] bg-white hover:bg-[#fff8f9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-sm font-semibold text-[#c75d79]">{money(s.priceCents)}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#9d858d]">
                      <Clock size={12} /> {s.durationMinutes} min{s.description ? ` · ${s.description}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#f2e4e8] bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays size={17} className="text-[#d85f7b]" /> 2. Dia e horário</h2>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              disabled={!serviceId}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
            {!serviceId && <p className="mt-2 text-xs text-[#9d858d]">Escolha um serviço primeiro.</p>}
            {serviceId && date && (
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
                        onClick={() => { setSlot(s.startsAt); setError(''); setTimeout(() => dataRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120) }}
                        className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                          slot === s.startsAt
                            ? 'border-[#d85f7b] bg-[#d85f7b] text-white'
                            : 'border-[#ead9de] bg-white hover:bg-[#fff0f3]'
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section ref={dataRef} className="scroll-mt-4 rounded-2xl border border-[#f2e4e8] bg-white p-5">
            <h2 className="mb-3 font-semibold">3. Seus dados</h2>
            <label className="mb-3 block text-sm">
              <span className="mb-1.5 block font-medium">Nome *</span>
              <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Seu nome" autoComplete="name" />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1.5 block font-medium">Telefone / WhatsApp *</span>
              <input required inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} className={inputClass} placeholder="(75) 99999-9999" autoComplete="tel" />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Observações</span>
              <textarea rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Algum pedido ou detalhe? (opcional)" />
            </label>
            {/* Campo isca: escondido de pessoas, robôs costumam preencher */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label>
                Site
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
          </section>

          {service && slot && (
            <div className="rounded-2xl border border-[#f2dfe5] bg-[#fff5f7] p-4 text-sm">
              <p className="font-semibold">{service.name} · {money(service.priceCents)}</p>
              <p className="mt-0.5 text-[#806b72]">{niceWhen(slot)} · {service.durationMinutes} min</p>
            </div>
          )}
          {error && <p ref={errorRef} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button
            type="submit"
            disabled={busy || !serviceId || !slot}
            className="w-full rounded-xl bg-[#d85f7b] py-6 text-base text-white hover:bg-[#c94f6c] disabled:opacity-50"
          >
            {busy ? 'Enviando…' : 'Solicitar horário'}
          </Button>
          <p className="text-center text-xs text-[#b49da3]">O horário fica reservado até a Gilvane confirmar.</p>
        </form>
      </div>
    </main>
  )
}
