import { describe, it, expect } from 'vitest'
import { listClientsSchema } from '../src/schemas/client'
import { listAppointmentsSchema } from '../src/schemas/appointment'
import { createPaymentSchema } from '../src/schemas/attendance'

describe('querystring booleans', () => {
  it('"false" é false (z.coerce.boolean() tratava como true)', () => {
    expect(listClientsSchema.parse({ includeArchived: 'false' }).includeArchived).toBe(false)
    expect(listAppointmentsSchema.parse({ upcoming: 'false' }).upcoming).toBe(false)
  })
  it('"true" e ausente funcionam', () => {
    expect(listClientsSchema.parse({ includeArchived: 'true' }).includeArchived).toBe(true)
    expect(listClientsSchema.parse({}).includeArchived).toBe(false)
  })
})

describe('pagamento', () => {
  it('rejeita valor zero ou negativo', () => {
    expect(() => createPaymentSchema.parse({ amountCents: 0, method: 'PIX' })).toThrow()
    expect(() => createPaymentSchema.parse({ amountCents: -5, method: 'PIX' })).toThrow()
  })
})
