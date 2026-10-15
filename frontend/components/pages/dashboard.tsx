'use client'

import { CalendarDays, Check, ChevronRight, CircleDollarSign, Clock3, CreditCard, Plus, Sparkles, UserRound, Users, Wallet } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatBRL, formatDateKey, formatLongDate, greeting, STATUS_LABEL, todayKey, toTimeKey } from '@/lib/format'
import type { Appointment } from '@/lib/types'
import { useFetch } from '@/hooks/use-fetch'
import { Badge, Btn, card, EmptyState, ErrorBox, Spinner, statusTone } from '@/components/ui-kit'
import { cn } from '@/lib/utils'

type Dashboard = {
  today: { incomeReceivedCents: number; attendancesCount: number; appointmentsCount: number; appointments: Appointment[] }
  month: { incomeReceivedCents: number; expensesPaidCents: number }
  receivablesCents: number
  activeClients: number
  newClientsMonth: number
  week: { date: string; incomeCents: number; expenseCents: number }[]
  upcomingAppointments: Appointment[]
}

const toneCls = { rose: 'bg-[#f8e3ea] text-[#c75d79]', green: 'bg-[#e6f5ed] text-[#32875d]', beige: 'bg-[#f8f0e5] text-[#b8895b]', pink: 'bg-[#fce8ee] text-[#c75d79]' }

function Metric({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: React.ElementType; tone: keyof typeof toneCls }) {
  return (
    <div className={cn(card, 'p-4 sm:p-5')}>
      <div className={cn('flex size-10 items-center justify-center rounded-xl', toneCls[tone])}>
        <Icon />
      </div>
      <p className="mt-4 text-xs font-medium text-[#9d858d]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-[#39252b]">{value}</p>
      <p className="mt-1 text-xs text-[#6fa382]">{helper}</p>
    </div>
  )
}

export default function DashboardPage({ userName, onNavigate }: { userName: string; onNavigate: (id: string, create?: boolean) => void }) {
  const { data, loading, error, reload } = useFetch<Dashboard>('/dashboard')
  const first = userName.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#c75d79]">{formatLongDate(todayKey())}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#39252b] sm:text-3xl">
            {greeting()}, {first}!
          </h2>
          <p className="mt-1 text-sm text-[#9d858d]">Vamos deixar sua agenda ainda mais bonita hoje?</p>
        </div>
        <Btn onClick={() => onNavigate('agenda', true)}>
          <Plus className="size-4" /> Novo agendamento
        </Btn>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorBox message={error ?? 'Erro ao carregar'} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Recebido hoje" value={formatBRL(data.today.incomeReceivedCents)} helper={`${formatBRL(data.month.incomeReceivedCents)} no mês`} icon={CircleDollarSign} tone="rose" />
            <Metric label="Atendimentos hoje" value={String(data.today.attendancesCount).padStart(2, '0')} helper={`de ${String(data.today.appointmentsCount).padStart(2, '0')} agendados`} icon={Check} tone="green" />
            <Metric label="A receber" value={formatBRL(data.receivablesCents)} helper="saldo de atendimentos" icon={Wallet} tone="beige" />
            <Metric label="Clientes ativos" value={String(data.activeClients)} helper={`+${data.newClientsMonth} este mês`} icon={Users} tone="pink" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <section className={cn(card, 'p-5')}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#39252b]">Agenda de hoje</h3>
                  <p className="mt-1 text-xs text-[#9d858d]">Seus horários do dia</p>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => onNavigate('agenda')}>
                  Ver agenda <ChevronRight className="size-4" />
                </Btn>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {data.today.appointments.filter((a) => a.status !== 'CANCELLED').length === 0 ? (
                  <EmptyState icon={CalendarDays} title="Nada marcado para hoje" text={data.upcomingAppointments[0] ? `Próximo horário: ${formatDateKey(data.upcomingAppointments[0].startsAt.slice(0, 10), { day: '2-digit', month: '2-digit' })} às ${toTimeKey(data.upcomingAppointments[0].startsAt)} — ${data.upcomingAppointments[0].client.name}` : 'Aproveite o dia ou agende uma cliente.'} />
                ) : (
                  data.today.appointments
                    .filter((a) => a.status !== 'CANCELLED')
                    .map((a, i) => (
                      <div key={a.id} className={cn('flex items-center gap-3 rounded-xl border p-3', i === 0 ? 'border-[#f3b8c8] bg-[#fff8fa]' : 'border-[#f4eaed] bg-[#fffdfd]')}>
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-sm font-semibold text-[#39252b]">{toTimeKey(a.startsAt)}</p>
                          <Clock3 className="mx-auto mt-1 size-4 text-[#cdb4ba]" />
                        </div>
                        <div className="h-10 w-px bg-[#f0dfe4]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#39252b]">{a.client.name}</p>
                          <p className="mt-0.5 truncate text-xs text-[#9d858d]">{a.service.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="hidden text-sm font-semibold text-[#39252b] sm:block">{formatBRL(a.agreedPriceCents)}</p>
                          <Badge tone={statusTone(a.status)}>{STATUS_LABEL[a.status]}</Badge>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#f2e4e8] bg-[#fff7f8] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#39252b]">Ações rápidas</h3>
                  <p className="mt-1 text-xs text-[#9d858d]">O que você quer fazer?</p>
                </div>
                <Sparkles className="text-[#d85f7b]" />
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  { label: 'Novo agendamento', icon: CalendarDays, id: 'agenda' },
                  { label: 'Registrar atendimento', icon: Check, id: 'atendimentos' },
                  { label: 'Adicionar cliente', icon: UserRound, id: 'clientes' },
                  { label: 'Lançar despesa', icon: CreditCard, id: 'financeiro' },
                ].map(({ label, icon: Icon, id }) => (
                  <button key={label} onClick={() => onNavigate(id, true)} className="flex items-center gap-3 rounded-xl border border-[#f1dfe4] bg-white p-3 text-left text-sm font-medium text-[#60444d] transition hover:border-[#e6a4b5] hover:bg-[#fffafa]">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[#fce8ee] text-[#c75d79]">
                      <Icon className="size-5" />
                    </span>
                    {label}
                    <ChevronRight className="ml-auto size-4 text-[#cdb4ba]" />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className={cn(card, 'p-5')}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#39252b]">Movimentação financeira</h3>
                <p className="mt-1 text-xs text-[#9d858d]">Receitas e despesas pagas nos últimos 7 dias</p>
              </div>
              <Btn variant="outline" size="sm" onClick={() => onNavigate('relatorios')}>
                Ver relatório
              </Btn>
            </div>
            <div className="mt-4 h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.week.map((d) => ({ name: formatDateKey(d.date, { day: '2-digit', month: '2-digit' }), Receitas: d.incomeCents / 100, Despesas: d.expenseCents / 100 }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#b49da3' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatBRL(Number(v) * 100)} cursor={{ fill: '#fff5f7' }} />
                  <Bar dataKey="Receitas" fill="#e58aa0" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#f4d7de" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-5 text-xs text-[#9d858d]">
              <span className="flex items-center gap-2">
                <i className="size-2 rounded-full bg-[#e58aa0]" />
                Receitas
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2 rounded-full bg-[#f4d7de]" />
                Despesas
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
