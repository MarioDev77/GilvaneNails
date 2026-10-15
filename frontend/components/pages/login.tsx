'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ApiError, login, type SessionUser } from '@/lib/api'
import { Btn, FormError, TextField } from '@/components/ui-kit'

export default function LoginPage({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onLogin(await login(email, password))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffafb] p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-[#f2e4e8] bg-white p-6 shadow-[0_20px_60px_rgba(191,112,135,0.12)] sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[#d85f7b] text-white">
            <Sparkles className="size-7" />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold tracking-tight text-[#39252b]">gilvane</p>
            <p className="-mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#d85f7b]">nails</p>
          </div>
          <p className="text-sm text-[#9d858d]">Entre para ver sua agenda</p>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          <TextField label="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <TextField label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <FormError message={error} />
          <Btn type="submit" loading={busy} className="w-full">
            Entrar
          </Btn>
        </div>
      </form>
    </main>
  )
}
