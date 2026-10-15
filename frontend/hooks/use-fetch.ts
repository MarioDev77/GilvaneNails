'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'

/** Busca dados da API e refaz a busca quando `path` muda ou `reload()` é chamado. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (path === null) return
    const mine = ++seq.current
    setLoading(true)
    try {
      const result = await api.get<T>(path)
      if (mine !== seq.current) return // resposta antiga: ignora
      setData(result)
      setError(null)
    } catch (e) {
      if (mine !== seq.current) return
      setError(e instanceof ApiError ? e.message : 'Erro inesperado')
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [path])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

export type Paginated<T> = {
  items: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
