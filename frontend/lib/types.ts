export type Client = { id: string; name: string; phone: string; birthday: string | null; notes: string | null; archivedAt: string | null }
export type Service = { id: string; name: string; description: string | null; priceCents: number; durationMinutes: number; isActive: boolean }
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type Appointment = {
  id: string
  startsAt: string
  endsAt: string
  agreedPriceCents: number
  status: AppointmentStatus
  notes: string | null
  clientId: string
  serviceId: string
  client: { id: string; name: string; phone?: string }
  service: { id: string; name: string; durationMinutes?: number; priceCents?: number }
  attendance?: { id: string } | null
}
export type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'OTHER'
export type Payment = { id: string; amountCents: number; paidAt: string; method: PaymentMethod; description: string | null }
export type Attendance = {
  id: string
  performedAt: string
  priceCents: number
  discountCents: number
  notes: string | null
  clientId: string
  client: { id: string; name: string; phone?: string }
  service: { id: string; name: string } | null
  payments: Payment[]
  paidCents: number
  dueCents: number
  balanceCents: number
}
export type ExpenseCategory = { id: string; name: string }
export type Expense = {
  id: string
  description: string
  amountCents: number
  incurredAt: string
  dueAt: string | null
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  notes: string | null
  categoryId: string | null
  category: ExpenseCategory | null
}
