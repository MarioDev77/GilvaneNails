/**
 * Cliente da API. Todas as chamadas vão para /api/* (mesma origem), que o
 * next.config.mjs repassa ao backend. O cookie de sessão viaja automaticamente.
 */

export class ApiError extends Error {
  status: number
  code: string
  details?: { path: string; message: string }[]
  constructor(status: number, code: string, message: string, details?: ApiError['details']) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()
/** Chamado quando qualquer requisição volta 401 (sessão expirou). */
export function onUnauthorized(fn: Listener) {
  unauthorizedListeners.add(fn)
  return () => {
    unauthorizedListeners.delete(fn)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique se o sistema está ligado.')
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* resposta não-JSON (ex.: proxy sem backend) */
  }

  if (!res.ok) {
    if (res.status === 401) unauthorizedListeners.forEach((fn) => fn())
    if (json?.error) {
      throw new ApiError(res.status, json.error.code, friendlyMessage(json.error), json.error.details)
    }
    throw new ApiError(
      res.status,
      'SERVER',
      res.status >= 500
        ? 'O servidor não respondeu. Verifique se o backend está ligado.'
        : 'Não foi possível concluir a operação.'
    )
  }
  return json?.data as T
}

function friendlyMessage(err: { message: string; details?: { path: string; message: string }[] }) {
  if (err.details?.length) {
    return err.details.map((d) => d.message).join(' • ')
  }
  return err.message
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// ---------- Login (protocolo do NextAuth, sem depender do next-auth/react) ----------

export type SessionUser = { id: string; name: string; email: string }

export async function getSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json?.user?.id ? (json.user as SessionUser) : null
  } catch {
    return null
  }
}

export async function login(email: string, password: string): Promise<SessionUser> {
  let csrfToken: string
  try {
    const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' })
    csrfToken = (await csrf.json()).csrfToken
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível falar com o servidor. Verifique se o sistema está ligado.')
  }
  await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email, password, json: 'true' }),
  })
  const user = await getSession()
  if (!user) throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
  return user
}

export async function logout() {
  try {
    const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' })
    const { csrfToken } = await csrf.json()
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, json: 'true' }),
    })
  } catch {
    /* mesmo sem rede, volta para a tela de login */
  }
}
