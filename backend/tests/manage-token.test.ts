import { describe, it, expect, beforeAll } from 'vitest'
import { isValidManageToken, manageToken, safeManageToken } from '../src/lib/manage-token'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'segredo-de-teste-com-mais-de-trinta-caracteres'
})

describe('link de remarcar/cancelar', () => {
  it('o token é estável e tem 32 caracteres', () => {
    expect(manageToken('cm1abc')).toBe(manageToken('cm1abc'))
    expect(manageToken('cm1abc')).toHaveLength(32)
  })
  it('cada agendamento tem o seu token', () => {
    expect(manageToken('cm1abc')).not.toBe(manageToken('cm1abd'))
  })
  it('aceita o token certo e recusa o de outro agendamento, adulterado ou vazio', () => {
    const t = manageToken('cm1abc')
    expect(isValidManageToken('cm1abc', t)).toBe(true)
    expect(isValidManageToken('cm1abd', t)).toBe(false)
    expect(isValidManageToken('cm1abc', t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a'))).toBe(false)
    expect(isValidManageToken('cm1abc', '')).toBe(false)
  })
  it('token feito com outro segredo não vale', () => {
    const old = manageToken('cm1abc')
    process.env.NEXTAUTH_SECRET = 'outro-segredo-totalmente-diferente-123456'
    expect(isValidManageToken('cm1abc', old)).toBe(false)
    process.env.NEXTAUTH_SECRET = 'segredo-de-teste-com-mais-de-trinta-caracteres'
  })
  it('sem segredo configurado nada é aceito e a lista do painel não quebra', () => {
    const t = manageToken('cm1abc')
    const saved = process.env.NEXTAUTH_SECRET
    delete process.env.NEXTAUTH_SECRET
    expect(safeManageToken('cm1abc')).toBeUndefined()
    expect(isValidManageToken('cm1abc', t)).toBe(false)
    process.env.NEXTAUTH_SECRET = saved
  })
})
