/**
 * Aviso para a dona (Gilvane) quando chega pedido de horário, ou quando a cliente remarca/cancela.
 * Canais opcionais, configurados por variável de ambiente (pode ligar um, os dois ou nenhum):
 *  - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (grátis, notificação instantânea no celular)
 *  - E-mail (Resend): RESEND_API_KEY + NOTIFY_EMAIL (+ NOTIFY_EMAIL_FROM, opcional)
 * Sem nenhuma configurada, não faz nada. Aviso é "melhor esforço": se falhar, o agendamento segue normal.
 */

const TIMEOUT_MS = 3000

async function post(label: string, url: string, headers: Record<string, string>, body: unknown) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    if (!res.ok) console.error(`[notify:${label}] resposta ${res.status}`)
  } catch (e) {
    // Nunca registrar a URL (no Telegram o token vai nela).
    console.error(`[notify:${label}] falhou: ${(e as Error).name}`)
  } finally {
    clearTimeout(timer)
  }
}

/** "75999999999" → "(75) 99999-9999" */
export function prettyPhone(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

export async function notifyOwner(title: string, body: string): Promise<void> {
  const panel = process.env.PANEL_URL?.trim()
  const text = `${body}${panel ? `\n\nPainel: ${panel}` : ''}`
  const jobs: Promise<void>[] = []

  const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const tgChat = process.env.TELEGRAM_CHAT_ID?.trim()
  if (tgToken && tgChat) {
    jobs.push(post('telegram', `https://api.telegram.org/bot${tgToken}/sendMessage`, {}, { chat_id: tgChat, text: `${title}\n\n${text}` }))
  }

  const resendKey = process.env.RESEND_API_KEY?.trim()
  const to = process.env.NOTIFY_EMAIL?.trim()
  if (resendKey && to) {
    jobs.push(
      post('email', 'https://api.resend.com/emails', { Authorization: `Bearer ${resendKey}` }, {
        from: process.env.NOTIFY_EMAIL_FROM?.trim() || 'Gilvane Nails <onboarding@resend.dev>',
        to: [to],
        subject: title,
        text,
      })
    )
  }

  await Promise.allSettled(jobs)
}
