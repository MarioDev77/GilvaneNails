import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ data: { status: 'ok', database: 'ok' } })
  } catch {
    return Response.json(
      { error: { code: 'DATABASE_DOWN', message: 'Não foi possível conectar ao banco de dados.' } },
      { status: 503 }
    )
  }
}
