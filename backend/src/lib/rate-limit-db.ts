import { createHmac, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * Limite de pedidos que SOBREVIVE a deploy/reinício e vale entre instâncias.
 * Não cria tabela: reaproveita `idempotency_keys` (chave + validade) com o prefixo "rl:".
 * Cada tentativa permitida grava uma linha que expira no fim da janela; contar as linhas ainda
 * válidas dá quantas tentativas aquele IP fez na janela. O IP nunca é guardado: só um hash (HMAC).
 */
const PREFIX = 'rl:'

function hashIp(ip: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'sem-segredo'
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 24)
}

/** true = pode continuar; false = passou do limite. Se o banco falhar, deixa passar (não trava a cliente). */
export async function persistentRateLimit(ownerId: string, name: string, ip: string, max: number, windowMs: number): Promise<boolean> {
  const prefix = `${PREFIX}${name}:${hashIp(ip)}:`
  const now = new Date()
  try {
    const used = await prisma.idempotencyKey.count({
      where: { ownerId, key: { startsWith: prefix }, expiresAt: { gt: now } },
    })
    if (used >= max) return false

    await prisma.idempotencyKey.create({
      data: {
        ownerId,
        key: `${prefix}${now.getTime()}:${randomBytes(4).toString('hex')}`,
        expiresAt: new Date(now.getTime() + windowMs),
      },
    })

    // Limpeza ocasional das linhas vencidas, só as deste limitador.
    if (Math.random() < 0.02) {
      await prisma.idempotencyKey.deleteMany({ where: { ownerId, key: { startsWith: PREFIX }, expiresAt: { lt: now } } })
    }
    return true
  } catch (e) {
    console.error('[rate-limit-db]', (e as Error).message)
    return true
  }
}
