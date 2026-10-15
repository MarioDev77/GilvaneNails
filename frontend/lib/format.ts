/** Formatação e conversões. Dinheiro sempre em centavos; datas sempre no fuso da Bahia. */

export const TZ = 'America/Bahia'

export function formatBRL(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "120", "120,5", "1.200,50", "R$ 85" → centavos. Retorna null se inválido. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[^\d,.-]/g, '').trim()
  if (!clean) return null
  let normalized = clean
  if (clean.includes(',')) normalized = clean.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/** centavos → texto de campo ("120,00") */
export function moneyToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function parts(date: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opts }).format(date)
}

/** YYYY-MM-DD do dia (na Bahia) ao qual o instante pertence */
export function toDateKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

export const todayKey = () => toDateKey(new Date())

/** HH:mm na Bahia */
export function toTimeKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return parts(d, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "2026-10-15" + "10:00" → ISO com fuso da Bahia (UTC-3, sem horário de verão) */
export function toISO(dateKey: string, time: string) {
  return `${dateKey}T${time}:00-03:00`
}

/** Soma dias a uma chave YYYY-MM-DD */
export function addDaysKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function monthStartKey(key: string) {
  return key.slice(0, 8) + '01'
}
export function monthEndKey(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
export function addMonthsKey(key: string, months: number) {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10)
}

/** Para chaves YYYY-MM-DD (sem fuso) */
function keyToDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}
export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(keyToDate(key))
}
export function formatLongDate(key: string) {
  const s = formatDateKey(key, { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export function formatMonthKey(key: string) {
  const s = formatDateKey(key, { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatDateTime(iso: string) {
  return `${toDateKey(iso).split('-').reverse().join('/')} às ${toTimeKey(iso)}`
}
export function formatDate(iso: string) {
  return toDateKey(iso).split('-').reverse().join('/')
}

export function greeting() {
  const h = Number(parts(new Date(), { hour: '2-digit', hour12: false }))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const full = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${full}`
}

export const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
}

export const METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  OTHER: 'Outro',
}

export const EXPENSE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
}
