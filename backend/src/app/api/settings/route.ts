import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError, success } from '@/lib/api-response'
import { updateSettingsSchema } from '@/schemas/account'

export async function GET() {
  try {
    const user = await requireAuth()
    const settings = await prisma.settings.upsert({
      where: { ownerId: user.id },
      update: {},
      create: { ownerId: user.id, businessName: 'Gilvane Nails' },
    })
    return success({ ...settings, ownerName: user.name, ownerEmail: user.email })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const input = updateSettingsSchema.parse(await req.json())
    const settings = await prisma.settings.upsert({
      where: { ownerId: user.id },
      update: {
        ...(input.businessName !== undefined && { businessName: input.businessName || null }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
      },
      create: {
        ownerId: user.id,
        businessName: input.businessName || 'Gilvane Nails',
        phone: input.phone || null,
      },
    })
    return success(settings)
  } catch (error) {
    return handleApiError(error)
  }
}
