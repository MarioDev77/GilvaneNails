'use client'

import { useEffect, useState } from 'react'
import { Pencil, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, qs } from '@/lib/api'
import { addMonthsKey, EXPENSE_STATUS_LABEL, formatBRL, formatDate, formatMonthKey, METHOD_LABEL, moneyToInput, monthEndKey, monthStartKey, parseMoney, todayKey, toDateKey } from '@/lib/format'
import type { Expense, ExpenseCategory, PaymentMethod } from '@/lib/types'
import { useFetch, type Paginated } from '@/hooks/use-fetch'
import { AddButton, Badge, Btn, card, Confirm, EmptyState, ErrorBox, FormActions, FormError, Modal, MoneyField, PageHeader, SelectField, Spinner, Stat, TextArea, TextField } from '@/components/ui-kit'

type Summary = {
  incomeReceivedCents: number
  expensesPaidCents: number
  cashBalanceCents: number
  expensesPendingCents: number
  receivablesCents: number
}

function ExpenseFormModal({ expense, onClose, onSaved }: { expense?: Expense; onClose: () => void; onSaved: () => void }) {
  const cats = useFetch<ExpenseCategory[]>('/categories')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? moneyToInput(expense.amountCents) : '')
  const [date, setDate] = useState(expense ? toDateKey(expense.incurredAt) : todayKey())
  const [dueAt, setDueAt] = useState(expense?.dueAt ? toDateKey(expense.dueAt) : '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [newCat, setNewCat] = useState('')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [paidNow, setPaidNow] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseMoney(amount)
    if (!cents) return setError('Informe um valor maior que zero.')
    setBusy(true)
    setError(null)
    try {
      let catId: string | null = categoryId || null
      if (categoryId === '__new') {
        if (!newCat.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Digite o nome da nova categoria.')
        const c = await api.post<ExpenseCategory>('/categories', { name: newCat })
        catId = c.id
      }
      const body = { description, amountCents: cents, incurredAt: date, dueAt: dueAt || null, categoryId: catId, notes: notes || null }
      let saved: Expense
      if (expense) saved = await api.patch<Expense>(`/finance/expenses/${expense.id}`, body)
      else saved = await api.post<Expense>('/finance/expenses', body)
      if (!expense && paidNow) await api.patch(`/finance/expenses/${saved.id}/pay`, { paymentMethod: method })
      toast.success(expense ? 'Despesa atualizada' : 'Despesa lançada')
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar despesa' : 'Lançar despesa'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Esmaltes e algodão" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Valor" value={amount} onChange={setAmount} required />
          <TextField label="Data da despesa" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <SelectField label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">+ Nova categoria...</option>
        </SelectField>
        {categoryId === '__new' && <TextField label="Nome da nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} />}
        <TextField label="Vencimento (opcional)" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        {!expense && (
          <label className="flex items-center gap-2 text-sm font-medium text-[#60444d]">
            <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="size-4 accent-[#d85f7b]" />
            Já foi paga
          </label>
        )}
        {paidNow && (
          <SelectField label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.entries(METHOD_LABEL) as [PaymentMethod, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectField>
        )}
        <TextArea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} />
      </form>
    </Modal>
  )
}

function PayExpenseModal({ expense, onClose, onSaved }: { expense: Expense; onClose: () => void; onSaved: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>(expense.paymentMethod ?? 'PIX')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal title="Marcar como paga" subtitle={`${expense.description} — ${formatBRL(expense.amountCents)}`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api.patch(`/finance/expenses/${expense.id}/pay`, { paymentMethod: method })
            toast.success('Despesa paga')
            onSaved()
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Erro')
          } finally {
            setBusy(false)
          }
        }}
      >
        <SelectField label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {(Object.entries(METHOD_LABEL) as [PaymentMethod, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <FormError message={error} />
        <FormActions onCancel={onClose} loading={busy} submitLabel="Confirmar pagamento" />
      </form>
    </Modal>
  )
}

export default function FinancePage({ autoNew }: { autoNew: boolean }) {
  const [month, setMonth] = useState(monthStartKey(todayKey()))
  const [tab, setTab] = useState<'month' | 'pending'>('month')
  const [form, setForm] = useState<{ expense?: Expense } | null>(null)
  const [paying, setPaying] = useState<Expense | null>(null)
  const [canceling, setCanceling] = useState<Expense | null>(null)

  useEffect(() => {
    if (autoNew) setForm({})
  }, [autoNew])

  const summary = useFetch<Summary>(`/finance/summary${qs({ startDate: month, endDate: monthEndKey(month) })}`)
  const list = useFetch<Paginated<Expense>>(`/finance/expenses${tab === 'pending' ? qs({ status: 'PENDING', limit: 100 }) : qs({ startDate: month, endDate: monthEndKey(month), limit: 100 })}`)
  const items = list.data?.items ?? []
  const s = summary.data

  const reloadAll = () => {
    summary.reload()
    list.reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Wallet} title="Controle financeiro" subtitle="Acompanhe suas receitas, despesas e resultados." action={<AddButton onClick={() => setForm({})}>Despesa</AddButton>} />

      <div className={`${card} flex items-center justify-between p-3`}>
        <Btn variant="ghost" size="sm" onClick={() => setMonth(addMonthsKey(month, -1))}>
          ← Anterior
        </Btn>
        <p className="text-sm font-semibold text-[#39252b]">{formatMonthKey(month)}</p>
        <Btn variant="ghost" size="sm" onClick={() => setMonth(addMonthsKey(month, 1))}>
          Próximo →
        </Btn>
      </div>

      {summary.error ? (
        <ErrorBox message={summary.error} onRetry={summary.reload} />
      ) : s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Recebido no mês" value={formatBRL(s.incomeReceivedCents)} tone="green" />
          <Stat label="Despesas pagas" value={formatBRL(s.expensesPaidCents)} />
          <Stat label="Saldo do mês" value={formatBRL(s.cashBalanceCents)} tone={s.cashBalanceCents < 0 ? 'red' : 'green'} helper="recebido − despesas pagas" />
          <Stat label="A receber (total)" value={formatBRL(s.receivablesCents)} helper={`Despesas a pagar: ${formatBRL(s.expensesPendingCents)}`} />
        </div>
      ) : (
        <Spinner />
      )}

      <div className="flex gap-2">
        <Btn size="sm" variant={tab === 'month' ? 'primary' : 'outline'} onClick={() => setTab('month')}>
          Despesas do mês
        </Btn>
        <Btn size="sm" variant={tab === 'pending' ? 'primary' : 'outline'} onClick={() => setTab('pending')}>
          Pendentes (todas)
        </Btn>
      </div>

      {list.loading && !list.data ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={Wallet} title={tab === 'pending' ? 'Nenhuma despesa pendente' : 'Nenhuma despesa neste mês'} text="Lance suas despesas (materiais, aluguel, transporte...) para ver o resultado real do mês." action={<AddButton onClick={() => setForm({})}>Lançar despesa</AddButton>} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((x) => (
            <div key={x.id} className={`${card} p-4 ${x.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#39252b]">{x.description}</p>
                  <p className="text-xs text-[#9d858d]">
                    {x.category?.name ?? 'Sem categoria'} • {formatDate(x.incurredAt)}
                    {x.dueAt && x.status === 'PENDING' && ` • vence ${formatDate(x.dueAt)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-sm font-semibold text-[#39252b]">{formatBRL(x.amountCents)}</p>
                  <Badge tone={x.status === 'PAID' ? 'green' : x.status === 'CANCELLED' ? 'gray' : 'amber'}>{EXPENSE_STATUS_LABEL[x.status]}</Badge>
                </div>
              </div>
              {x.status !== 'CANCELLED' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f6ecef] pt-3">
                  {x.status === 'PENDING' && (
                    <Btn size="sm" onClick={() => setPaying(x)}>
                      Pagar
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={() => setForm({ expense: x })}>
                    <Pencil className="size-3.5" /> Editar
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setCanceling(x)}>
                    Cancelar despesa
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {form && (
        <ExpenseFormModal
          expense={form.expense}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reloadAll()
          }}
        />
      )}
      {paying && (
        <PayExpenseModal
          expense={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null)
            reloadAll()
          }}
        />
      )}
      {canceling && (
        <Confirm
          danger
          title="Cancelar despesa?"
          text={`“${canceling.description}” deixa de contar no financeiro, mas continua no histórico.`}
          confirmLabel="Cancelar despesa"
          onClose={() => setCanceling(null)}
          onConfirm={async () => {
            try {
              await api.patch(`/finance/expenses/${canceling.id}/cancel`)
              toast.success('Despesa cancelada')
              setCanceling(null)
              reloadAll()
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : 'Erro')
            }
          }}
        />
      )}
    </div>
  )
}

