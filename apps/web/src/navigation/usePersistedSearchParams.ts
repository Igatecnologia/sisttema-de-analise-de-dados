import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getPersistedFilterState,
  resetPersistedFilterState,
  savePersistedFilterState,
} from './uxPreferences'

type UsePersistedSearchParamsInput = {
  storageKey: string
  ttlMs: number
}

export function usePersistedSearchParams({ storageKey, ttlMs }: UsePersistedSearchParamsInput) {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const hydratedRef = useRef(false)
  const currentQueryString = useMemo(() => searchParams.toString(), [searchParams])

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    if (currentQueryString) {
      savePersistedFilterState(session, storageKey, currentQueryString)
      return
    }

    const persisted = getPersistedFilterState(session, storageKey, ttlMs)
    if (!persisted) return
    setSearchParams(new URLSearchParams(persisted), { replace: true })
  }, [currentQueryString, session, setSearchParams, storageKey, ttlMs])

  useEffect(() => {
    if (!hydratedRef.current) return
    savePersistedFilterState(session, storageKey, currentQueryString)
  }, [currentQueryString, session, storageKey])

  function resetPersistedState() {
    resetPersistedFilterState(session, storageKey)
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return {
    searchParams,
    setSearchParams,
    resetPersistedState,
  }
}
