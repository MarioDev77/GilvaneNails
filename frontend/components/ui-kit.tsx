'use client'

import { useEffect, useId, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format'

export const card = 'rounded-2xl border border-[#f2e4e8] bg-white shadow-[0_10px_30px_rgba(191,112,135,0.06)]'

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'soft'
  size?: 'md' | 'sm'
  loading?: boolean
}

export function Btn({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...props }: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'h-11 px-4 text-sm' : 'h-8 px-3 text-xs',
        variant === 'primary' && 'bg-[#d85f7b] text-white hover:bg-[#c94f6c]',
        variant === 'soft' && 'bg-[#fce8ee] text-[#c75d79] hover:bg-[#f9d9e3]',
        variant === 'outline' && 'border border-[#efcbd5] bg-white text-[#c75d79] hover:bg-[#fff5f7]',
        variant === 'ghost' && 'text-[#9d858d] hover:bg-[#fff0f3] hover:text-[#c75d79]',
        variant === 'danger' && 'border border-[#f3c9c9] bg-white text-[#c0504d] hover:bg-[#fff4f4]',
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'pink' }: { children: React.ReactNode; tone?: 'pink' | 'green' | 'gray' | 'amber' | 'red' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'green' && 'bg-[#e6f5ed] text-[#32875d]',
        tone === 'gray' && 'bg-[#f5eef0] text-[#9b737d]',
        tone === 'amber' && 'bg-[#fdf1dc] text-[#a9741c]',
        tone === 'red' && 'bg-[#fde8e8] text-[#c0504d]',
        tone === 'pink' && 'bg-[#fce8ee] text-[#c75d79]'
      )}
    >
      {children}
    </span>
  )
}

export function statusTone(status: string): 'pink' | 'green' | 'gray' | 'amber' | 'red' {
  return status === 'CONFIRMED' ? 'green' : status === 'COMPLETED' ? 'green' : status === 'CANCELLED' ? 'red' : status === 'NO_SHOW' ? 'amber' : 'gray'
}

export function PageHeader({ icon: Icon, title, subtitle, action }: { icon: React.ElementType; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#fce8ee] text-[#c75d79]">
          <Icon />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#39252b]">{title}</h2>
        <p className="mt-1 text-sm text-[#9d858d]">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

export function AddButton({ onClick, children = 'Adicionar' }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <Btn onClick={onClick}>
      <Plus className="size-4" />
      {children}
    </Btn>
  )
}

export function Spinner({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#9d858d]">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-[#f3c9c9] bg-[#fff6f6] p-5 text-center text-sm text-[#a94442]">
      <p>{message}</p>
      {onRetry && (
        <Btn variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Tentar de novo
        </Btn>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#eccbd3] bg-white p-8 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fff0f3] text-[#d85f7b]">
        <Icon />
      </div>
      <h3 className="mt-4 font-semibold text-[#39252b]">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#9d858d]">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#39252b]/30 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', wide ? 'max-w-2xl' : 'max-w-md')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f6ecef] p-5">
          <div>
            <h3 className="font-semibold text-[#39252b]">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-[#9d858d]">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-[#9d858d] hover:bg-[#fff0f3]">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ title, text, confirmLabel = 'Confirmar', danger, onConfirm, onClose }: { title: string; text: string; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-6 text-[#60444d]">{text}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Voltar
        </Btn>
        <Btn
          loading={busy}
          className={danger ? 'bg-[#c0504d] hover:bg-[#a94442]' : undefined}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
            }
          }}
        >
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  )
}

const fieldCls = 'w-full rounded-xl border border-[#efdde2] bg-white px-3 py-2.5 text-[#39252b] outline-none placeholder:text-[#c4b0b6] focus:border-[#e58aa0] focus:ring-2 focus:ring-[#f9d9e3] disabled:bg-[#faf5f6]'

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[#7a5d66]">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-[#b49da3]">{hint}</p>}
    </div>
  )
}

export function TextField({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} hint={hint}>{(id) => <input id={id} className={fieldCls} {...props} />}</Field>
}

export function MoneyField({ label, value, onChange, hint, required }: { label: string; value: string; onChange: (v: string) => void; hint?: string; required?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#b49da3]">R$</span>
          <input id={id} inputMode="decimal" placeholder="0,00" required={required} className={cn(fieldCls, 'pl-10')} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
    </Field>
  )
}

export function TextArea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label}>{(id) => <textarea id={id} rows={3} className={fieldCls} {...props} />}</Field>
}

export function SelectField({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={fieldCls} {...props}>
          {children}
        </select>
      )}
    </Field>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#a94442]">
      {message}
    </p>
  )
}

export function FormActions({ onCancel, submitLabel = 'Salvar', loading }: { onCancel: () => void; submitLabel?: string; loading?: boolean }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <Btn variant="ghost" onClick={onCancel}>
        Cancelar
      </Btn>
      <Btn type="submit" loading={loading}>
        {submitLabel}
      </Btn>
    </div>
  )
}

export function Stat({ label, value, helper, tone = 'pink' }: { label: string; value: string; helper?: string; tone?: 'pink' | 'green' | 'beige' | 'red' }) {
  return (
    <div className={cn(card, 'p-4 sm:p-5')}>
      <p className="text-xs font-medium text-[#9d858d]">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tracking-tight', tone === 'red' ? 'text-[#c0504d]' : 'text-[#39252b]')}>{value}</p>
      {helper && <p className={cn('mt-1 text-xs', tone === 'green' ? 'text-[#6fa382]' : 'text-[#9d858d]')}>{helper}</p>}
    </div>
  )
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={className}>{formatBRL(cents)}</span>
}
