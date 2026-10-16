import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/auth'

/**
 * Configurações da agenda online (área pública).
 * Tudo aqui é usado SOMENTE pelas rotas /api/public/*.
 */

// Marca gravada no início das observações de um agendamento pedido pelo cliente.
// É assim que o painel identifica "solicitações" sem precisar alterar o banco.
export const BOOKING_REQUEST_MARKER = '[Solicitação online]'

export const SLOT_STEP_MINUTES = 30 // intervalo entre horários exibidos
export const MIN_LEAD_MINUTES = 120 // antecedência mínima para pedir um horário
export const MAX_DAYS_AHEAD = 60 // até quantos dias à frente o cliente pode agendar
export const MAX_PENDING_PER_CLIENT = 3 // solicitações pendentes por telefone

const hoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(0).max(6)).min(1), // 0 = domingo ... 6 = sábado
})

export type BookingHours = z.infer<typeof hoursSchema>

// Padrão: segunda a sábado, das 09:00 às 18:00.
// Pode ser personalizado em Settings.openingHours: { "start": "08:00", "end": "17:00", "days": [1,2,3,4,5] }
const DEFAULT_HOURS: BookingHours = { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] }

export async function getPublicOwnerId(): Promise<string> {
  const email = process.env.PUBLIC_BOOKING_OWNER_EMAIL?.trim().toLowerCase()
  const owner = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!owner) throw new NotFoundError('Agenda online indisponível no momento')
  return owner.id
}

export async function getBookingHours(ownerId: string): Promise<BookingHours> {
  const settings = await prisma.settings.findUnique({
    where: { ownerId },
    select: { openingHours: true },
  })
  const parsed = hoursSchema.safeParse(settings?.openingHours)
  return parsed.success ? parsed.data : DEFAULT_HOURS
}

// ---- Limite simples de requisições (em memória, por instância) ----
const hits = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)

  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k)
    }
  }
  return true
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
