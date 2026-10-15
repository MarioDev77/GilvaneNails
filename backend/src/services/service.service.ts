import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/auth'
import type { CreateServiceInput, UpdateServiceInput, ListServicesInput } from '@/schemas/service'

export async function createService(ownerId: string, input: CreateServiceInput) {
  return prisma.service.create({
    data: {
      ownerId,
      name: input.name.trim(),
      description: input.description ?? null,
      priceCents: input.priceCents,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive ?? true,
    },
  })
}

export async function listServices(ownerId: string, params: ListServicesInput) {
  const { page, limit, activeOnly, search } = params
  const where: any = {
    ownerId,
    ...(activeOnly ? { isActive: true } : {}),
  }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.service.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getServiceById(ownerId: string, id: string) {
  const service = await prisma.service.findFirst({
    where: { id, ownerId },
  })
  if (!service) throw new NotFoundError('Serviço não encontrado')
  return service
}

export async function updateService(ownerId: string, id: string, input: UpdateServiceInput) {
  await getServiceById(ownerId, id)
  return prisma.service.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  })
}

export async function deactivateService(ownerId: string, id: string) {
  await getServiceById(ownerId, id)
  return prisma.service.update({
    where: { id },
    data: { isActive: false },
  })
}
