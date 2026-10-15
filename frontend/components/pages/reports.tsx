'use client'

import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { qs } from '@/lib/api'
import { addDaysKey, addMonthsKey, formatBRL, formatDateKey, formatMonthKey, METHOD_LABEL, monthEndKey, monthStartKey, todayKey } from '@/lib/format'
import { useFetch } from '@/hooks/use-fetch'
import { Btn, card, EmptyState, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui-kit'

type Report = {
  series: { period: string; incomeCents: number; expenseCents: number; resultCents: number }[]
  topServices: { serviceId: string; name: string; count: number; totalCents: number }[]
  paymentMethods: { method: string; count: number; totalCents: number }[]
  expensesByCategory: { name: string; count: number; totalCents: number }[]
}
type Summary = { incomeReceivedCents: number; expensesPaidCents: number; cashBalanceCents: number; grossBillingCents: number; totalDiscountsCents: number; receivablesCents: number }

type Preset = 'this' | 'last' | '30'

function range(preset: Preset) {
  const t = todayKey()
  if (preset === 'this') return { start: monthStartKey(t), end: monthEndKey(t) }
  if (preset === 'last') {
    const m = addMonthsKey(t, -1)
    return { start: m, end: monthEndKey(m) }
  }
  return { start: addDaysKey(t, -29), end: t }
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('this')
  const { start, end } = range(preset)
  const query = qs({ startDate: start, endDate: end })
  const report = useFetch<Report>(`/reports/financial${query}`)
  const summary = useFetch<Summary>(`/finance/summary${query}`)

  const label = preset === 'this' ? formatMonthKey(start) : preset === 'last' ? formatMonthKey(start) : 'Últimos 30 dias'
  const r = report.data
  const s = summary.data
  const chart = (r?.series ?? []).map((p) => ({
    name: formatDateKey(p.period.length === 7 ? `${p.period}-01` : p.period, p.period.length === 7 ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: '2-digit' }),
    Receitas: p.incomeCents / 100,
    Despesas: p.expenseCents / 100,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={BarChart3} title="Relatórios" subtitle="Enxergue o crescimento do seu negócio." />
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['this', 'Este mês'],
            ['last', 'Mês passado'],
            ['30', 'Últimos 30 dias'],
          ] as [Preset, string][]
        ).map(([k, v]) => (
          <Btn key={k} size="sm" variant={preset === k ? 'primary' : 'outline'} onClick={() => setPreset(k)}>
            {v}
          </Btn>
        ))}
        <span className="ml-1 text-xs text-[#9d858d]">{label}</span>
      </div>

      {report.error || summary.error ? (
        <ErrorBox message={(report.error ?? summary.error)!} onRetry={() => { report.reload(); summary.reload() }} />
      ) : !r || !s ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Faturamento" value={formatBRL(s.grossBillingCents - s.totalDiscountsCents)} helper={s.totalDiscountsCents ? `Descontos: ${formatBRL(s.totalDiscountsCents)}` : undefined} />
            <Stat label="Recebido" value={formatBRL(s.incomeReceivedCents)} tone="green" />
            <Stat label="Despesas pagas" value={formatBRL(s.expensesPaidCents)} />
            <Stat label="Resultado" value={formatBRL(s.cashBalanceCents)} tone={s.cashBalanceCents < 0 ? 'red' : 'green'} />
          </div>

          {chart.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sem movimentação neste período" text="Quando você registrar atendimentos, pagamentos e despesas, os gráficos aparecem aqui." />
          ) : (
            <section className={`${card} p-5`}>
              <h3 className="font-semibold text-[#39252b]">Receitas e despesas</h3>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4eaed" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#b49da3' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#b49da3' }} width={48} />
                    <Tooltip formatter={(v) => formatBRL(Number(v) * 100)} />
                    <Legend />
                    <Bar dataKey="Receitas" fill="#e58aa0" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#f4d7de" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard title="Serviços mais realizados" rows={r.topServices.map((x) => [x.name, `${x.count}× • ${formatBRL(x.totalCents)}`])} empty="Sem atendimentos no período." />
            <ListCard title="Formas de pagamento" rows={r.paymentMethods.map((x) => [METHOD_LABEL[x.method] ?? x.method, formatBRL(x.totalCents)])} empty="Sem pagamentos no período." />
            <ListCard title="Despesas por categoria" rows={r.expensesByCategory.map((x) => [x.name, formatBRL(x.totalCents)])} empty="Sem despesas pagas no período." />
          </div>
        </>
      )}
    </div>
  )
}

function ListCard({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) {
  return (
    <section className={`${card} p-5`}>
      <h3 className="font-semibold text-[#39252b]">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-[#9d858d]">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map(([a, b]) => (
            <li key={a} className="flex justify-between gap-2 text-sm">
              <span className="truncate text-[#60444d]">{a}</span>
              <span className="shrink-0 font-semibold text-[#39252b]">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
