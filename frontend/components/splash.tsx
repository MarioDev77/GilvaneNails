'use client'

import { useEffect, useState } from 'react'

/* Abertura do app.
   - O fundo é a mesma cor do splash do Android (background_color do manifest), então a troca é contínua.
   - A barra anda de verdade: sobe devagar enquanto o app carrega e fecha quando ele fica pronto.
   - Na primeira abertura da sessão fica no mínimo MIN_MS na tela; depois, só enquanto carrega. */
const MIN_MS = 1700
const FADE_MS = 380
const KEY = 'gn-splash-seen'

export default function Splash({ ready }: { ready: boolean }) {
  const [minDone, setMinDone] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1') } catch {}
    const t = setTimeout(() => setMinDone(true), seen ? 0 : MIN_MS)
    const raf = requestAnimationFrame(() => setStarted(true))
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [])

  const finished = ready && minDone
  useEffect(() => {
    if (!finished) return
    setLeaving(true)
    const t = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(t)
  }, [finished])

  if (gone) return null
  const width = finished ? '100%' : started ? '88%' : '0%'
  return (
    <div className={`gn-splash${leaving ? ' gn-splash-out' : ''}`} role="status" aria-live="polite" aria-label="Carregando Gilvane Nails">
      <img src="/icon-512.png" alt="Gilvane Nails" width={168} height={168} className="gn-splash-logo" decoding="async" fetchPriority="high" />
      <div className="gn-splash-track" aria-hidden>
        <div className="gn-splash-bar" style={{ width, transitionDuration: finished ? '260ms' : '1600ms' }} />
      </div>
    </div>
  )
}
