import { describe, it, expect } from 'vitest'
import { normalizePhone, samePhone } from '../src/lib/phone'

describe('telefone', () => {
  it('ignora máscara, espaços e o 55', () => {
    expect(normalizePhone('(75) 99999-9999')).toBe('75999999999')
    expect(normalizePhone('+55 75 99999-9999')).toBe('75999999999')
    expect(normalizePhone('75999999999')).toBe('75999999999')
  })
  it('cadastro do painel (com máscara) casa com o pedido do site (só números)', () => {
    expect(samePhone('(75) 99999-9999', '75999999999')).toBe(true)
  })
  it('números diferentes não casam e vazio nunca casa', () => {
    expect(samePhone('(75) 99999-9999', '75988888888')).toBe(false)
    expect(samePhone('', '')).toBe(false)
  })
})
