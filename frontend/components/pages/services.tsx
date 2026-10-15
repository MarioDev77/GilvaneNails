'use client'

import { useEffect, useState } from 'react'
import { Clock3, Pencil, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { formatBRL, moneyToInput, parseMoney } from '@/lib/format'
import type { Service } from '@/lib/types'
import { useFetch, type Paginated } from '@/hooks/use-fetch'
import { AddButton, Badge, Btn, card, EmptyState, ErrorBox, FormActions, FormError, Modal, MoneyField, PageHeader, Spinner, TextArea, TextField } from '@/components/ui-kit'

function ServiceFormModal({ service, onClose, onSaved }: { service?: Service; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(service?.name ?? '')
  const [price, setPrice] = useState(service ? moneyToInput(service.priceCents) : '')
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 60))
  const [description, setDescription] = useState(service?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseMoney(price)
    if (cents === null) return setError('Informe um preço válido.')
    const minutes = Number(duration)
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) return setError('A duração deve ficar entre 5 e 480 minutos.')
    setBusy(true)
    setError(null)
    try {
      const body = { name, priceCents: cents, durationMinutes: minutes, description: description || null }
      if (service) await api.patch(`/services/${service.id}`, body)
      else await api.post('/services', body)
      toast.success(service ? 'Serviço atualizado' : 'Serviço criado')
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={service ? 'Editar serviço' : 'Novo serviço'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nome do serviço" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Alongamento em gel" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Preço" value={price} onChange={setPrice} required />
          <TextField label="Duração (min)" type="number" inputMode="numeric" min={5} max={480} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} required />
        </div>
        <TextArea label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} />
      </form>
    </Modal>
  )
}

export default function ServicesPage({ autoNew }: { autoNew: boolean }) {
  const [form, setForm] = useState<{ service?: Service } | null>(null)
  useEffect(() => {
    if (autoNew) setForm({})
  }, [autoNew])

  const { data, loading, error, reload } = useFetch<Paginated<Service>>('/services?limit=100')
  const items = data?.items ?? []

  async function toggle(s: Service) {
    try {
      await api.patch(`/services/${s.id}`, { isActive: !s.isActive })
      toast.success(s.isActive ? 'Serviço desativado' : 'Serviço reativado')
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Sparkles} title="Serviços oferecidos" subtitle="Gerencie seus serviços, preços e durações." action={<AddButton onClick={() => setForm({})}>Novo</AddButton>} />
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nenhum serviço cadastrado" text="Cadastre seus serviços com preço e duração para poder agendar." action={<AddButton onClick={() => setForm({})}>Cadastrar serviço</AddButton>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((s) => (
            <div key={s.id} className={`${card} p-4 ${s.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#39252b]">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[#9d858d]">
                    <Clock3 className="size-3.5" /> {s.durationMinutes} min
                  </p>
                  {s.description && <p className="mt-1 line-clamp-2 text-xs text-[#b49da3]">{s.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="font-semibold text-[#39252b]">{formatBRL(s.priceCents)}</p>
                  {!s.isActive && <Badge tone="gray">Inativo</Badge>}
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-[#f6ecef] pt-3">
                <Btn size="sm" variant="ghost" onClick={() => setForm({ service: s })}>
                  <Pencil className="size-3.5" /> Editar
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => toggle(s)}>
                  {s.isActive ? 'Desativar' : 'Reativar'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {form && (
        <ServiceFormModal
          service={form.service}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
