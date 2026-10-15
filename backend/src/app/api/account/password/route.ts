import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAuth, ValidationError } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError, success } from '@/lib/api-response'
import { changePasswordSchema } from '@/schemas/account'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const { currentPassword, newPassword } = changePasswordSchema.parse(await req.json())

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } })
    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) throw new ValidationError('A senha atual está incorreta.')

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    })
    return success({ changed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
