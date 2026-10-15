import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Cria o PrismaClient usando o driver `pg` (sem motor nativo do Prisma).
 * Compartilhado entre a API e os scripts (ex.: create-owner).
 */
export function createPrismaClient(log: ('error' | 'warn')[] = ['error']) {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL não definida. Copie .env.example para .env.')

  // O driver `pg` não entende "?schema=..." (parâmetro específico do Prisma).
  const url = new URL(raw)
  const schema = url.searchParams.get('schema') ?? undefined
  url.searchParams.delete('schema')

  const adapter = new PrismaPg({ connectionString: url.toString() }, schema ? { schema } : undefined)
  return new PrismaClient({ adapter, log })
}
