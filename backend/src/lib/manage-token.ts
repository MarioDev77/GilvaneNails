import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Link de "remarcar ou cancelar" para a cliente, SEM guardar nada no banco.
 * O token é uma assinatura (HMAC-SHA256) do id do agendamento feita com o NEXTAUTH_SECRET:
 * só quem recebeu o link consegue chegar naquele agendamento, e não dá para adivinhar o de outro.
 * Se o NEXTAUTH_SECRET for trocado, os links já enviados deixam de valer.
 */
function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET não configurado')
  return s
}

export function manageToken(appointmentId: string): string {
  return createHmac('sha256', secret()).update(`manage:${appointmentId}`).digest('base64url').slice(0, 32)
}

/** Versão para listas do painel: se faltar o segredo, só não gera o link (não derruba a lista). */
export function safeManageToken(appointmentId: string): string | undefined {
  try {
    return manageToken(appointmentId)
  } catch {
    return undefined
  }
}

export function isValidManageToken(appointmentId: string, token: string): boolean {
  try {
    const expected = Buffer.from(manageToken(appointmentId))
    const given = Buffer.from(token)
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}
