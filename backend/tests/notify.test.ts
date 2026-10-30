import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { notifyOwner, prettyPhone } from '../src/lib/notify'

const ENV = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'RESEND_API_KEY', 'NOTIFY_EMAIL', 'NOTIFY_EMAIL_FROM', 'PANEL_URL']

describe('aviso para a dona', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    ENV.forEach((k) => delete process.env[k])
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sem nenhum canal configurado não faz nada', async () => {
    await notifyOwner('Título', 'Corpo')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Telegram: manda título e corpo para o chat configurado', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok'
    process.env.TELEGRAM_CHAT_ID = '42'
    process.env.PANEL_URL = 'https://painel.exemplo'
    await notifyOwner('Novo pedido', 'Maria')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bottok/sendMessage')
    const body = JSON.parse(init.body)
    expect(body.chat_id).toBe('42')
    expect(body.text).toContain('Novo pedido')
    expect(body.text).toContain('Maria')
    expect(body.text).toContain('https://painel.exemplo')
  })

  it('e-mail: usa Resend com o assunto e o destinatário', async () => {
    process.env.RESEND_API_KEY = 're_x'
    process.env.NOTIFY_EMAIL = 'gil@exemplo.com'
    await notifyOwner('Assunto', 'Texto')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_x')
    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['gil@exemplo.com'])
    expect(body.subject).toBe('Assunto')
  })

  it('falha de rede ou resposta de erro nunca estoura', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok'
    process.env.TELEGRAM_CHAT_ID = '42'
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('sem rede'))
    await expect(notifyOwner('a', 'b')).resolves.toBeUndefined()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(notifyOwner('a', 'b')).resolves.toBeUndefined()
    // o token do Telegram não pode aparecer nos logs
    expect(log.mock.calls.flat().join(' ')).not.toContain('tok')
    log.mockRestore()
  })

  it('formata telefone com e sem nono dígito', () => {
    expect(prettyPhone('75999999999')).toBe('(75) 99999-9999')
    expect(prettyPhone('7533334444')).toBe('(75) 3333-4444')
  })
})
