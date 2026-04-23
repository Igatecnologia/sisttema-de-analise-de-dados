import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type OpenTab = {
  /** path sem query string — chave única da aba */
  path: string
  /** label amigável (ex.: "Dashboard") */
  title: string
  /** última URL completa com query string — ao clicar, navega pra ela */
  url: string
}

const STORAGE_KEY = 'iga.openTabs.v1'
const MAX_TABS = 10

/**
 * Gerencia abas de páginas abertas tipo Chrome:
 * - Sincroniza com a rota atual (a URL em uso vira aba)
 * - Persiste em sessionStorage — some ao fechar o app, não polui localStorage
 * - Limita a MAX_TABS (descarta a mais antiga que não seja a ativa)
 *
 * Não gerencia o estado interno da página (filtros, scroll) — só a URL.
 * Fechar + reabrir uma aba volta ao estado inicial da página.
 */
export function useOpenTabs(getTitle: (path: string) => string) {
  const location = useLocation()
  const navigate = useNavigate()
  const [tabs, setTabs] = useState<OpenTab[]>(() => loadFromStorage())

  /** Base path (sem query) pra usar como chave — evita duplicar aba ao mudar filtro. */
  const activePath = location.pathname
  const activeUrl = location.pathname + location.search

  // Sincroniza: toda vez que a URL muda, garante que existe aba pra ela
  useEffect(() => {
    if (activePath === '/login') return
    setTabs((current) => {
      const existing = current.find((t) => t.path === activePath)
      const title = getTitle(activePath)
      let next: OpenTab[]
      if (existing) {
        next = current.map((t) =>
          t.path === activePath ? { ...t, title, url: activeUrl } : t,
        )
      } else {
        next = [...current, { path: activePath, title, url: activeUrl }]
        if (next.length > MAX_TABS) {
          // descarta a mais antiga que NÃO é a ativa
          const idxToDrop = next.findIndex((t) => t.path !== activePath)
          if (idxToDrop >= 0) next.splice(idxToDrop, 1)
        }
      }
      persist(next)
      return next
    })
  }, [activePath, activeUrl, getTitle])

  const closeTab = useCallback(
    (path: string) => {
      setTabs((current) => {
        const idx = current.findIndex((t) => t.path === path)
        if (idx < 0) return current
        const next = current.filter((t) => t.path !== path)
        persist(next)
        // Se fechou a ativa, navega pra uma vizinha (preferência: anterior)
        if (path === activePath) {
          const fallback = next[idx - 1] ?? next[idx] ?? next[0]
          if (fallback) navigate(fallback.url)
          else navigate('/gestao')
        }
        return next
      })
    },
    [activePath, navigate],
  )

  const closeOthers = useCallback(
    (keepPath: string) => {
      setTabs((current) => {
        const kept = current.filter((t) => t.path === keepPath)
        persist(kept)
        return kept
      })
    },
    [],
  )

  const closeAll = useCallback(() => {
    setTabs([])
    persist([])
    navigate('/gestao')
  }, [navigate])

  return useMemo(
    () => ({ tabs, activePath, closeTab, closeOthers, closeAll }),
    [tabs, activePath, closeTab, closeOthers, closeAll],
  )
}

function loadFromStorage(): OpenTab[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is OpenTab =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as OpenTab).path === 'string' &&
        typeof (t as OpenTab).title === 'string' &&
        typeof (t as OpenTab).url === 'string',
    )
  } catch {
    return []
  }
}

function persist(tabs: OpenTab[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    /* quota cheia — ignora */
  }
}
