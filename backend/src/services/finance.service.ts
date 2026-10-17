import { prisma } from '@/lib/prisma'
import { NotFoundError, ValidationError } from '@/lib/auth'
import { getDayBounds, getMonthBounds, formatLocal } from '@/lib/dates'
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesInput,
  FinancialReportInput,
} from '@/schemas/finance'
import { ExpenseStatus } from '@prisma/client'

export async function createExpense(ownerId: string, input: CreateExpenseInput) {
  if (input.categoryId) {
    const cat = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, ownerId },
    })
    if (!cat) throw new NotFoundError('Categoria não encontrada')
  }

  return prisma.expense.create({
    data: {
      ownerId,
      categoryId: input.categoryId ?? null,
      description: input.description.trim(),
      amountCents: input.amountCents,
      incurredAt: new Date(input.incurredAt),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      paymentMethod: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      status: input.paidNow ? 'PAID' : 'PENDING',
      paidAt: input.paidNow ? new Date() : null,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  })
}

export async function listExpenses(ownerId: string, params: ListExpensesInput) {
  const { page, limit, startDate, endDate, status, categoryId } = params
  const where: any = { ownerId }

  if (status) where.status = status
  if (categoryId) where.categoryId = categoryId

  if (startDate || endDate) {
    where.incurredAt = {}
    if (startDate) {
      const { start } = getDayBounds(startDate)
      where.incurredAt.gte = start
    }
    if (endDate) {
      const { end } = getDayBounds(endDate)
      where.incurredAt.lte = end
    }
  }

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { incurredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.count({ where }),
  ])

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getExpenseById(ownerId: string, id: string) {
  const exp = await prisma.expense.findFirst({
    where: { id, ownerId },
    include: { category: { select: { id: true, name: true } } },
  })
  if (!exp) throw new NotFoundError('Despesa não encontrada')
  return exp
}

export async function updateExpense(ownerId: string, id: string, input: UpdateExpenseInput) {
  await getExpenseById(ownerId, id)
  // paidNow só vale no cadastro; na edição o status é controlado por status/pagar
  const { paidNow: _ignored, ...fields } = input as typeof input & { paidNow?: boolean }
  input = fields
  return prisma.expense.update({
    where: { id },
    data: {
      // Despesa paga precisa de data de pagamento, senão não entra no saldo
      ...(input.status === 'PAID' && { paidAt: new Date() }),
      ...(input.status && input.status !== 'PAID' && { paidAt: null }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.description !== undefined && { description: input.description.trim() }),
      ...(input.amountCents !== undefined && { amountCents: input.amountCents }),
      ...(input.incurredAt && { incurredAt: new Date(input.incurredAt) }),
      ...(input.dueAt !== undefined && {
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      }),
      ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status && { status: input.status }),
    },
    include: { category: { select: { id: true, name: true } } },
  })
}

export async function payExpense(
  ownerId: string,
  id: string,
  paidAt?: string,
  paymentMethod?: any
) {
  const exp = await getExpenseById(ownerId, id)
  if (exp.status === 'PAID') throw new ValidationError('Despesa já está paga')
  if (exp.status === 'CANCELLED') throw new ValidationError('Despesa cancelada não pode ser paga')

  return prisma.expense.update({
    where: { id },
    data: {
      status: 'PAID',
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      ...(paymentMethod && { paymentMethod }),
    },
    include: { category: { select: { id: true, name: true } } },
  })
}

export async function cancelExpense(ownerId: string, id: string) {
  const exp = await getExpenseById(ownerId, id)
  if (exp.status === 'CANCELLED') throw new ValidationError('Despesa já está cancelada')

  return prisma.expense.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: { category: { select: { id: true, name: true } } },
  })
}

export async function getFinancialSummary(
  ownerId: string,
  startDate?: string,
  endDate?: string
) {
  let start: Date
  let end: Date

  if (startDate && endDate) {
    start = getDayBounds(startDate).start
    end = getDayBounds(endDate).end
  } else {
    // Default: current month
    const bounds = getMonthBounds(new Date())
    start = bounds.start
    end = bounds.end
  }

  const [payments, paidExpenses, pendingExpenses, attendances, expectedAgg, allPayments, allPaidExpenses] =
    await Promise.all([
    prisma.payment.aggregate({
      where: {
        ownerId,
        paidAt: { gte: start, lte: end },
      },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: {
        ownerId,
        status: 'PAID',
        paidAt: { gte: start, lte: end },
      },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: {
        ownerId,
        status: 'PENDING',
      },
      _sum: { amountCents: true },
    }),
    prisma.attendance.findMany({
      where: {
        ownerId,
        performedAt: { gte: start, lte: end },
      },
      include: { payments: true },
    }),
    // Previsto: agendamentos ainda não concluídos (agendados/confirmados) no período
    prisma.appointment.aggregate({
      where: {
        ownerId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        startsAt: { gte: start, lte: end },
      },
      _sum: { agreedPriceCents: true },
      _count: true,
    }),
    // Saldo acumulado em caixa (desde sempre)
    prisma.payment.aggregate({ where: { ownerId }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({
      where: { ownerId, status: 'PAID' },
      _sum: { amountCents: true },
    }),
  ])

  const incomeReceived = payments._sum.amountCents ?? 0
  const expensesPaid = paidExpenses._sum.amountCents ?? 0
  const expensesPending = pendingExpenses._sum.amountCents ?? 0

  let grossBilling = 0
  let totalDiscounts = 0
  let receivables = 0

  for (const att of attendances) {
    const due = att.priceCents - att.discountCents
    const paid = att.payments.reduce((s, p) => s + p.amountCents, 0)
    grossBilling += att.priceCents
    totalDiscounts += att.discountCents
    receivables += Math.max(0, due - paid)
  }

  // Also consider older attendances with pending balance? For simplicity, only period
  // Better: global receivables
  const allPendingAttendances = await prisma.attendance.findMany({
    where: { ownerId },
    include: { payments: true },
  })
  let totalReceivables = 0
  for (const att of allPendingAttendances) {
    const due = att.priceCents - att.discountCents
    const paid = att.payments.reduce((s, p) => s + p.amountCents, 0)
    totalReceivables += Math.max(0, due - paid)
  }

  return {
    period: { start, end },
    incomeReceivedCents: incomeReceived,
    expensesPaidCents: expensesPaid,
    cashBalanceCents: incomeReceived - expensesPaid,
    expensesPendingCents: expensesPending,
    grossBillingCents: grossBilling,
    totalDiscountsCents: totalDiscounts,
    receivablesCents: totalReceivables,
    netResultCents: incomeReceived - expensesPaid,
    attendancesCount: attendances.length,
    averageTicketCents:
      attendances.length > 0 ? Math.round(incomeReceived / attendances.length) : 0,
    expectedCents: expectedAgg._sum.agreedPriceCents ?? 0,
    expectedCount: expectedAgg._count,
    totalBalanceCents:
      (allPayments._sum.amountCents ?? 0) - (allPaidExpenses._sum.amountCents ?? 0),
  }
}

/** Extrato do caixa: entradas (pagamentos) e saídas (despesas pagas), mais recentes primeiro. */
export async function getMovements(ownerId: string, startDate?: string, endDate?: string) {
  const bounds = getMonthBounds(new Date())
  const start = startDate ? getDayBounds(startDate).start : bounds.start
  const end = endDate ? getDayBounds(endDate).end : bounds.end

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { ownerId, paidAt: { gte: start, lte: end } },
      include: {
        attendance: {
          select: {
            client: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: { ownerId, status: 'PAID', paidAt: { gte: start, lte: end } },
      include: { category: { select: { name: true } } },
    }),
  ])

  const items = [
    ...payments.map((p) => ({
      id: p.id,
      type: 'IN' as const,
      date: p.paidAt,
      amountCents: p.amountCents,
      method: p.method,
      title: p.attendance?.client?.name ?? p.description ?? 'Recebimento',
      subtitle: p.attendance?.service?.name ?? null,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      type: 'OUT' as const,
      date: e.paidAt!,
      amountCents: e.amountCents,
      method: e.paymentMethod,
      title: e.description,
      subtitle: e.category?.name ?? null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return { period: { start, end }, items }
}

export async function getDashboard(ownerId: string) {
  const todayBounds = getDayBounds(new Date())
  const monthBounds = getMonthBounds(new Date())

  const [
    todayPayments,
    todayExpenses,
    todayAttendancesCount,
    todayAppointments,
    upcoming,
    monthPayments,
    monthExpenses,
    allPayments,
    allPaidExpenses,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { ownerId, paidAt: { gte: todayBounds.start, lte: todayBounds.end } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: {
        ownerId,
        status: 'PAID',
        paidAt: { gte: todayBounds.start, lte: todayBounds.end },
      },
      _sum: { amountCents: true },
    }),
    prisma.attendance.count({
      where: {
        ownerId,
        performedAt: { gte: todayBounds.start, lte: todayBounds.end },
      },
    }),
    prisma.appointment.findMany({
      where: {
        ownerId,
        startsAt: { gte: todayBounds.start, lte: todayBounds.end },
      },
      orderBy: { startsAt: 'asc' },
      include: {
        client: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        ownerId,
        startsAt: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      include: {
        client: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { ownerId, paidAt: { gte: monthBounds.start, lte: monthBounds.end } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: {
        ownerId,
        status: 'PAID',
        paidAt: { gte: monthBounds.start, lte: monthBounds.end },
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({ where: { ownerId }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({
      where: { ownerId, status: 'PAID' },
      _sum: { amountCents: true },
    }),
  ])

  const incomeToday = todayPayments._sum.amountCents ?? 0
  const expensesToday = todayExpenses._sum.amountCents ?? 0
  const incomeMonth = monthPayments._sum.amountCents ?? 0
  const expensesMonth = monthExpenses._sum.amountCents ?? 0

  return {
    today: {
      incomeReceivedCents: incomeToday,
      expensesPaidCents: expensesToday,
      cashBalanceCents: incomeToday - expensesToday,
      attendancesCount: todayAttendancesCount,
      appointmentsCount: todayAppointments.length,
      expectedCents: todayAppointments
        .filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
        .reduce((sum, a) => sum + a.agreedPriceCents, 0),
      appointments: todayAppointments,
    },
    month: {
      incomeReceivedCents: incomeMonth,
      expensesPaidCents: expensesMonth,
      cashBalanceCents: incomeMonth - expensesMonth,
    },
    totalBalanceCents:
      (allPayments._sum.amountCents ?? 0) - (allPaidExpenses._sum.amountCents ?? 0),
    upcomingAppointments: upcoming,
  }
}

export async function getFinancialReport(ownerId: string, params: FinancialReportInput) {
  const start = params.startDate
    ? getDayBounds(params.startDate).start
    : getMonthBounds(new Date()).start
  const end = params.endDate
    ? getDayBounds(params.endDate).end
    : getMonthBounds(new Date()).end

  const payments = await prisma.payment.findMany({
    where: {
      ownerId,
      paidAt: { gte: start, lte: end },
      ...(params.paymentMethod && { method: params.paymentMethod }),
    },
    orderBy: { paidAt: 'asc' },
  })

  const expenses = await prisma.expense.findMany({
    where: {
      ownerId,
      status: 'PAID',
      paidAt: { gte: start, lte: end },
      ...(params.categoryId && { categoryId: params.categoryId }),
    },
    include: { category: true },
    orderBy: { paidAt: 'asc' },
  })

  // Group by day or month
  const groupKey = (d: Date) => {
    return formatLocal(d, params.groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd')
  }

  const incomeByPeriod: Record<string, number> = {}
  const expenseByPeriod: Record<string, number> = {}

  for (const p of payments) {
    const key = groupKey(p.paidAt)
    incomeByPeriod[key] = (incomeByPeriod[key] ?? 0) + p.amountCents
  }
  for (const e of expenses) {
    const key = groupKey(e.paidAt!)
    expenseByPeriod[key] = (expenseByPeriod[key] ?? 0) + e.amountCents
  }

  const allKeys = Array.from(
    new Set([...Object.keys(incomeByPeriod), ...Object.keys(expenseByPeriod)])
  ).sort()

  const series = allKeys.map((key) => ({
    period: key,
    incomeCents: incomeByPeriod[key] ?? 0,
    expenseCents: expenseByPeriod[key] ?? 0,
    resultCents: (incomeByPeriod[key] ?? 0) - (expenseByPeriod[key] ?? 0),
  }))

  // Top services
  const topServices = await prisma.attendance.groupBy({
    by: ['serviceId'],
    where: {
      ownerId,
      performedAt: { gte: start, lte: end },
      serviceId: { not: null },
    },
    _count: true,
    _sum: { priceCents: true },
    orderBy: { _count: { serviceId: 'desc' } },
    take: 10,
  })

  const serviceIds = topServices.map((s) => s.serviceId!).filter(Boolean)
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  })
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]))

  // Payment methods distribution
  const methodDist = await prisma.payment.groupBy({
    by: ['method'],
    where: { ownerId, paidAt: { gte: start, lte: end } },
    _sum: { amountCents: true },
    _count: true,
  })

  // Expenses by category
  const expByCat = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: {
      ownerId,
      status: 'PAID',
      paidAt: { gte: start, lte: end },
    },
    _sum: { amountCents: true },
    _count: true,
  })

  const catIds = expByCat.map((e) => e.categoryId).filter(Boolean) as string[]
  const cats = await prisma.expenseCategory.findMany({
    where: { id: { in: catIds } },
  })
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]))

  return {
    period: { start, end },
    series,
    topServices: topServices.map((s) => ({
      serviceId: s.serviceId,
      name: serviceMap[s.serviceId!] ?? 'Sem serviço',
      count: s._count,
      totalCents: s._sum.priceCents ?? 0,
    })),
    paymentMethods: methodDist.map((m) => ({
      method: m.method,
      count: m._count,
      totalCents: m._sum.amountCents ?? 0,
    })),
    expensesByCategory: expByCat.map((e) => ({
      categoryId: e.categoryId,
      name: e.categoryId ? catMap[e.categoryId] ?? 'Sem categoria' : 'Sem categoria',
      count: e._count,
      totalCents: e._sum.amountCents ?? 0,
    })),
  }
}

export async function createCategory(ownerId: string, name: string) {
  return prisma.expenseCategory.create({
    data: { ownerId, name: name.trim() },
  })
}

export async function listCategories(ownerId: string) {
  return prisma.expenseCategory.findMany({
    where: { ownerId, isActive: true },
    orderBy: { name: 'asc' },
  })
}
