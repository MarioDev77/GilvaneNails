'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { qs } from '@/lib/api'
import { addMonthsKey, formatBRL, formatDateTime, formatMonthKey, METHOD_LABEL, monthEndKey, monthStartKey, todayKey } from '@/lib/format'
import type { Attendance } from '@/lib/types'
import { useFetch, type Paginated } from '@/hooks/use-fetch'
import { AttendanceFormModal, PaymentModal } from '@/components/forms'
import { AddButton, Badge, Btn, card, EmptyState, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui-kit'

export default function AttendancesPage({ autoNew }: { autoNew: boolean }) {
  const [month, setMonth] = useState(monthStartKey(todayKey()))
  const [form, setForm] = useState(false)
  const [paying, setPaying] = useState<Attendance | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (autoNew) setForm(true)
  }, [autoNew])

  const { data, loading, error, reload } = useFetch<Paginated<Attendance>>(`/attendances${qs({ startDate: month, endDate: monthEndKey(month), limit: 100 })}`)
  const items = data?.items ?? []
  const billed = items.reduce((s, a) => s + a.dueCents, 0)
  const paid = items.reduce((s, a) => s + a.paidCents, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Check} title="Atendimentos realizados" subtitle="Acompanhe os serviços realizados e pagamentos." action={<AddButton onClick={() => setForm(true)}>Novo</AddButton>} />

      <div className={`${card} flex items-center justify-between p-3`}>
        <Btn variant="ghost" size="sm" onClick={() => setMonth(addMonthsKey(month, -1))}>
          ← Anterior
        </Btn>
        <p className="text-sm font-semibold text-[#39252b]">{formatMonthKey(month)}</p>
        <Btn variant="ghost" size="sm" onClick={() => setMonth(addMonthsKey(month, 1))}>
          Próximo →
        </Btn>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={Check} title="Nenhum atendimento neste mês" text="Registre um atendimento pela agenda (botão “Atender”) ou use “Novo” para um atendimento sem agendamento." action={<AddButton onClick={() => setForm(true)}>Novo atendimento</AddButton>} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Atendimentos" value={String(items.length)} />
            <Stat label="Recebido" value={formatBRL(paid)} tone="green" />
            <Stat label="A receber" value={formatBRL(billed - paid)} tone={billed - paid > 0 ? 'red' : 'pink'} />
          </div>
          <div className="flex flex-col gap-3">
            {items.map((a) => {
              const open = openId === a.id
              return (
                <div key={a.id} className={`${card} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#39252b]">{a.client.name}</p>
                      <p className="truncate text-xs text-[#9d858d]">
                        {a.service?.name ?? 'Sem serviço'} • {formatDateTime(a.performedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="text-sm font-semibold text-[#39252b]">{formatBRL(a.dueCents)}</p>
                      {a.balanceCents <= 0 ? <Badge tone="green">Pago</Badge> : a.paidCents > 0 ? <Badge tone="amber">Falta {formatBRL(a.balanceCents)}</Badge> : <Badge tone="red">A receber</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#f6ecef] pt-3">
                    {a.balanceCents > 0 && (
                      <Btn size="sm" onClick={() => setPaying(a)}>
                        <Wallet className="size-3.5" /> Receber
                      </Btn>
                    )}
                    <Btn size="sm" variant="ghost" onClick={() => setOpenId(open ? null : a.id)}>
                      Detalhes {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Btn>
                  </div>
                  {open && (
                    <div className="mt-3 rounded-xl bg-[#fff8fa] p-3 text-xs text-[#60444d]">
                      <p>
                        Valor {formatBRL(a.priceCents)}
                        {a.discountCents > 0 && ` − desconto ${formatBRL(a.discountCents)}`} = <strong>{formatBRL(a.dueCents)}</strong>
                      </p>
                      {a.notes && <p className="mt-1 italic">“{a.notes}”</p>}
                      <p className="mt-2 font-semibold">Pagamentos</p>
                      {a.payments.length === 0 ? (
                        <p className="text-[#9d858d]">Nenhum pagamento registrado.</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-1">
                          {a.payments.map((p) => (
                            <li key={p.id} className="flex justify-between">
                              <span>
                                {formatDateTime(p.paidAt)} • {METHOD_LABEL[p.method]}
                              </span>
                              <span className="font-semibold">{formatBRL(p.amountCents)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {form && (
        <AttendanceFormModal
          onClose={() => setForm(false)}
          onSaved={() => {
            setForm(false)
            reload()
          }}
        />
      )}
      {paying && (
        <PaymentModal
          attendance={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
