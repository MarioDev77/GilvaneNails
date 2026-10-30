import { prisma } from '@/lib/prisma'
import { BOOKING_REQUEST_MARKER } from '@/lib/public-booking'
import { safeManageToken } from '@/lib/manage-token'

// Uso interno do painel (exige login): solicitações feitas pelos clientes na agenda online
// que ainda aguardam confirmação ou recusa.
export async function listBookingRequests(ownerId: string) {
  const items = await prisma.appointment.findMany({
    where: {
      ownerId,
      status: 'SCHEDULED',
      notes: { startsWith: BOOKING_REQUEST_MARKER },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
    },
  })
  return { items: items.map((i) => ({ ...i, manageToken: safeManageToken(i.id) })), total: items.length }
}
