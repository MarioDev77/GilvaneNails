'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Check, Pencil, UserX, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, qs } from '@/lib/api'
import { addDaysKey, formatBRL, formatLongDate, STATUS_LABEL, todayKey, toTimeKey, whatsappLink } from '@/lib/format'
import type { Appointment } from '@/lib/types'
import { useFetch, type Paginated } from '@/hooks/use-fetch'
import { AppointmentFormModal, AttendanceFormModal } from '@/components/forms'
import { AddButton, Badge, Btn, card, Confirm, EmptyState, ErrorBox, PageHeader, Spinner, statusTone } from '@/components/ui-kit'

export default function AgendaPage({ autoNew }: { autoNew: boolean }) {
  const [day, setDay] = useState(todayKey())
  const [form, setForm] = useState<{ appointment?: Appointment } | null>(null)
  const [attend, setAttend] = useState<Appointment | null>(null)
  const [confirm, setConfirm] = useState<{ appointment: Appointment; status: 'CANCELLED' | 'NO_SHOW' } | null>(null)

  useEffect(() => {
    if (autoNew) setForm({})
  }, [autoNew])

  const { data, loading, error, reload } = useFetch<Paginated<Appointment>>(`/appointments${qs({ startDate: day, endDate: day, limit: 100 })}`)
  const items = data?.items ?? []
  const active = items.filter((a) => a.status !== 'CANCELLED')
  const total = active.reduce((s, a) => s + a.agreedPriceCents, 0)

  async function setStatus(a: Appointment, status: string) {
    try {
      await api.patch(`/appointments/${a.id}/status`, { status })
      toast.success(`Marcado como ${STATUS_LABEL[status].toLowerCase()}`)
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível alterar')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={CalendarDays} title="Agenda de atendimentos" subtitle="Organize seus horários e nunca perca um compromisso." action={<AddButton onClick={() => setForm({})}>Agendar</AddButton>} />

      <div className={`${card} flex items-center justify-between gap-2 p-3`}>
        <Btn variant="ghost" size="sm" aria-label="Dia anterior" onClick={() => setDay(addDaysKey(day, -1))}>
          <ChevronLeft className="size-4" />
        </Btn>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-semibold text-[#39252b]">{formatLongDate(day)}</p>
          <div className="flex items-center gap-2">
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Escolher data" className="rounded-lg border border-[#efdde2] px-2 py-1 text-xs text-[#7a5d66]" />
            {day !== todayKey() && (
              <button onClick={() => setDay(todayKey())} className="text-xs font-semibold text-[#c75d79]">
                Hoje
              </button>
            )}
          </div>
        </div>
        <Btn variant="ghost" size="sm" aria-label="Próximo dia" onClick={() => setDay(addDaysKey(day, 1))}>
          <ChevronRight className="size-4" />
        </Btn>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum horário neste dia" text="Toque em “Agendar” para marcar o primeiro atendimento." action={<AddButton onClick={() => setForm({})}>Agendar</AddButton>} />
      ) : (
        <>
          <p className="-mb-3 text-xs text-[#9d858d]">
            {active.length} {active.length === 1 ? 'atendimento' : 'atendimentos'} • previsto {formatBRL(total)}
          </p>
          <div className="flex flex-col gap-3">
            {items.map((a) => {
              const open = a.status === 'SCHEDULED' || a.status === 'CONFIRMED'
              return (
                <div key={a.id} className={`${card} p-4 ${a.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-base font-semibold text-[#39252b]">{toTimeKey(a.startsAt)}</p>
                      <p className="text-[10px] text-[#b49da3]">até {toTimeKey(a.endsAt)}</p>
                    </div>
                    <div className="h-12 w-px bg-[#f0dfe4]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#39252b]">{a.client.name}</p>
                      <p className="truncate text-xs text-[#9d858d]">{a.service.name}</p>
                      {a.notes && <p className="mt-1 text-xs italic text-[#b49da3]">“{a.notes}”</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="text-sm font-semibold text-[#39252b]">{formatBRL(a.agreedPriceCents)}</p>
                      <Badge tone={statusTone(a.status)}>{STATUS_LABEL[a.status]}</Badge>
                    </div>
                  </div>
                  {open && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f6ecef] pt-3">
                      <Btn size="sm" onClick={() => setAttend(a)}>
                        <Check className="size-3.5" /> Atender
                      </Btn>
                      {a.status === 'SCHEDULED' && (
                        <Btn size="sm" variant="soft" onClick={() => setStatus(a, 'CONFIRMED')}>
                          Confirmar
                        </Btn>
                      )}
                      {a.client.phone && (
                        <a href={whatsappLink(a.client.phone)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-xl px-3 text-xs font-medium text-[#32875d] hover:bg-[#e6f5ed]">
                          WhatsApp
                        </a>
                      )}
                      <Btn size="sm" variant="ghost" onClick={() => setForm({ appointment: a })}>
                        <Pencil className="size-3.5" /> Editar
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setConfirm({ appointment: a, status: 'NO_SHOW' })}>
                        <UserX className="size-3.5" /> Faltou
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => setConfirm({ appointment: a, status: 'CANCELLED' })}>
                        <X className="size-3.5" /> Cancelar
                      </Btn>
                    </div>
                  )}
                  {(a.status === 'CANCELLED' || a.status === 'NO_SHOW') && (
                    <div className="mt-3 border-t border-[#f6ecef] pt-3">
                      <Btn size="sm" variant="outline" onClick={() => setStatus(a, 'SCHEDULED')}>
                        Reativar horário
                      </Btn>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {form && (
        <AppointmentFormModal
          appointment={form.appointment}
          defaultDate={day}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}
      {attend && (
        <AttendanceFormModal
          appointment={attend}
          onClose={() => setAttend(null)}
          onSaved={() => {
            setAttend(null)
            reload()
          }}
        />
      )}
      {confirm && (
        <Confirm
          danger={confirm.status === 'CANCELLED'}
          title={confirm.status === 'CANCELLED' ? 'Cancelar agendamento?' : 'Marcar como falta?'}
          text={`${confirm.appointment.client.name} • ${toTimeKey(confirm.appointment.startsAt)}. O horário ficará livre para outra cliente.`}
          confirmLabel={confirm.status === 'CANCELLED' ? 'Cancelar agendamento' : 'Marcar falta'}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await setStatus(confirm.appointment, confirm.status)
            setConfirm(null)
          }}
        />
      )}
    </div>
  )
}
