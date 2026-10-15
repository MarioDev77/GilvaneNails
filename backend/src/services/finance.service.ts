import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError, ValidationError } from '@/lib/auth'
import { formatLocal, getDayBounds, getMonthBounds, parseDateInput } from '@/lib/dates'
import { addDays } from 'date-fns'
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
      incurredAt: parseDateInput(input.incurredAt),
      dueAt: input.dueAt ? parseDateInput(input.dueAt) : null,
      paymentMethod: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      status: 'PENDING',
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
  const existing = await getExpenseById(ownerId, id)

  if (input.categoryId) {
    const cat = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, ownerId },
    })
    if (!cat) throw new NotFoundError('Categoria não encontrada')
  }

  // Mantém status e data de pagamento coerentes
  let paidAt: Date | null | undefined
  if (input.status === 'PAID' && existing.status !== 'PAID') paidAt = new Date()
  if (input.status && input.status !== 'PAID') paidAt = null

  return prisma.expense.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.description !== undefined && { description: input.description.trim() }),
      ...(input.amountCents !== undefined && { amountCents: input.amountCents }),
      ...(input.incurredAt && { incurredAt: parseDateInput(input.incurredAt) }),
      ...(input.dueAt !== undefined && {
        dueAt: input.dueAt ? parseDateInput(input.dueAt) : null,
      }),
      ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status && { status: input.status }),
      ...(paidAt !== undefined && { paidAt }),
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

/** Total a receber (saldo de todos os atendimentos), calculado direto no banco. */
export async function getReceivablesCents(ownerId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint | number | null }[]>`
    SELECT COALESCE(SUM(GREATEST(a."priceCents" - a."discountCents" - COALESCE(p.paid, 0), 0)), 0) AS total
    FROM attendances a
    LEFT JOIN (
      SELECT "attendanceId", SUM("amountCents") AS paid
      FROM payments
      GROUP BY "attendanceId"
    ) p ON p."attendanceId" = a.id
    WHERE a."ownerId" = ${ownerId}`
  return Number(rows[0]?.total ?? 0)
}

export async function getFinancialSummary(
  ownerId: string,
  startDate?: string,
  endDate?: string
) {
  const { start, end } =
    startDate && endDate
      ? { start: getDayBounds(startDate).start, end: getDayBounds(endDate).end }
      : getMonthBounds(new Date())

  const [payments, paidExpenses, pendingExpenses, billing, receivables] = await Promise.all([
    prisma.payment.aggregate({
      where: { ownerId, paidAt: { gte: start, lte: end } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { ownerId, status: 'PAID', paidAt: { gte: start, lte: end } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { ownerId, status: 'PENDING' },
      _sum: { amountCents: true },
    }),
    prisma.attendance.aggregate({
      where: { ownerId, performedAt: { gte: start, lte: end } },
      _sum: { priceCents: true, discountCents: true },
    }),
    getReceivablesCents(ownerId),
  ])

  const incomeReceived = payments._sum.amountCents ?? 0
  const expensesPaid = paidExpenses._sum.amountCents ?? 0

  return {
    period: { start, end },
    incomeReceivedCents: incomeReceived,
    expensesPaidCents: expensesPaid,
    cashBalanceCents: incomeReceived - expensesPaid,
    expensesPendingCents: pendingExpenses._sum.amountCents ?? 0,
    grossBillingCents: billing._sum.priceCents ?? 0,
    totalDiscountsCents: billing._sum.discountCents ?? 0,
    receivablesCents: receivables,
    netResultCents: incomeReceived - expensesPaid,
  }
}

export async function getDashboard(ownerId: string) {
  const now = new Date()
  const todayBounds = getDayBounds(now)
  const monthBounds = getMonthBounds(now)
  // últimos 7 dias (hoje incluído), no fuso local
  const weekStart = getDayBounds(addDays(todayBounds.start, -6)).start

  const appointmentInclude = {
    client: { select: { id: true, name: true } },
    service: { select: { id: true, name: true } },
  }

  const [
    todayPayments,
    todayExpenses,
    todayAttendancesCount,
    todayAppointments,
    upcoming,
    monthPayments,
    monthExpenses,
    receivablesCents,
    activeClients,
    newClientsMonth,
    weekPayments,
    weekExpenses,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { ownerId, paidAt: { gte: todayBounds.start, lte: todayBounds.end } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { ownerId, status: 'PAID', paidAt: { gte: todayBounds.start, lte: todayBounds.end } },
      _sum: { amountCents: true },
    }),
    prisma.attendance.count({
      where: { ownerId, performedAt: { gte: todayBounds.start, lte: todayBounds.end } },
    }),
    prisma.appointment.findMany({
      where: { ownerId, startsAt: { gte: todayBounds.start, lte: todayBounds.end } },
      orderBy: { startsAt: 'asc' },
      include: { ...appointmentInclude, attendance: { select: { id: true } } },
    }),
    prisma.appointment.findMany({
      where: { ownerId, startsAt: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      orderBy: { startsAt: 'asc' },
      take: 5,
      include: appointmentInclude,
    }),
    prisma.payment.aggregate({
      where: { ownerId, paidAt: { gte: monthBounds.start, lte: monthBounds.end } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { ownerId, status: 'PAID', paidAt: { gte: monthBounds.start, lte: monthBounds.end } },
      _sum: { amountCents: true },
    }),
    getReceivablesCents(ownerId),
    prisma.client.count({ where: { ownerId, archivedAt: null } }),
    prisma.client.count({
      where: { ownerId, createdAt: { gte: monthBounds.start, lte: monthBounds.end } },
    }),
    prisma.payment.findMany({
      where: { ownerId, paidAt: { gte: weekStart, lte: todayBounds.end } },
      select: { paidAt: true, amountCents: true },
    }),
    prisma.expense.findMany({
      where: { ownerId, status: 'PAID', paidAt: { gte: weekStart, lte: todayBounds.end } },
      select: { paidAt: true, amountCents: true },
    }),
  ])

  const week: { date: string; incomeCents: number; expenseCents: number }[] = []
  for (let i = 0; i < 7; i++) {
    week.push({
      date: formatLocal(addDays(weekStart, i), 'yyyy-MM-dd'),
      incomeCents: 0,
      expenseCents: 0,
    })
  }
  const byDate = new Map(week.map((d) => [d.date, d]))
  for (const p of weekPayments) {
    const d = byDate.get(formatLocal(p.paidAt, 'yyyy-MM-dd'))
    if (d) d.incomeCents += p.amountCents
  }
  for (const e of weekExpenses) {
    const d = byDate.get(formatLocal(e.paidAt!, 'yyyy-MM-dd'))
    if (d) d.expenseCents += e.amountCents
  }

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
      appointmentsCount: todayAppointments.filter((a) => a.status !== 'CANCELLED').length,
      appointments: todayAppointments,
    },
    month: {
      incomeReceivedCents: incomeMonth,
      expensesPaidCents: expensesMonth,
      cashBalanceCents: incomeMonth - expensesMonth,
    },
    receivablesCents,
    activeClients,
    newClientsMonth,
    week,
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

  // Agrupa por dia/mês NO FUSO LOCAL (um pagamento às 22h não pode virar "amanhã")
  const groupKey = (d: Date) =>
    formatLocal(d, params.groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd')

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
  const clean = name.trim()
  const existing = await prisma.expenseCategory.findUnique({
    where: { ownerId_name: { ownerId, name: clean } },
  })
  if (existing) {
    if (existing.isActive) throw new ConflictError('Já existe uma categoria com esse nome')
    return prisma.expenseCategory.update({ where: { id: existing.id }, data: { isActive: true } })
  }
  return prisma.expenseCategory.create({ data: { ownerId, name: clean } })
}

const DEFAULT_CATEGORIES = ['Materiais', 'Aluguel', 'Transporte', 'Marketing', 'Contas (água/luz/internet)', 'Outros']

export async function listCategories(ownerId: string) {
  const count = await prisma.expenseCategory.count({ where: { ownerId } })
  if (count === 0) {
    await prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((name) => ({ ownerId, name })),
      skipDuplicates: true,
    })
  }
  return prisma.expenseCategory.findMany({
    where: { ownerId, isActive: true },
    orderBy: { name: 'asc' },
  })
}
