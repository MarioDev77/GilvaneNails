'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, CalendarDays, Check, Home, Loader2, Menu, Plus, Settings, Sparkles, Users, Wallet, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSession, logout, onUnauthorized, type SessionUser } from '@/lib/api'
import { useFetch } from '@/hooks/use-fetch'
import AgendaPage from './pages/agenda'
import AttendancesPage from './pages/attendances'
import ClientsPage from './pages/clients'
import DashboardPage from './pages/dashboard'
import FinancePage from './pages/finance'
import LoginPage from './pages/login'
import ReportsPage from './pages/reports'
import ServicesPage from './pages/services'
import SettingsPage from './pages/settings'
import { Modal } from './ui-kit'

const nav = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'atendimentos', label: 'Atendimentos', icon: Check },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'servicos', label: 'Serviços', icon: Sparkles },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
]
const ids = nav.map((n) => n.id)

function readHash() {
  const h = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '')
  return ids.includes(h) ? h : 'inicio'
}

export default function GilvaneNailsApp() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined) // undefined = verificando
  useEffect(() => {
    getSession().then(setUser)
    return onUnauthorized(() => setUser(null))
  }, [])

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffafb] text-[#d85f7b]">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }
  if (!user) return <LoginPage onLogin={setUser} />
  return <Shell user={user} onLogout={async () => { await logout(); setUser(null) }} />
}

function Shell({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [active, setActive] = useState('inicio')
  // "intent": pede à página aberta para abrir o formulário de criação (atalhos "novo ...")
  const [intent, setIntent] = useState<{ page: string; n: number } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const settings = useFetch<{ businessName: string | null }>('/settings')

  useEffect(() => {
    setActive(readHash())
    const onHash = () => setActive(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: string, create = false) => {
    window.location.hash = id
    setActive(id)
    setIntent(create ? { page: id, n: Date.now() } : null)
    window.scrollTo({ top: 0 })
  }, [])

  const current = nav.find((n) => n.id === active) ?? nav[0]
  const autoNew = (page: string) => intent?.page === page
  // `key` força reabrir o formulário a cada novo pedido de "criar"
  const k = (page: string) => `${page}-${intent?.page === page ? intent.n : 0}`
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const businessName = settings.data?.businessName

  const NavButtons = ({ onPick }: { onPick?: () => void }) => (
    <>
      {nav.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => { go(id); onPick?.() }}
          className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition', active === id ? 'bg-[#fce8ee] text-[#c75d79]' : 'text-[#9d858d] hover:bg-[#fff5f7] hover:text-[#c75d79]')}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </>
  )

  return (
    <div className="min-h-screen bg-[#fffafb] text-[#39252b]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#f3e4e8] bg-white px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-[#d85f7b] text-white">
            <Sparkles />
          </div>
          <div>
            <p className="font-serif text-lg font-bold tracking-tight text-[#39252b]">gilvane</p>
            <p className="-mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d85f7b]">nails</p>
          </div>
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          <NavButtons />
        </nav>
        <div className="rounded-2xl bg-[#fff6f8] p-4">
          <p className="text-xs font-semibold text-[#39252b]">Dica do dia</p>
          <p className="mt-2 text-xs leading-5 text-[#9d858d]">Confirme os horários do dia seguinte pelo WhatsApp: menos faltas, agenda cheia.</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#f3e4e8]/80 bg-[#fffafb]/90 px-4 backdrop-blur-md sm:px-8">
          <button onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-[#9d858d] lg:hidden" aria-label="Abrir menu">
            <Menu />
          </button>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-[#b39ca3]">{businessName || 'Gilvane Nails'}</p>
            <h1 className="text-sm font-semibold text-[#39252b]">{active === 'inicio' ? 'Visão geral' : current.label}</h1>
          </div>
          <p className="font-serif text-base font-bold lg:hidden">{current.label}</p>
          <button onClick={() => go('configuracoes')} aria-label="Minha conta" title={user.name} className="flex size-9 items-center justify-center rounded-full bg-[#f3c4d0] text-sm font-semibold text-[#a74e68]">
            {initials}
          </button>
        </header>

        {mobileNav && (
          <div className="fixed inset-0 z-40 bg-[#39252b]/20 lg:hidden" onClick={() => setMobileNav(false)}>
            <div className="h-full w-72 bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg font-bold">gilvane nails</span>
                <button onClick={() => setMobileNav(false)} aria-label="Fechar menu">
                  <X />
                </button>
              </div>
              <nav className="mt-8 flex flex-col gap-1">
                <NavButtons onPick={() => setMobileNav(false)} />
              </nav>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-8 sm:pt-8 lg:pb-10">
          {active === 'inicio' && <DashboardPage userName={user.name} onNavigate={go} />}
          {active === 'agenda' && <AgendaPage key={k('agenda')} autoNew={autoNew('agenda')} />}
          {active === 'atendimentos' && <AttendancesPage key={k('atendimentos')} autoNew={autoNew('atendimentos')} />}
          {active === 'clientes' && <ClientsPage key={k('clientes')} autoNew={autoNew('clientes')} />}
          {active === 'servicos' && <ServicesPage key={k('servicos')} autoNew={autoNew('servicos')} />}
          {active === 'financeiro' && <FinancePage key={k('financeiro')} autoNew={autoNew('financeiro')} />}
          {active === 'relatorios' && <ReportsPage />}
          {active === 'configuracoes' && <SettingsPage onLogout={onLogout} onSaved={settings.reload} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-20 items-center justify-around border-t border-[#f3e4e8] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {[nav[0], nav[1]].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => go(id)} className={cn('flex min-w-14 flex-col items-center gap-1 text-[10px] font-medium', active === id ? 'text-[#d85f7b]' : 'text-[#b49da3]')}>
            <Icon className="size-5" />
            {label}
          </button>
        ))}
        <button onClick={() => setShowNew(true)} className="-mt-8 flex size-14 items-center justify-center rounded-full bg-[#d85f7b] text-white shadow-lg shadow-[#d85f7b]/25" aria-label="Novo registro">
          <Plus />
        </button>
        {[nav[3], nav[5]].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => go(id)} className={cn('flex min-w-14 flex-col items-center gap-1 text-[10px] font-medium', active === id ? 'text-[#d85f7b]' : 'text-[#b49da3]')}>
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </nav>

      {showNew && (
        <Modal title="O que você quer adicionar?" subtitle="Escolha uma opção para começar" onClose={() => setShowNew(false)}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Agendamento', icon: CalendarDays, id: 'agenda' },
              { label: 'Atendimento', icon: Check, id: 'atendimentos' },
              { label: 'Cliente', icon: Users, id: 'clientes' },
              { label: 'Despesa', icon: Wallet, id: 'financeiro' },
            ].map(({ label, icon: Icon, id }) => (
              <button key={label} onClick={() => { go(id, true); setShowNew(false) }} className="flex flex-col items-center gap-3 rounded-2xl border border-[#f3dfe5] p-5 text-sm font-medium text-[#60444d] hover:border-[#e4a2b3] hover:bg-[#fff8fa]">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#fce8ee] text-[#d85f7b]">
                  <Icon />
                </span>
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
