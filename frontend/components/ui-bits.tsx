'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------- campos ---------- */
export const inputCls =
  'h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-mute/70 transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-paper'
export const labelCls = 'mb-1.5 block text-sm font-medium text-ink'

/* ---------- botões ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'lg' | 'md' | 'sm'
  loading?: boolean
}
export function Btn({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...p }: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'sm' && 'h-9 px-3 text-[13px]',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-strong',
        variant === 'success' && 'bg-ok text-white hover:brightness-95',
        variant === 'soft' && 'bg-brand-soft text-brand-strong hover:bg-[#f7dae2]',
        variant === 'outline' && 'border border-line bg-white text-ink hover:bg-paper',
        variant === 'ghost' && 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong',
        variant === 'danger' && 'bg-bad text-white hover:brightness-95',
        className
      )}
      {...p}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- status ---------- */
const TONES = {
  gray: 'bg-[#f1eaec] text-ink-soft',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  brand: 'bg-brand-soft text-brand-strong',
}
export function Pill({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>{children}</span>
}
export const APPT_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  SCHEDULED: { label: 'Agendado', tone: 'brand' },
  CONFIRMED: { label: 'Confirmado', tone: 'ok' },
  COMPLETED: { label: 'Concluído', tone: 'gray' },
  CANCELLED: { label: 'Cancelado', tone: 'bad' },
  NO_SHOW: { label: 'Faltou', tone: 'warn' },
  PENDING: { label: 'Pendente', tone: 'warn' },
  PAID: { label: 'Paga', tone: 'ok' },
}

/* ---------- trava de rolagem da página (com contador) ----------
   Vários modais podem abrir/fechar em sequência. Com contador, a página só destrava quando o
   ÚLTIMO fecha — antes, cada modal guardava e restaurava o "overflow" sozinho e, na ordem
   errada, deixava o body travado para sempre (a página parava de rolar no celular).
   Usa position:fixed porque `overflow:hidden` no body é ignorado pelo Safari do iPhone. */
let lockCount = 0
let lockedY = 0
function lockPageScroll() {
  if (lockCount++ > 0) return
  lockedY = window.scrollY
  const b = document.body
  const gap = window.innerWidth - document.documentElement.clientWidth // barra de rolagem (desktop)
  b.style.position = 'fixed'
  b.style.top = `-${lockedY}px`
  b.style.left = '0'
  b.style.right = '0'
  b.style.width = '100%'
  if (gap > 0) b.style.paddingRight = `${gap}px`
}
function unlockPageScroll() {
  if (lockCount === 0) return
  if (--lockCount > 0) return
  const b = document.body
  b.style.position = ''
  b.style.top = ''
  b.style.left = ''
  b.style.right = ''
  b.style.width = ''
  b.style.paddingRight = ''
  b.style.overflow = ''
  window.scrollTo(0, lockedY)
}

/* Destrava à força (usado como rede de segurança quando nenhuma janela está aberta). */
export function forceUnlockPageScroll() {
  lockCount = 0
  const b = document.body
  if (b.style.position !== 'fixed' && !b.style.top) return
  b.style.position = ''
  b.style.top = ''
  b.style.left = ''
  b.style.right = ''
  b.style.width = ''
  b.style.paddingRight = ''
  b.style.overflow = ''
}

/* ---------- janela (vira folha no celular) ---------- */
export function Modal({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  // onClose geralmente é uma função nova a cada render do pai. Guardar numa ref evita
  // refazer o efeito (e roubar o foco do campo que a pessoa está digitando).
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  // Área realmente visível (quando o teclado do celular abre, a folha encolhe junto)
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null)
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const update = () => setVv({ h: v.height, top: v.offsetTop })
    update()
    v.addEventListener('resize', update)
    v.addEventListener('scroll', update)
    return () => { v.removeEventListener('resize', update); v.removeEventListener('scroll', update) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    lockPageScroll()
    // Só abre o teclado sozinho no computador; no celular o teclado cobriria metade do formulário.
    const root = ref.current
    const auto = root?.querySelector<HTMLElement>('[data-autofocus]')
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (auto) auto.focus({ preventScroll: true })
    else if (!touch) root?.querySelector<HTMLElement>('input,select,textarea')?.focus({ preventScroll: true })
    else root?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockPageScroll()
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" style={vv ? { height: vv.h, top: vv.top } : { bottom: 0 }} onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} style={vv ? { maxHeight: `${Math.floor(vv.h * 0.96)}px` } : undefined}
        className="sheet-in flex max-h-[94dvh] min-h-0 w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-mute">{subtitle}</p>}
          </div>
          <button onClick={() => closeRef.current()} aria-label="Fechar" className="-mr-1 rounded-lg p-2 text-ink-mute hover:bg-paper hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch]">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-paper/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, text, confirmLabel, danger, onClose, onConfirm }: { title: string; text: React.ReactNode; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Btn variant="outline" size="lg" onClick={onClose} disabled={busy}>Voltar</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} size="lg" loading={busy} data-autofocus onClick={async () => {
            setBusy(true)
            try { await onConfirm() } finally { setBusy(false) }
          }}>{confirmLabel}</Btn>
        </div>
      }>
      <div className="flex gap-3">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', danger ? 'bg-bad-soft text-bad' : 'bg-brand-soft text-brand')}><AlertTriangle className="size-5" /></div>
        <div className="text-[15px] leading-6 text-ink-soft">{text}</div>
      </div>
    </Modal>
  )
}

/* ---------- avisos ---------- */
export type Toast = { id: number; kind: 'ok' | 'error'; text: string }
export function ToastHost({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cn('sheet-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg', t.kind === 'ok' ? 'bg-ink text-white' : 'bg-bad text-white')}>
          {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          <span className="flex-1 leading-5">{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon className="size-6" /></div>
      <p className="mt-4 font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-mute">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
