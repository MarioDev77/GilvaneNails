'use client'

import { useEffect, useState } from 'react'
import { Archive, History, Pencil, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, qs } from '@/lib/api'
import { formatBRL, formatDate, formatDateKey, formatDateTime, METHOD_LABEL, STATUS_LABEL, toDateKey, whatsappLink } from '@/lib/format'
import type { Appointment, Client, Payment } from '@/lib/types'
import { useFetch, type Paginated } from '@/hooks/use-fetch'
import { ClientFormModal } from '@/components/forms'
import { AddButton, Badge, Btn, card, Confirm, EmptyState, ErrorBox, Modal, PageHeader, Spinner } from '@/components/ui-kit'

type History = {
  attendances: { id: string; performedAt: string; priceCents: number; discountCents: number; service: { name: string } | null; payments: Payment[] }[]
  futureAppointments: (Appointment & { service: { name: string } })[]
  payments: Payment[]
  pendingBalanceCents: number
}

function HistoryModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data, loading, error } = useFetch<History>(`/clients/${client.id}/history`)
  return (
    <Modal title={client.name} subtitle="Histórico da cliente" onClose={onClose} wide>
      {loading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorBox message={error ?? 'Erro'} />
      ) : (
        <div className="flex flex-col gap-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#fff8fa] p-3">
              <p className="text-xs text-[#9d858d]">Atendimentos</p>
              <p className="text-lg font-semibold text-[#39252b]">{data.attendances.length}</p>
            </div>
            <div className="rounded-xl bg-[#fff8fa] p-3">
              <p className="text-xs text-[#9d858d]">Saldo em aberto</p>
              <p className={`text-lg font-semibold ${data.pendingBalanceCents > 0 ? 'text-[#c0504d]' : 'text-[#39252b]'}`}>{formatBRL(data.pendingBalanceCents)}</p>
            </div>
          </div>
          {client.notes && <p className="rounded-xl bg-[#f8f0e5] p-3 text-xs text-[#7a5d3f]">📝 {client.notes}</p>}
          <section>
            <h4 className="mb-2 font-semibold text-[#39252b]">Próximos agendamentos</h4>
            {data.futureAppointments.length === 0 ? (
              <p className="text-xs text-[#9d858d]">Nenhum agendamento futuro.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.futureAppointments.map((a) => (
                  <li key={a.id} className="flex justify-between text-xs">
                    <span>
                      {formatDateTime(a.startsAt)} • {a.service.name}
                    </span>
                    <Badge tone="gray">{STATUS_LABEL[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="mb-2 font-semibold text-[#39252b]">Últimos atendimentos</h4>
            {data.attendances.length === 0 ? (
              <p className="text-xs text-[#9d858d]">Ainda não há atendimentos.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.attendances.map((a) => {
                  const paid = a.payments.reduce((s, p) => s + p.amountCents, 0)
                  const due = a.priceCents - a.discountCents
                  return (
                    <li key={a.id} className="flex justify-between gap-2 text-xs">
                      <span>
                        {formatDate(a.performedAt)} • {a.service?.name ?? 'Sem serviço'}
                      </span>
                      <span className="font-semibold">
                        {formatBRL(due)} {paid >= due ? '✓' : `(pago ${formatBRL(paid)})`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          {data.payments.length > 0 && (
            <section>
              <h4 className="mb-2 font-semibold text-[#39252b]">Pagamentos recentes</h4>
              <ul className="flex flex-col gap-1.5">
                {data.payments.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex justify-between text-xs">
                    <span>
                      {formatDate(p.paidAt)} • {METHOD_LABEL[p.method]}
                    </span>
                    <span className="font-semibold">{formatBRL(p.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function ClientsPage({ autoNew }: { autoNew: boolean }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [form, setForm] = useState<{ client?: Client } | null>(null)
  const [history, setHistory] = useState<Client | null>(null)
  const [archiving, setArchiving] = useState<Client | null>(null)

  useEffect(() => {
    if (autoNew) setForm({})
  }, [autoNew])
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, loading, error, reload } = useFetch<Paginated<Client>>(`/clients${qs({ search: debounced, limit: 100 })}`)
  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Users} title="Minhas clientes" subtitle="Tenha tudo sobre suas clientes em um só lugar." action={<AddButton onClick={() => setForm({})}>Nova</AddButton>} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#c4b0b6]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pelo nome ou telefone" aria-label="Buscar cliente" className="w-full rounded-xl border border-[#efdde2] bg-white py-3 pl-10 pr-3 text-[#39252b] outline-none placeholder:text-[#c4b0b6] focus:border-[#e58aa0] focus:ring-2 focus:ring-[#f9d9e3]" />
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={debounced ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente ainda'} text={debounced ? 'Tente outro nome ou telefone.' : 'Cadastre sua primeira cliente para começar a agendar.'} action={!debounced && <AddButton onClick={() => setForm({})}>Cadastrar cliente</AddButton>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#39252b]">{c.name}</p>
                  <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" className="text-xs text-[#32875d] hover:underline">
                    {c.phone}
                  </a>
                  {c.birthday && <p className="mt-0.5 text-xs text-[#9d858d]">🎂 {formatDateKey(toDateKey(c.birthday), { day: '2-digit', month: 'long' })}</p>}
                </div>
              </div>
              {c.notes && <p className="mt-2 line-clamp-2 text-xs italic text-[#b49da3]">“{c.notes}”</p>}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f6ecef] pt-3">
                <Btn size="sm" variant="soft" onClick={() => setHistory(c)}>
                  <History className="size-3.5" /> Histórico
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setForm({ client: c })}>
                  <Pencil className="size-3.5" /> Editar
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setArchiving(c)}>
                  <Archive className="size-3.5" /> Arquivar
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <ClientFormModal
          client={form.client}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}
      {history && <HistoryModal client={history} onClose={() => setHistory(null)} />}
      {archiving && (
        <Confirm
          title="Arquivar cliente?"
          text={`${archiving.name} sai da lista e não aparece mais para novos agendamentos. O histórico e o financeiro são mantidos.`}
          confirmLabel="Arquivar"
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            try {
              await api.del(`/clients/${archiving.id}`)
              toast.success('Cliente arquivada')
              setArchiving(null)
              reload()
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : 'Erro ao arquivar')
            }
          }}
        />
      )}
    </div>
  )
}
