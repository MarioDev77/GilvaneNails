'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, qs } from '@/lib/api'
import { formatBRL, METHOD_LABEL, moneyToInput, parseMoney, todayKey, toDateKey, toISO, toTimeKey } from '@/lib/format'
import { uid } from '@/lib/uid'
import type { Appointment, Attendance, Client, PaymentMethod, Service } from '@/lib/types'
import type { Paginated } from '@/hooks/use-fetch'
import { Field, FormActions, FormError, Modal, MoneyField, SelectField, TextArea, TextField } from './ui-kit'

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo deu errado. Tente novamente.')

/* ------------------------------ Cliente ------------------------------ */

export function ClientFormModal({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (c: Client) => void }) {
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [birthday, setBirthday] = useState(client?.birthday ? toDateKey(client.birthday) : '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = { name, phone, birthday: birthday || null, notes: notes || null }
      const saved = client ? await api.patch<Client>(`/clients/${client.id}`, body) : await api.post<Client>('/clients', body)
      toast.success(client ? 'Cliente atualizada' : 'Cliente cadastrada')
      onSaved(saved)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={client ? 'Editar cliente' : 'Nova cliente'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <TextField label="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(75) 99999-9999" inputMode="tel" required />
        <TextField label="Aniversário (opcional)" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <TextArea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, preferências, formato das unhas..." />
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} />
      </form>
    </Modal>
  )
}

/** Busca de cliente com sugestões e opção de cadastrar na hora */
export function ClientPicker({ value, onChange, disabled }: { value: { id: string; name: string } | null; onChange: (c: { id: string; name: string } | null) => void; disabled?: boolean }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Client[]>([])
  const [creating, setCreating] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      try {
        const r = await api.get<Paginated<Client>>(`/clients${qs({ search: text, limit: 8 })}`)
        setResults(r.items)
      } catch {
        setResults([])
      }
    }, 200)
    return () => clearTimeout(t)
  }, [text, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <Field label="Cliente">
      {(id) =>
        value ? (
          <div className="flex items-center justify-between rounded-xl border border-[#efdde2] bg-[#fff8fa] px-3 py-2.5">
            <span className="text-sm font-medium text-[#39252b]">{value.name}</span>
            {!disabled && (
              <button type="button" aria-label="Trocar cliente" onClick={() => onChange(null)} className="text-[#b49da3] hover:text-[#c75d79]">
                <X className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div ref={box} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#c4b0b6]" />
            <input
              id={id}
              autoComplete="off"
              placeholder="Buscar pelo nome ou telefone"
              value={text}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setText(e.target.value)
                setOpen(true)
              }}
              className="w-full rounded-xl border border-[#efdde2] bg-white py-2.5 pl-9 pr-3 text-[#39252b] outline-none placeholder:text-[#c4b0b6] focus:border-[#e58aa0] focus:ring-2 focus:ring-[#f9d9e3]"
            />
            {open && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#f2e4e8] bg-white p-1 shadow-xl">
                {results.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      onChange({ id: c.id, name: c.name })
                      setOpen(false)
                    }}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-[#fff5f7]"
                  >
                    <span className="text-sm font-medium text-[#39252b]">{c.name}</span>
                    <span className="text-xs text-[#9d858d]">{c.phone}</span>
                  </button>
                ))}
                {results.length === 0 && <p className="px-3 py-2 text-xs text-[#9d858d]">Nenhuma cliente encontrada.</p>}
                <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#c75d79] hover:bg-[#fff5f7]">
                  <Plus className="size-4" /> Cadastrar nova cliente
                </button>
              </div>
            )}
            {creating && (
              <ClientFormModal
                onClose={() => setCreating(false)}
                onSaved={(c) => {
                  setCreating(false)
                  setOpen(false)
                  onChange({ id: c.id, name: c.name })
                }}
              />
            )}
          </div>
        )
      }
    </Field>
  )
}

/* ---------------------------- Agendamento ---------------------------- */

export function AppointmentFormModal({ appointment, defaultDate, onClose, onSaved }: { appointment?: Appointment; defaultDate?: string; onClose: () => void; onSaved: () => void }) {
  const [client, setClient] = useState<{ id: string; name: string } | null>(appointment ? { id: appointment.client.id, name: appointment.client.name } : null)
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '')
  const [date, setDate] = useState(appointment ? toDateKey(appointment.startsAt) : (defaultDate ?? todayKey()))
  const [time, setTime] = useState(appointment ? toTimeKey(appointment.startsAt) : '09:00')
  const [price, setPrice] = useState(appointment ? moneyToInput(appointment.agreedPriceCents) : '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Paginated<Service>>('/services?activeOnly=true&limit=100').then((r) => setServices(r.items)).catch((e) => setError(errMsg(e)))
  }, [])

  function pickService(id: string) {
    setServiceId(id)
    const s = services.find((x) => x.id === id)
    if (s) setPrice(moneyToInput(s.priceCents)) // sugere o preço do serviço (pode ser editado)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!client) return setError('Escolha a cliente.')
    if (!serviceId) return setError('Escolha o serviço.')
    const cents = parseMoney(price)
    if (cents === null) return setError('Informe um valor válido.')
    setBusy(true)
    try {
      const body = { clientId: client.id, serviceId, startsAt: toISO(date, time), agreedPriceCents: cents, notes: notes || null }
      if (appointment) await api.patch(`/appointments/${appointment.id}`, body)
      else await api.post('/appointments', body)
      toast.success(appointment ? 'Agendamento atualizado' : 'Agendamento criado')
      onSaved()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const current = services.find((s) => s.id === serviceId)
  return (
    <Modal title={appointment ? 'Editar agendamento' : 'Novo agendamento'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ClientPicker value={client} onChange={setClient} />
        <SelectField label="Serviço" value={serviceId} onChange={(e) => pickService(e.target.value)} required>
          <option value="">Selecione...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatBRL(s.priceCents)} ({s.durationMinutes} min)
            </option>
          ))}
          {appointment && !services.some((s) => s.id === appointment.serviceId) && <option value={appointment.serviceId}>{appointment.service.name}</option>}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <TextField label="Horário" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required hint={current ? `Duração: ${current.durationMinutes} min` : undefined} />
        </div>
        <MoneyField label="Valor combinado" value={price} onChange={setPrice} required />
        <TextArea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} />
      </form>
    </Modal>
  )
}

/* ---------------------- Atendimento + pagamento ---------------------- */

const METHODS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

export function AttendanceFormModal({ appointment, onClose, onSaved }: { appointment?: Appointment; onClose: () => void; onSaved: () => void }) {
  const [client, setClient] = useState<{ id: string; name: string } | null>(appointment ? { id: appointment.client.id, name: appointment.client.name } : null)
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '')
  const [price, setPrice] = useState(appointment ? moneyToInput(appointment.agreedPriceCents) : '')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [paidNow, setPaidNow] = useState(true)
  const [payAmount, setPayAmount] = useState('')
  const [payTouched, setPayTouched] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const payKey = useRef(uid())

  useEffect(() => {
    api.get<Paginated<Service>>('/services?limit=100').then((r) => setServices(r.items)).catch(() => {})
  }, [])

  const priceCents = parseMoney(price) ?? 0
  const discountCents = parseMoney(discount) ?? 0
  const total = Math.max(0, priceCents - discountCents)
  // por padrão sugere receber o total; se ela digitar outro valor, respeita
  useEffect(() => {
    if (!payTouched) setPayAmount(moneyToInput(total))
  }, [total, payTouched])

  function pickService(id: string) {
    setServiceId(id)
    const s = services.find((x) => x.id === id)
    if (s && !appointment) setPrice(moneyToInput(s.priceCents))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!client) return setError('Escolha a cliente.')
    const p = parseMoney(price)
    if (p === null) return setError('Informe o valor do atendimento.')
    const d = discount ? parseMoney(discount) : 0
    if (d === null) return setError('Desconto inválido.')
    if (d > p) return setError('O desconto não pode ser maior que o valor.')
    let pay = 0
    if (paidNow) {
      const v = parseMoney(payAmount)
      if (v === null) return setError('Informe o valor recebido.')
      if (v > p - d) return setError('O valor recebido é maior que o total do atendimento.')
      pay = v
    }

    setBusy(true)
    let attendanceId: string | null = null
    try {
      const att = await api.post<Attendance>('/attendances', {
        appointmentId: appointment?.id ?? null,
        clientId: client.id,
        serviceId: serviceId || null,
        priceCents: p,
        discountCents: d,
        notes: notes || null,
      })
      attendanceId = att.id
      if (pay > 0) {
        await api.post(`/attendances/${att.id}/payments`, { amountCents: pay, method, idempotencyKey: payKey.current })
      }
      toast.success('Atendimento registrado')
      onSaved()
    } catch (e) {
      if (attendanceId) {
        // o atendimento já foi salvo; só o pagamento falhou
        toast.error(`Atendimento salvo, mas o pagamento não foi registrado: ${errMsg(e)}`)
        onSaved()
      } else {
        setError(errMsg(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Registrar atendimento" subtitle={appointment ? 'A partir do agendamento' : 'Atendimento sem agendamento'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ClientPicker value={client} onChange={setClient} disabled={!!appointment} />
        <SelectField label="Serviço" value={serviceId} onChange={(e) => pickService(e.target.value)}>
          <option value="">Sem serviço específico</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Valor" value={price} onChange={setPrice} required />
          <MoneyField label="Desconto" value={discount} onChange={setDiscount} />
        </div>
        <p className="-mt-2 text-sm text-[#7a5d66]">
          Total a cobrar: <strong>{formatBRL(total)}</strong>
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-[#60444d]">
          <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="size-4 accent-[#d85f7b]" />A cliente já pagou
        </label>
        {paidNow && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#fff8fa] p-3">
            <MoneyField
              label="Valor recebido"
              value={payAmount}
              onChange={(v) => {
                setPayTouched(true)
                setPayAmount(v)
              }}
              hint="Pode ser parcial"
            />
            <SelectField label="Forma" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <TextArea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} submitLabel="Registrar" />
      </form>
    </Modal>
  )
}

export function PaymentModal({ attendance, onClose, onSaved }: { attendance: Attendance; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(moneyToInput(attendance.balanceCents))
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef(uid()) // mesma chave em reenvios: nunca cobra duas vezes

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseMoney(amount)
    if (!cents) return setError('Informe um valor maior que zero.')
    if (cents > attendance.balanceCents) return setError(`O valor passa do saldo (${formatBRL(attendance.balanceCents)}).`)
    setBusy(true)
    setError(null)
    try {
      await api.post(`/attendances/${attendance.id}/payments`, { amountCents: cents, method, idempotencyKey: key.current })
      toast.success('Pagamento registrado')
      onSaved()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Receber pagamento" subtitle={`${attendance.client.name} — saldo ${formatBRL(attendance.balanceCents)}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <MoneyField label="Valor recebido" value={amount} onChange={setAmount} required />
        <SelectField label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} submitLabel="Receber" />
      </form>
    </Modal>
  )
}

