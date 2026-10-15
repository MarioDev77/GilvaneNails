/**
 * Teste de ponta a ponta: login real + fluxo completo do salão.
 * Uso:  BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... node tests/e2e.mjs
 * (BASE_URL pode ser o frontend — testa também o proxy — ou o backend direto.)
 * ATENÇÃO: cria dados de teste ("[E2E] ...") na conta usada.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
if (!EMAIL || !PASSWORD) { console.error('Defina E2E_EMAIL e E2E_PASSWORD'); process.exit(1) }

let cookies = {}
const jar = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';'); const i = pair.indexOf('=')
    const k = pair.slice(0, i), v = pair.slice(i + 1)
    if (v === '' || /Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) delete cookies[k]; else cookies[k] = v
  }
}
async function raw(path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...opts, headers: { cookie: jar(), ...(opts.headers ?? {}) } })
  store(res); return res
}
async function api(method, path, body) {
  const res = await raw('/api' + path, {
    method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text(); let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  return { status: res.status, data: json?.data, error: json?.error }
}

let pass = 0, fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name, extra ?? '') }
}
const section = (t) => console.log('\n' + t)

const tz = (d, t) => `${d}T${t}:00-03:00`            // horário da Bahia (UTC-3, sem horário de verão)
// dia futuro aleatório: o teste pode ser repetido sem esbarrar nos dados da rodada anterior
const tomorrow = new Date(Date.now() + (30 + Math.floor(Math.random() * 600)) * 86400000).toISOString().slice(0, 10)
const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)  // "hoje" na Bahia

section('Autenticação')
let r = await api('GET', '/clients')
check('rota privada sem login → 401', r.status === 401)
const csrf = await (await raw('/api/auth/csrf')).json()
let login = await raw('/api/auth/callback/credentials', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: 'senha-errada', json: 'true' }),
})
let session = await (await raw('/api/auth/session')).json()
check('senha errada não autentica', !session?.user)
const csrf2 = await (await raw('/api/auth/csrf')).json()
await raw('/api/auth/callback/credentials', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ csrfToken: csrf2.csrfToken, email: EMAIL, password: PASSWORD, json: 'true' }),
})
session = await (await raw('/api/auth/session')).json()
check('login correto cria sessão', !!session?.user?.id, JSON.stringify(session))

section('Clientes e serviços')
r = await api('POST', '/clients', { name: '[E2E] Maria Silva', phone: '(75) 99999-1111', birthday: '1990-10-15' })
check('cria cliente', r.status === 201, JSON.stringify(r.error)); const client = r.data
check('aniversário preservado no dia certo (fuso)', new Date(client.birthday).toISOString().startsWith('1990-10-15T03:00'))
r = await api('POST', '/clients', { name: 'X', phone: '1' })
check('valida dados inválidos → 400', r.status === 400)
r = await api('GET', '/clients?search=MARIA%20silva')
check('busca cliente (sem diferenciar maiúsculas)', r.data?.items?.some((c) => c.id === client.id))
r = await api('POST', '/services', { name: '[E2E] Gel', priceCents: 12000, durationMinutes: 90 })
check('cria serviço', r.status === 201); const service = r.data
r = await api('POST', '/services', { name: '[E2E] Esmalte', priceCents: 6000, durationMinutes: 45 })
const service2 = r.data

section('Agenda')
r = await api('POST', '/appointments', { clientId: client.id, serviceId: service.id, startsAt: tz(tomorrow, '10:00') })
check('cria agendamento', r.status === 201, JSON.stringify(r.error)); const appt = r.data
check('preço assumido do serviço', appt?.agreedPriceCents === 12000)
check('fim = início + duração', new Date(appt.endsAt) - new Date(appt.startsAt) === 90 * 60000)
r = await api('POST', '/appointments', { clientId: client.id, serviceId: service2.id, startsAt: tz(tomorrow, '11:00') })
check('conflito de horário → 409', r.status === 409, r.status)
r = await api('POST', '/appointments', { clientId: client.id, serviceId: service2.id, startsAt: tz(tomorrow, '11:30') })
check('horário colado (encosta no fim) é permitido', r.status === 201, JSON.stringify(r.error)); const appt2 = r.data
const race = await Promise.all([1, 2, 3, 4].map(() =>
  api('POST', '/appointments', { clientId: client.id, serviceId: service2.id, startsAt: tz(tomorrow, '15:00') })))
check('4 requisições simultâneas no mesmo horário → só 1 passa', race.filter((x) => x.status === 201).length === 1,
  race.map((x) => x.status).join(','))
r = await api('GET', `/appointments?startDate=${tomorrow}&endDate=${tomorrow}`)
check('filtro por data traz o dia certo', r.data?.items?.length === 3, r.data?.items?.length)
r = await api('GET', `/appointments?startDate=${today}&endDate=${today}&clientId=${client.id}`)
check('filtro por data não vaza o dia seguinte', r.data?.items?.length === 0)
r = await api('GET', '/appointments?upcoming=false&clientId=' + client.id)
check('upcoming=false é respeitado (boolean de querystring)', r.status === 200 && r.data.items.length >= 3)
r = await api('PATCH', `/appointments/${appt2.id}`, { startsAt: tz(tomorrow, '10:30') })
check('remarcar para horário ocupado → 409', r.status === 409)
r = await api('PATCH', `/appointments/${appt2.id}/status`, { status: 'CONFIRMED' })
check('confirma agendamento', r.data?.status === 'CONFIRMED')
r = await api('DELETE', `/appointments/${appt2.id}`)
check('cancela agendamento', r.data?.status === 'CANCELLED')
r = await api('POST', '/appointments', { clientId: client.id, serviceId: service2.id, startsAt: tz(tomorrow, '11:30') })
check('horário de cancelado é liberado', r.status === 201); const appt3 = r.data
r = await api('PATCH', `/appointments/${appt2.id}/status`, { status: 'SCHEDULED' })
check('reativar cancelado em horário já ocupado → 409', r.status === 409)

section('Atendimento e pagamentos')
r = await api('POST', '/attendances', { appointmentId: appt.id, clientId: client.id, serviceId: service.id, priceCents: 12000, discountCents: 2000 })
check('registra atendimento do agendamento', r.status === 201, JSON.stringify(r.error)); const att = r.data
r = await api('GET', `/appointments/${appt.id}`)
check('agendamento vira COMPLETED', r.data?.status === 'COMPLETED')
r = await api('POST', '/attendances', { appointmentId: appt.id, clientId: client.id, priceCents: 100 })
check('segundo atendimento no mesmo agendamento → 409', r.status === 409)
const key = 'e2e-key-' + Date.now()
r = await api('POST', `/attendances/${att.id}/payments`, { amountCents: 4000, method: 'PIX', idempotencyKey: key })
check('pagamento parcial (PIX)', r.status === 201, JSON.stringify(r.error)); const pay1 = r.data
r = await api('POST', `/attendances/${att.id}/payments`, { amountCents: 4000, method: 'PIX', idempotencyKey: key })
check('reenvio com mesma chave não duplica', r.data?.id === pay1.id)
r = await api('GET', `/attendances/${att.id}`)
check('saldo = 10000 − 4000 = 6000', r.data?.balanceCents === 6000, r.data?.balanceCents)
r = await api('POST', `/attendances/${att.id}/payments`, { amountCents: 7000, method: 'CASH' })
check('pagar mais que o saldo → 400', r.status === 400)
const k2 = 'e2e-k2-' + Date.now()
const pays = await Promise.all([1, 2].map(() =>
  api('POST', `/attendances/${att.id}/payments`, { amountCents: 6000, method: 'CASH', idempotencyKey: k2 })))
check('2 cliques simultâneos no mesmo pagamento → 1 registro', new Set(pays.map((p) => p.data?.id)).size === 1 && pays.every((p) => p.status === 201), pays.map((p) => p.status + JSON.stringify(p.error)).join(' '))
r = await api('GET', `/attendances/${att.id}`)
check('saldo zerado', r.data?.balanceCents === 0)
r = await api('POST', '/attendances', { clientId: client.id, serviceId: service2.id, priceCents: 6000 })
check('atendimento avulso (sem agendamento)', r.status === 201); const att2 = r.data

section('Financeiro')
r = await api('GET', '/categories')
check('categorias padrão criadas', r.data?.length >= 5, r.data?.length); const cat = r.data[0]
r = await api('POST', '/finance/expenses', { description: '[E2E] Esmaltes', amountCents: 5000, incurredAt: today, categoryId: cat.id })
check('cria despesa', r.status === 201, JSON.stringify(r.error)); const exp = r.data
r = await api('PATCH', `/finance/expenses/${exp.id}/pay`, { paymentMethod: 'PIX' })
check('paga despesa', r.data?.status === 'PAID')
r = await api('PATCH', `/finance/expenses/${exp.id}/pay`, {})
check('pagar de novo → 400', r.status === 400)
r = await api('GET', '/finance/summary')
check('resumo: recebido ≥ 10000', r.data?.incomeReceivedCents >= 10000, r.data?.incomeReceivedCents)
check('resumo: a receber inclui atendimento avulso (6000)', r.data?.receivablesCents >= 6000, r.data?.receivablesCents)
check('resumo: despesa paga ≥ 5000', r.data?.expensesPaidCents >= 5000)
r = await api('GET', '/dashboard')
check('dashboard completo', r.status === 200 && r.data?.week?.length === 7 && typeof r.data.receivablesCents === 'number' && r.data.activeClients >= 1, JSON.stringify(r.error))
check('dashboard: pagamento de hoje no dia certo da semana', r.data?.week?.at(-1)?.incomeCents >= 10000, JSON.stringify(r.data?.week?.at(-1)))
r = await api('GET', `/reports/financial?startDate=${today}&endDate=${today}`)
check('relatório financeiro', r.status === 200 && r.data.series.length >= 1 && r.data.topServices.length >= 1, JSON.stringify(r.error))
r = await api('GET', `/clients/${client.id}/history`)
check('histórico da cliente', r.data?.attendances?.length === 2 && r.data.pendingBalanceCents === 6000, JSON.stringify(r.data?.pendingBalanceCents))

section('Configurações e segurança')
r = await api('PATCH', '/settings', { businessName: 'Gilvane Nails', phone: '(75) 99999-0000' })
check('salva configurações', r.status === 200 && r.data.phone === '(75) 99999-0000')
r = await api('PATCH', `/finance/expenses/${exp.id}`, { categoryId: 'cabcdefghijklmnopqrstuvwx' })
check('categoria inexistente/de outra conta → 404', r.status === 404, r.status)
r = await api('POST', '/account/password', { currentPassword: 'errada', newPassword: 'NovaSenha123!' })
check('troca de senha exige a senha atual → 400', r.status === 400)
r = await api('DELETE', `/clients/${client.id}`)
check('arquiva cliente', !!r.data?.archivedAt)
r = await api('GET', '/clients?search=e2e')
check('cliente arquivada some da lista', !r.data.items.some((c) => c.id === client.id))
r = await api('GET', '/clients?includeArchived=true&search=e2e')
check('includeArchived=true mostra arquivadas', r.data.items.some((c) => c.id === client.id))

await raw('/api/auth/signout', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ csrfToken: (await (await raw('/api/auth/csrf')).json()).csrfToken, json: 'true' }) })
r = await api('GET', '/clients')
check('após sair, rota privada volta a dar 401', r.status === 401)

console.log(`\n${pass} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
