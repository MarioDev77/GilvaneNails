'use client'

import { useEffect, useState } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useFetch } from '@/hooks/use-fetch'
import { Btn, card, ErrorBox, FormError, PageHeader, Spinner, TextField } from '@/components/ui-kit'

type SettingsData = { businessName: string | null; phone: string | null; ownerName: string; ownerEmail: string }

export default function SettingsPage({ onLogout, onSaved }: { onLogout: () => void; onSaved: () => void }) {
  const { data, loading, error, reload } = useFetch<SettingsData>('/settings')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (data) {
      setBusinessName(data.businessName ?? '')
      setPhone(data.phone ?? '')
    }
  }, [data])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/settings', { businessName, phone })
      toast.success('Configurações salvas')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (next !== confirm) return setPwError('A confirmação não é igual à nova senha.')
    setPwBusy(true)
    try {
      await api.post('/account/password', { currentPassword: current, newPassword: next })
      toast.success('Senha alterada')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Erro ao alterar a senha')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Settings} title="Configurações" subtitle="Personalize o Gilvane Nails do seu jeito." />
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={save} className={`${card} flex flex-col gap-4 p-5`}>
            <h3 className="font-semibold text-[#39252b]">Seu negócio</h3>
            <TextField label="Nome do negócio" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <TextField label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <p className="text-xs text-[#9d858d]">
              Conta: {data?.ownerName} • {data?.ownerEmail}
            </p>
            <Btn type="submit" loading={saving}>
              Salvar
            </Btn>
          </form>
          <form onSubmit={changePassword} className={`${card} flex flex-col gap-4 p-5`}>
            <h3 className="font-semibold text-[#39252b]">Trocar senha</h3>
            <TextField label="Senha atual" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            <TextField label="Nova senha" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="Mínimo de 8 caracteres" minLength={8} required />
            <TextField label="Repita a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <FormError message={pwError} />
            <Btn type="submit" variant="outline" loading={pwBusy}>
              Alterar senha
            </Btn>
          </form>
        </div>
      )}
      <div>
        <Btn variant="danger" onClick={onLogout}>
          <LogOut className="size-4" /> Sair do sistema
        </Btn>
      </div>
    </div>
  )
}
